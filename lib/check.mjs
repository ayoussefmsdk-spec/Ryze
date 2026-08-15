// The check runner — fetches fresh stats for clips, applies the guard checks,
// records history, and handles cycle freezing. Used by the "Check now" button,
// single-clip rechecks, fetch-on-submit, and the scheduler.
import { query } from './db.mjs';
import { extractYouTubeId } from '../core/platform.mjs';
import { evaluateFlags, classifyStatsAnomaly } from '../core/normalize.mjs';
import { computeEngagement } from '../core/payout.mjs';
import { analyzeViewCurve, engagementSuspect } from '../core/intel.mjs';
import { fetchYouTubeStats } from './fetchers/youtube.mjs';
import { fetchTikTokStats, fetchInstagramStats } from './fetchers/apify.mjs';

// Flags recomputed from fetched data each check; ingestion-time flags persist.
const FETCH_FLAGS = ['unknown_account', 'outside_dates', 'missing_hashtag', 'ig_suspect', 'view_drop', 'removed', 'fetch_failed', 'engagement_suspect', 'velocity_suspect', 'api_glitch'];

// Platforms fetched through Apify — the only source that can silently return
// bad numbers (zeroes / truncated stats) when the scraper is degraded.
const APIFY_PLATFORMS = new Set(['tiktok', 'instagram']);

/** 'YYYY-MM-DD' for "now" in an IANA timezone. */
export function todayInTz(tz) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** Load cycle with its campaign timezone resolved. */
export async function getCycleWithTz(cycleId) {
  const { rows } = await query(
    `select cy.*, coalesce(cy.timezone, ca.timezone) as effective_tz, ca.name as campaign_name
       from cycles cy join campaigns ca on ca.id = cy.campaign_id
      where cy.id = $1`,
    [cycleId],
  );
  return rows[0] || null;
}

/** True when the cycle's end date has passed in its timezone. */
export function isPastEnd(cycle) {
  return todayInTz(cycle.effective_tz) > String(cycle.ends_on);
}

/** Cycle context for evaluateFlags (camelCase shape the core expects). */
function flagCycle(cycle) {
  return {
    enforcePostWindow: cycle.enforce_post_window,
    startsOn: cycle.starts_on,
    endsOn: cycle.ends_on,
    hashtagMode: cycle.hashtag_mode,
    requiredHashtags: cycle.required_hashtags || [],
  };
}

/** Linked handles for one clipper+platform. */
async function knownHandles(clipperId, platform) {
  const { rows } = await query(
    `select handle from clipper_accounts where clipper_id = $1 and platform = $2`,
    [clipperId, platform],
  );
  return rows.map((r) => r.handle);
}

/** Apply fetched stats to one clip row: flags, views, history, auto-reject. */
async function applyStats(clip, cycle, stats) {
  // Apify glitch shield — a sudden zero or a big one-check drop on TikTok/IG is
  // almost always the scraper failing, not the audience vanishing. Keep the
  // last good numbers, skip the poisoned history point, and flag it precisely.
  // Dismissing the flag (✕) means "the drop is real — trust fetches again".
  if (
    APIFY_PLATFORMS.has(clip.platform) && clip.last_checked_at
    && !(clip.dismissed_flags || []).includes('api_glitch')
    && classifyStatsAnomaly({ prevViews: Number(clip.views), newViews: stats.views })
  ) {
    const { rows } = await query(
      `update clips set last_checked_at = now(), miss_streak = 0,
              flags = (select array(select distinct unnest(flags || '{api_glitch}'::text[])))
        where id = $1 returning *`,
      [clip.id],
    );
    return rows[0];
  }

  const accounts = await knownHandles(clip.clipper_id, clip.platform);
  const newFlags = evaluateFlags({
    stats,
    cycle: flagCycle(cycle),
    clipperAccounts: accounts,
    previousViews: clip.last_checked_at ? Number(clip.views) : null,
  });

  // IG safety: a suspect zero must never wipe out a manually verified number.
  const igSuspectZero = clip.platform === 'instagram' && stats.views === 0;
  const keepManual = igSuspectZero && clip.manual_override && Number(clip.views) > 0;

  const views = keepManual ? Number(clip.views) : stats.views;
  const engagement = computeEngagement({ views, likes: stats.likes, comments: stats.comments });

  // Fraud intelligence: engagement floor + view-curve forensics.
  if (engagementSuspect({ platform: clip.platform, views, likes: stats.likes, comments: stats.comments })) {
    newFlags.push('engagement_suspect');
  }
  const { rows: histRows } = await query(
    `select extract(epoch from checked_at)*1000 as t, views
       from view_history where clip_id = $1 order by checked_at asc limit 200`,
    [clip.id],
  );
  const curvePoints = [...histRows.map((r) => ({ t: Number(r.t), views: Number(r.views) })), { t: Date.now(), views }];
  if (analyzeViewCurve(curvePoints).suspect) newFlags.push('velocity_suspect');

  const kept = (clip.flags || []).filter((f) => !FETCH_FLAGS.includes(f));
  // Manager-dismissed flags never come back.
  const dismissed = new Set(clip.dismissed_flags || []);
  const flags = [...new Set([...kept, ...newFlags])].filter((f) => !dismissed.has(f));

  // Hashtag auto-reject (only demotes pending clips; approved stays your call).
  let status = clip.status;
  if (cycle.hashtag_mode === 'auto_reject' && flags.includes('missing_hashtag') && status === 'pending') {
    status = 'rejected';
  }

  const { rows } = await query(
    `update clips set
        views = $1, likes = $2, comments = $3, engagement = $4,
        account_handle = coalesce($5, account_handle),
        caption = coalesce($6, caption),
        posted_at = coalesce($7, posted_at),
        thumbnail_url = coalesce($8, thumbnail_url),
        last_checked_at = now(), miss_streak = 0,
        source = case when $12 then source else 'auto' end,
        manual_override = case when $12 then manual_override else false end,
        flags = $9, status = $10
      where id = $11
      returning *`,
    [
      views, stats.likes, stats.comments, engagement,
      stats.accountHandle, stats.caption, stats.postedAt, stats.thumbnailUrl,
      flags, status, clip.id, keepManual,
    ],
  );
  await query(
    `insert into view_history (clip_id, views, likes, comments) values ($1,$2,$3,$4)`,
    [clip.id, views, stats.likes, stats.comments],
  );
  return rows[0];
}

/** Mark a clip's fetch as failed without losing its last known numbers.
 *  Respects manager-dismissed flags. */
async function markFailed(clipId, flag) {
  await query(
    `update clips set flags = (select array(select distinct unnest(flags || $1::text[])))
      where id = $2 and not ($3 = any(dismissed_flags))`,
    [[flag], clipId, flag],
  );
}

/** Second duplicate-detection layer, independent of the ingest paths: every
 *  check run re-scans the whole cycle and flags any extra copies of the same
 *  video (all but the earliest). Catches anything that ever slips through —
 *  races, rescues, old data. Respects manager-dismissed flags. */
async function sweepDuplicates(cycleId) {
  const { rows } = await query(
    `update clips c
        set flags = (select array(select distinct unnest(c.flags || '{duplicate}'::text[])))
      where c.cycle_id = $1
        and not ('duplicate' = any(c.flags))
        and not ('duplicate' = any(c.dismissed_flags))
        and exists (select 1 from clips e
                     where e.cycle_id = c.cycle_id and e.normalized_key = c.normalized_key
                       and e.id <> c.id
                       and (e.created_at < c.created_at or (e.created_at = c.created_at and e.id < c.id)))
      returning c.id`,
    [cycleId],
  );
  return rows.length;
}

/** A paid (Apify) batch succeeded but this post wasn't in it. One miss is a
 *  scraper hiccup ("check failed"); two IN A ROW means the post is really
 *  gone/private ("video removed?"). A successful fetch resets the streak. */
async function recordPaidMiss(clip) {
  const streak = Number(clip.miss_streak || 0) + 1;
  await query(`update clips set miss_streak = $1 where id = $2`, [streak, clip.id]);
  if (streak >= 2) {
    await query(`update clips set flags = array_remove(flags, 'fetch_failed') where id = $1`, [clip.id]);
    await markFailed(clip.id, 'removed');
  } else {
    await markFailed(clip.id, 'fetch_failed');
  }
}

/** Guard: how many paid (Apify) fetches happened today vs the cap. */
async function paidBudgetLeft() {
  const { rows: capRows } = await query(`select apify_daily_cap from app_settings where id = 1`);
  const cap = capRows[0]?.apify_daily_cap ?? 200;
  const { rows } = await query(
    `select count(*)::int as used
       from view_history vh join clips c on c.id = vh.clip_id
      where c.platform in ('tiktok','instagram') and vh.checked_at::date = current_date`,
  );
  return Math.max(0, cap - (rows[0]?.used ?? 0));
}

/**
 * runCheck(cycleId, { scope }) — scope: 'free' (YouTube only) | 'all'.
 * Returns a summary { checked, failed, skipped, frozen }.
 * Handles freeze: when the end date has passed, runs one final capture, then
 * marks the cycle frozen so future checks skip it.
 */
export async function runCheck(cycleId, { scope = 'all' } = {}) {
  const cycle = await getCycleWithTz(cycleId);
  if (!cycle) throw new Error('Cycle not found');
  if (cycle.status === 'frozen') return { frozen: true, checked: 0, failed: 0, skipped: 0 };

  const dueFreeze = cycle.status === 'active' && isPastEnd(cycle);

  const { rows: clips } = await query(
    `select * from clips where cycle_id = $1 and status in ('pending','approved')`,
    [cycleId],
  );

  let checked = 0;
  let failed = 0;
  let skipped = 0;

  // ---- YouTube (free) -------------------------------------------------------
  const ytClips = clips.filter((c) => c.platform === 'youtube');
  if (ytClips.length) {
    try {
      const ids = ytClips.map((c) => extractYouTubeId(c.url)).filter(Boolean);
      const { stats, missing } = await fetchYouTubeStats(ids);
      for (const clip of ytClips) {
        const id = extractYouTubeId(clip.url);
        if (id && stats.has(id)) {
          await applyStats(clip, cycle, stats.get(id));
          checked++;
        } else if (id && missing.has(id)) {
          await markFailed(clip.id, 'removed');
          failed++;
        }
      }
    } catch {
      for (const clip of ytClips) await markFailed(clip.id, 'fetch_failed');
      failed += ytClips.length;
    }
  }

  // ---- TikTok + Instagram (paid, only when scope allows) --------------------
  if (scope === 'all') {
    let budget = await paidBudgetLeft();
    for (const [platform, fetcher] of [
      ['tiktok', fetchTikTokStats],
      ['instagram', fetchInstagramStats],
    ]) {
      const group = clips.filter((c) => c.platform === platform);
      if (!group.length) continue;
      if (budget < group.length) { skipped += group.length; continue; } // spend cap
      budget -= group.length;
      try {
        const stats = await fetcher(group.map((c) => c.url));
        for (const clip of group) {
          const s = stats.get(clip.normalized_key);
          if (s) { await applyStats(clip, cycle, s); checked++; }
          // Batch succeeded but this post came back empty. Could be deleted —
          // or Apify degrading. Two consecutive misses before "removed".
          else { await recordPaidMiss(clip); failed++; }
        }
      } catch {
        for (const clip of group) await markFailed(clip.id, 'fetch_failed');
        failed += group.length;
      }
    }
  } else {
    skipped += clips.filter((c) => c.platform === 'tiktok' || c.platform === 'instagram').length;
  }

  // Twitter/other are manual-only — never fetched.

  // Duplicate safety net — flags any same-video copies that ever slipped in.
  const dupesFlagged = await sweepDuplicates(cycleId);

  if (dueFreeze) {
    await query(
      `update cycles set status = 'frozen', freeze_at = now() where id = $1 and status = 'active'`,
      [cycleId],
    );
    await query(
      `insert into cycle_changes (cycle_id, field, old_value, new_value, note)
         values ($1, 'status', 'active', 'frozen', 'End date passed — final capture done, tracking stopped')`,
      [cycleId],
    );
  }

  return { checked, failed, skipped, frozen: dueFreeze, dupesFlagged };
}

/** Fetch stats for ONE clip (recheck button / fetch-on-submit). */
export async function fetchSingleClip(clipId) {
  const { rows } = await query(`select * from clips where id = $1`, [clipId]);
  const clip = rows[0];
  if (!clip) throw new Error('Clip not found');
  const cycle = await getCycleWithTz(clip.cycle_id);
  if (!cycle || cycle.status === 'frozen') return clip;

  if (clip.platform === 'youtube') {
    const id = extractYouTubeId(clip.url);
    if (!id) throw new Error('Could not read a video id from this URL');
    const { stats, missing } = await fetchYouTubeStats([id]);
    if (stats.has(id)) return applyStats(clip, cycle, stats.get(id));
    if (missing.has(id)) { await markFailed(clip.id, 'removed'); }
    return clip;
  }
  if (clip.platform === 'tiktok' || clip.platform === 'instagram') {
    if ((await paidBudgetLeft()) < 1) throw new Error('Daily paid-check cap reached');
    const fetcher = clip.platform === 'tiktok' ? fetchTikTokStats : fetchInstagramStats;
    const stats = await fetcher([clip.url]);
    const s = stats.get(clip.normalized_key);
    if (s) return applyStats(clip, cycle, s);
    await recordPaidMiss(clip); // fetch ran, post not there — removed after 2 misses
    return clip;
  }
  // twitter/other: manual platforms — nothing to fetch.
  return clip;
}
