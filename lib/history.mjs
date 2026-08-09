// Daily view-total series from view_history (powers the growth charts and the
// projected-spend estimate). Each day's value = the day's last recorded views
// summed across clips; days without any check for a clip simply reflect the
// clips that were checked (with scheduled checks this is all of them).
import { query } from './db.mjs';

/** Daily total-views series for a cycle. [{label:'YYYY-MM-DD', value}] */
export async function cycleDailySeries(cycleId) {
  const { rows } = await query(
    `select day, sum(mx)::bigint as total from (
        select vh.clip_id, vh.checked_at::date as day, max(vh.views) as mx
          from view_history vh
          join clips c on c.id = vh.clip_id
         where c.cycle_id = $1 and c.status = 'approved'
         group by vh.clip_id, vh.checked_at::date
     ) t group by day order by day`,
    [cycleId],
  );
  return rows.map((r) => ({ label: String(r.day), value: Number(r.total) }));
}

/** Daily total-views series across ALL cycles of one campaign. */
export async function campaignDailySeries(campaignId) {
  const { rows } = await query(
    `select day, sum(mx)::bigint as total from (
        select vh.clip_id, vh.checked_at::date as day, max(vh.views) as mx
          from view_history vh
          join clips c on c.id = vh.clip_id
          join cycles cy on cy.id = c.cycle_id
         where cy.campaign_id = $1 and c.status = 'approved'
         group by vh.clip_id, vh.checked_at::date
     ) t group by day order by day`,
    [campaignId],
  );
  return rows.map((r) => ({ label: String(r.day), value: Number(r.total) }));
}

/** Daily total-views series across the whole hive (last N days). */
export async function hiveDailySeries(days = 30) {
  const { rows } = await query(
    `select day, sum(mx)::bigint as total from (
        select vh.clip_id, vh.checked_at::date as day, max(vh.views) as mx
          from view_history vh
          join clips c on c.id = vh.clip_id
         where c.status = 'approved' and vh.checked_at > now() - ($1 || ' days')::interval
         group by vh.clip_id, vh.checked_at::date
     ) t group by day order by day`,
    [String(days)],
  );
  return rows.map((r) => ({ label: String(r.day), value: Number(r.total) }));
}

/** Daily total-views series for ONE clipper within ONE cycle. */
export async function clipperCycleDailySeries(clipperId, cycleId) {
  const { rows } = await query(
    `select day, sum(mx)::bigint as total from (
        select vh.clip_id, vh.checked_at::date as day, max(vh.views) as mx
          from view_history vh
          join clips c on c.id = vh.clip_id
         where c.clipper_id = $1 and c.cycle_id = $2 and c.status = 'approved'
         group by vh.clip_id, vh.checked_at::date
     ) t group by day order by day`,
    [clipperId, cycleId],
  );
  return rows.map((r) => ({ label: String(r.day), value: Number(r.total) }));
}

/**
 * Clips POSTED per calendar day (the platform's post date, not app submission).
 * posted_at comes from the platform fetch; clips we haven't fetched a date for
 * yet fall back to their submission day. Rejected clips don't count.
 * Scope by cycle and/or clipper via the options.
 */
export async function clipsPostedPerDay({ cycleId = null, clipperId = null } = {}) {
  const wheres = [`c.status <> 'rejected'`];
  const vals = [];
  if (cycleId) { vals.push(cycleId); wheres.push(`c.cycle_id = $${vals.length}`); }
  if (clipperId) { vals.push(clipperId); wheres.push(`c.clipper_id = $${vals.length}`); }
  const { rows } = await query(
    `select coalesce(c.posted_at::date, c.created_at::date) as day, count(*)::int as n
       from clips c
      where ${wheres.join(' and ')}
      group by day order by day`,
    vals,
  );
  return rows.map((r) => ({ label: String(r.day), value: Number(r.n) }));
}

/** Daily total-views series for one clipper across everything. */
export async function clipperDailySeries(clipperId) {
  const { rows } = await query(
    `select day, sum(mx)::bigint as total from (
        select vh.clip_id, vh.checked_at::date as day, max(vh.views) as mx
          from view_history vh
          join clips c on c.id = vh.clip_id
         where c.clipper_id = $1 and c.status = 'approved'
         group by vh.clip_id, vh.checked_at::date
     ) t group by day order by day`,
    [clipperId],
  );
  return rows.map((r) => ({ label: String(r.day), value: Number(r.total) }));
}

/**
 * Rough projected end-of-cycle payout for money-per-view models.
 * Uses the last two daily datapoints as velocity. Returns cents or null.
 */
export function projectSpend({ series, endsOn, totalPayoutCents, totalViews }) {
  if (!series || series.length < 2 || !totalViews || !totalPayoutCents) return null;
  const a = series[series.length - 2];
  const b = series[series.length - 1];
  const days = Math.max(1, (Date.parse(b.label) - Date.parse(a.label)) / 86400000);
  const dailyGain = Math.max(0, (b.value - a.value) / days);
  const daysLeft = Math.max(0, Math.ceil((Date.parse(endsOn) - Date.now()) / 86400000));
  if (!daysLeft || !dailyGain) return null;
  const centsPerView = totalPayoutCents / totalViews; // blended effective rate
  return Math.round(totalPayoutCents + dailyGain * daysLeft * centsPerView);
}
