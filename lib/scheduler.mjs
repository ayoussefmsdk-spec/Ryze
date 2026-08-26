// The automatic-check scheduler. Railway runs the app as an always-on server,
// so a simple in-process interval is the most reliable "cron" — no external
// service needed. Every tick it looks at each active cycle's check_schedule
// and runs whatever is due. An external trigger endpoint also exists as backup.
import { query } from './db.mjs';
import { runCheck, getCycleWithTz, isPastEnd, todayInTz } from './check.mjs';

/** 'HH:MM' for a date (default now) in a timezone. */
function timeInTz(tz, date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz || 'UTC', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}
/** 'YYYY-MM-DD' for a date in a timezone. */
function dayInTz(tz, date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

/** Most recent auto-check time for a set of platforms in a cycle. */
async function lastChecked(cycleId, platforms) {
  const { rows } = await query(
    `select max(vh.checked_at) as last
       from view_history vh join clips c on c.id = vh.clip_id
      where c.cycle_id = $1 and c.platform = any($2)`,
    [cycleId, platforms],
  );
  return rows[0]?.last ? new Date(rows[0].last) : null;
}

function intervalDue(last, everyMinutes) {
  if (!last) return true;
  return Date.now() - last.getTime() >= everyMinutes * 60 * 1000;
}

/**
 * Daily mode with MULTIPLE slots: due when a scheduled local time has passed
 * that we haven't checked since. "10 a day" = ten atLocal times; each fires
 * once, in the cycle's timezone.
 */
export function dailyDue(last, atLocal, tz, now = new Date()) {
  const nowTime = timeInTz(tz, now);
  const today = dayInTz(tz, now);
  const passed = (atLocal && atLocal.length ? atLocal : ['06:00']).filter((t) => t <= nowTime).sort();
  if (!passed.length) return false;      // no slot reached yet today
  if (!last) return true;                // never checked -> first passed slot fires
  if (dayInTz(tz, last) !== today) return true; // last check was a previous day
  // Fire when the newest passed slot is later than the last check's time.
  return timeInTz(tz, last) < passed[passed.length - 1];
}

/**
 * runDueChecks() — one scheduler tick. Returns a summary of what ran.
 * Also freezes any past-end active cycles that have no clips (runCheck normally
 * handles freezing, but only when there is something to check).
 */
export async function runDueChecks() {
  // A slow tick (Apify actors can take minutes) must not overlap the next one —
  // overlapping runs would double-spend paid checks.
  if (globalThis.__ryzeTickRunning) return { ticked: new Date().toISOString(), ran: [], skippedOverlap: true };
  globalThis.__ryzeTickRunning = true;
  try {
    return await runDueChecksInner();
  } finally {
    globalThis.__ryzeTickRunning = false;
  }
}

async function runDueChecksInner() {
  // Daily housekeeping (at most once per calendar day, claimed atomically so
  // replicas can't double-run): compact old view history so the database
  // volume never fills up again.
  try {
    const { rows: claim } = await query(
      `update app_settings set last_prune_on = current_date
        where id = 1 and (last_prune_on is null or last_prune_on < current_date)
        returning 1`,
    );
    if (claim.length) {
      const { pruneHistory } = await import('./prune.mjs');
      const pruned = await pruneHistory();
      if (pruned) console.log(`[scheduler] compacted ${pruned} old view_history rows`);
    }
  } catch (err) {
    console.error('[scheduler] prune failed (non-fatal):', err.message);
  }

  const { rows: cycles } = await query(
    `select id from cycles where status = 'active' and auto_check_enabled = true`,
  );
  const ran = [];

  for (const { id } of cycles) {
    const cycle = await getCycleWithTz(id);
    if (!cycle) continue;
    const tz = cycle.effective_tz;
    const schedule = cycle.check_schedule || {};

    // Past end with nothing to fetch -> freeze directly.
    if (isPastEnd(cycle)) {
      await runCheck(id, { scope: 'all' }); // final capture + freeze
      ran.push({ cycleId: id, action: 'final-capture+freeze' });
      continue;
    }

    const free = schedule.free || { mode: 'interval', everyMinutes: 360 };
    const paid = schedule.paid || { mode: 'daily', atLocal: ['06:00'] };

    let freeDue = false;
    if (free.mode === 'interval') {
      freeDue = intervalDue(await lastChecked(id, ['youtube']), Number(free.everyMinutes) || 360);
    } else if (free.mode === 'daily') {
      freeDue = dailyDue(await lastChecked(id, ['youtube']), free.atLocal, tz);
    }

    let paidDue = false;
    if (paid.mode === 'interval') {
      paidDue = intervalDue(await lastChecked(id, ['tiktok', 'instagram']), Number(paid.everyMinutes) || 1440);
    } else if (paid.mode === 'daily') {
      paidDue = dailyDue(await lastChecked(id, ['tiktok', 'instagram']), paid.atLocal, tz);
    }
    // mode 'manual' -> never due automatically.

    if (paidDue) {
      await runCheck(id, { scope: 'all' });
      ran.push({ cycleId: id, action: 'check-all' });
    } else if (freeDue) {
      await runCheck(id, { scope: 'free' });
      ran.push({ cycleId: id, action: 'check-free' });
    }
  }
  return { ticked: new Date().toISOString(), ran };
}

// ---- in-process interval (started once from instrumentation) ----------------
const TICK_MS = 5 * 60 * 1000; // every 5 minutes; cheap (queries only, no fetches unless due)

export function startScheduler() {
  if (globalThis.__ryzeScheduler) return;
  globalThis.__ryzeScheduler = setInterval(() => {
    runDueChecks().catch((err) => console.error('[scheduler]', err.message));
  }, TICK_MS);
  // Don't keep the process alive just for the timer.
  globalThis.__ryzeScheduler.unref?.();
  console.log('[scheduler] started — tick every 5 min');
}
