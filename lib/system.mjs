// System health snapshot — integrations, spend guard, scheduler activity.
import { query } from './db.mjs';

/** Apify integration health from app_settings row → plain flags for the UI.
 *  "Failing" = the most recent Apify call errored (error newer than success). */
export function apifyHealth(row) {
  const okAt = row?.apify_ok_at ? new Date(row.apify_ok_at) : null;
  const errAt = row?.apify_error_at ? new Date(row.apify_error_at) : null;
  return {
    apifyOkAt: okAt ? okAt.toISOString() : null,
    apifyErrorAt: errAt ? errAt.toISOString() : null,
    apifyError: row?.apify_error || null,
    apifyFailing: Boolean(errAt && (!okAt || errAt > okAt)),
  };
}

export async function getSystemStatus() {
  const [settings, usage, lastCheck, counts] = await Promise.all([
    query(`select apify_daily_cap, apify_cents_per_1k, apify_ok_at, apify_error_at, apify_error from app_settings where id = 1`),
    query(
      `select count(*)::int as used from view_history vh
        join clips c on c.id = vh.clip_id
       where c.platform in ('tiktok','instagram') and vh.checked_at::date = current_date`,
    ),
    query(`select max(checked_at) as last from view_history`),
    query(`
      select
        (select count(*) from cycles where status = 'active') as active_cycles,
        (select count(*) from cycles where status = 'active' and auto_check_enabled) as scheduled_cycles,
        (select count(*) from viewer_codes where not revoked and expires_at > now()) as live_codes
    `),
  ]);
  return {
    youtubeKey: Boolean(process.env.YOUTUBE_API_KEY),
    apifyToken: Boolean(process.env.APIFY_TOKEN),
    dbOk: true,
    apifyDailyCap: settings.rows[0]?.apify_daily_cap ?? 200,
    apifyCentsPer1k: Number(settings.rows[0]?.apify_cents_per_1k) || 420,
    ...apifyHealth(settings.rows[0]),
    paidChecksToday: usage.rows[0]?.used ?? 0,
    lastCheckAt: lastCheck.rows[0]?.last ?? null,
    activeCycles: Number(counts.rows[0]?.active_cycles ?? 0),
    scheduledCycles: Number(counts.rows[0]?.scheduled_cycles ?? 0),
    liveViewerCodes: Number(counts.rows[0]?.live_codes ?? 0),
  };
}
