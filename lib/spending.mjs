// Spending analytics: API costs (Apify paid checks), YouTube usage (free),
// clipper payouts, and system storage — per day, per month, per campaign.
import { query } from './db.mjs';
import { estimateScanCostCents } from '../core/scan.mjs';

/** Cents per paid (TikTok/IG) post-check — same rate the scanner uses. */
export const PAID_CHECK_CENTS_PER_1000 = 160;
export const costForChecks = (n) => estimateScanCostCents({ paidPosts: n });

/** 'YYYY-MM' for now, and helpers. */
export function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}
export function monthChoices(n = 6) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  }
  return out;
}

const monthRange = (month) => [`${month}-01`, `${month}-01`]; // [start, start+1mo) via interval

/**
 * getSpending(month: 'YYYY-MM') — everything the Spending hub shows.
 */
export async function getSpending(month) {
  const [start] = monthRange(month);

  const [paidDaily, ytDaily, payoutDaily, perCampaign, totals, storage] = await Promise.all([
    // Paid (Apify) post-checks per day in the month.
    query(
      `select vh.checked_at::date as day, count(*)::int as n
         from view_history vh join clips c on c.id = vh.clip_id
        where c.platform in ('tiktok','instagram')
          and vh.checked_at >= $1::date and vh.checked_at < $1::date + interval '1 month'
        group by day order by day`,
      [start],
    ),
    // YouTube post-checks per day (free — usage, not cost).
    query(
      `select vh.checked_at::date as day, count(*)::int as n
         from view_history vh join clips c on c.id = vh.clip_id
        where c.platform = 'youtube'
          and vh.checked_at >= $1::date and vh.checked_at < $1::date + interval '1 month'
        group by day order by day`,
      [start],
    ),
    // Clipper payouts per day in the month.
    query(
      `select paid_at::date as day, sum(amount_cents)::bigint as cents
         from payouts
        where paid_at >= $1::date and paid_at < $1::date + interval '1 month'
        group by day order by day`,
      [start],
    ),
    // Per-campaign: payouts + paid checks, month and all-time.
    query(
      `select ca.id, ca.name, ca.avatar_url,
              coalesce((select sum(p.amount_cents) from payouts p
                 join cycles cy2 on cy2.id = p.cycle_id
                where cy2.campaign_id = ca.id
                  and p.paid_at >= $1::date and p.paid_at < $1::date + interval '1 month'), 0)::bigint as payout_month_cents,
              coalesce((select sum(p.amount_cents) from payouts p
                 join cycles cy3 on cy3.id = p.cycle_id
                where cy3.campaign_id = ca.id), 0)::bigint as payout_all_cents,
              coalesce((select count(*) from view_history vh
                 join clips c on c.id = vh.clip_id
                 join cycles cy4 on cy4.id = c.cycle_id
                where cy4.campaign_id = ca.id and c.platform in ('tiktok','instagram')
                  and vh.checked_at >= $1::date and vh.checked_at < $1::date + interval '1 month'), 0)::int as paid_checks_month,
              coalesce((select count(*) from view_history vh
                 join clips c on c.id = vh.clip_id
                 join cycles cy5 on cy5.id = c.cycle_id
                where cy5.campaign_id = ca.id and c.platform in ('tiktok','instagram')), 0)::int as paid_checks_all
         from campaigns ca
        where not ca.archived
        order by payout_all_cents desc, ca.name`,
      [start],
    ),
    // Global counters.
    query(
      `select
         (select count(*) from view_history vh join clips c on c.id = vh.clip_id
           where c.platform in ('tiktok','instagram')) as paid_checks_all,
         (select count(*) from view_history vh join clips c on c.id = vh.clip_id
           where c.platform = 'youtube') as yt_checks_all,
         (select coalesce(sum(amount_cents),0) from payouts) as payout_all,
         (select count(*) from view_history) as history_rows,
         (select count(*) from clips) as clips_rows`,
    ),
    // Storage actually used by our database.
    query(`select pg_database_size(current_database()) as bytes`),
  ]);

  const paidChecksMonth = paidDaily.rows.reduce((a, r) => a + Number(r.n), 0);
  const ytChecksMonth = ytDaily.rows.reduce((a, r) => a + Number(r.n), 0);
  const payoutMonthCents = payoutDaily.rows.reduce((a, r) => a + Number(r.cents), 0);

  return {
    month,
    apiDaily: paidDaily.rows.map((r) => ({ label: String(r.day), value: costForChecks(Number(r.n)) })), // cents/day
    checksDaily: paidDaily.rows.map((r) => ({ label: String(r.day), value: Number(r.n) })),
    ytDaily: ytDaily.rows.map((r) => ({ label: String(r.day), value: Number(r.n) })),
    payoutDaily: payoutDaily.rows.map((r) => ({ label: String(r.day), value: Number(r.cents) })),
    paidChecksMonth,
    apiCostMonthCents: costForChecks(paidChecksMonth),
    ytChecksMonth,
    payoutMonthCents,
    perCampaign: perCampaign.rows.map((r) => ({
      id: r.id, name: r.name, avatar: r.avatar_url,
      payoutMonthCents: Number(r.payout_month_cents),
      payoutAllCents: Number(r.payout_all_cents),
      paidChecksMonth: Number(r.paid_checks_month),
      apiCostMonthCents: costForChecks(Number(r.paid_checks_month)),
      paidChecksAll: Number(r.paid_checks_all),
      apiCostAllCents: costForChecks(Number(r.paid_checks_all)),
    })),
    totals: {
      paidChecksAll: Number(totals.rows[0].paid_checks_all),
      apiCostAllCents: costForChecks(Number(totals.rows[0].paid_checks_all)),
      ytChecksAll: Number(totals.rows[0].yt_checks_all),
      payoutAllCents: Number(totals.rows[0].payout_all),
      historyRows: Number(totals.rows[0].history_rows),
      clipsRows: Number(totals.rows[0].clips_rows),
    },
    dbBytes: Number(storage.rows[0].bytes),
  };
}
