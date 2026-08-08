// Report data assembly — campaign all-time and clipper reports (all-time or
// scoped to one campaign). Reuses existing tables; money = cents.
import { query } from './db.mjs';

/** Campaign all-time: every cycle's settled numbers + rollups. */
export async function campaignReport(campaignId) {
  const campaign = (await query(`select * from campaigns where id = $1`, [campaignId])).rows[0];
  if (!campaign) return null;

  const { rows: cycles } = await query(
    `select cy.id, cy.name, cy.starts_on, cy.ends_on, cy.status, cy.payout_model,
            coalesce(sum(c.views) filter (where c.status='approved'),0)::bigint as views,
            count(c.id) filter (where c.status='approved')::int as clips,
            count(distinct c.clipper_id) filter (where c.status='approved')::int as clippers,
            coalesce(sum(c.likes) filter (where c.status='approved' and c.likes is not null),0)::bigint as likes,
            coalesce(sum(c.comments) filter (where c.status='approved' and c.comments is not null),0)::bigint as comments,
            (select coalesce(sum(p.amount_cents),0) from payouts p where p.cycle_id = cy.id)::bigint as paid
       from cycles cy left join clips c on c.cycle_id = cy.id
      where cy.campaign_id = $1
      group by cy.id order by cy.starts_on asc`,
    [campaignId],
  );

  const { rows: platforms } = await query(
    `select c.platform,
            coalesce(sum(c.views),0)::bigint as views,
            count(*)::int as clips
       from clips c join cycles cy on cy.id = c.cycle_id
      where cy.campaign_id = $1 and c.status = 'approved'
      group by c.platform order by views desc`,
    [campaignId],
  );

  const { rows: topClippers } = await query(
    `select cl.id, cl.name,
            coalesce(sum(c.views),0)::bigint as views,
            count(c.id)::int as clips,
            (select coalesce(sum(p.amount_cents),0) from payouts p
              join cycles pc on pc.id = p.cycle_id
             where p.clipper_id = cl.id and pc.campaign_id = $1)::bigint as paid
       from clips c
       join clippers cl on cl.id = c.clipper_id
       join cycles cy on cy.id = c.cycle_id
      where cy.campaign_id = $1 and c.status = 'approved'
      group by cl.id order by views desc limit 25`,
    [campaignId],
  );

  const totals = cycles.reduce((a, r) => ({
    views: a.views + Number(r.views), clips: a.clips + r.clips,
    paid: a.paid + Number(r.paid), likes: a.likes + Number(r.likes), comments: a.comments + Number(r.comments),
  }), { views: 0, clips: 0, paid: 0, likes: 0, comments: 0 });
  totals.engagement = totals.views > 0 && (totals.likes + totals.comments) > 0
    ? (totals.likes + totals.comments) / totals.views : null;

  return { campaign, cycles, platforms, topClippers, totals };
}

/** Clipper report — all-time, or scoped to one campaign (with per-clip detail). */
export async function clipperReport(clipperId, campaignId = null) {
  const clipper = (await query(`select * from clippers where id = $1`, [clipperId])).rows[0];
  if (!clipper) return null;
  const scope = campaignId ? `and ca.id = $2` : '';
  const args = campaignId ? [clipperId, campaignId] : [clipperId];

  const campaign = campaignId
    ? (await query(`select * from campaigns where id = $1`, [campaignId])).rows[0]
    : null;

  // Per-cycle rows for this clipper.
  const { rows: cycles } = await query(
    `select cy.id, cy.name, cy.starts_on, cy.ends_on, cy.status, ca.name as campaign_name,
            coalesce(sum(c.views) filter (where c.status='approved'),0)::bigint as views,
            count(c.id) filter (where c.status='approved')::int as clips,
            coalesce(sum(c.likes) filter (where c.status='approved'),0)::bigint as likes,
            coalesce(sum(c.comments) filter (where c.status='approved'),0)::bigint as comments,
            (select coalesce(sum(p.amount_cents),0) from payouts p
              where p.cycle_id = cy.id and p.clipper_id = $1)::bigint as paid
       from clips c
       join cycles cy on cy.id = c.cycle_id
       join campaigns ca on ca.id = cy.campaign_id
      where c.clipper_id = $1 ${scope}
      group by cy.id, ca.name order by cy.starts_on asc`,
    args,
  );

  // Per-campaign rollup (only meaningful for the all-time report).
  const { rows: campaigns } = await query(
    `select ca.id, ca.name,
            coalesce(sum(c.views) filter (where c.status='approved'),0)::bigint as views,
            count(c.id) filter (where c.status='approved')::int as clips,
            (select coalesce(sum(p.amount_cents),0) from payouts p
              join cycles pc on pc.id = p.cycle_id
             where p.clipper_id = $1 and pc.campaign_id = ca.id)::bigint as paid
       from clips c
       join cycles cy on cy.id = c.cycle_id
       join campaigns ca on ca.id = cy.campaign_id
      where c.clipper_id = $1 ${scope}
      group by ca.id order by paid desc`,
    args,
  );

  // Per-clip detail only when scoped to one campaign (keeps all-time compact).
  let clips = [];
  if (campaignId) {
    ({ rows: clips } = await query(
      `select c.platform, c.url, c.account_handle, c.views, c.likes, c.comments,
              c.engagement, c.status, cy.name as cycle_name
         from clips c
         join cycles cy on cy.id = c.cycle_id
         join campaigns ca on ca.id = cy.campaign_id
        where c.clipper_id = $1 ${scope}
        order by cy.starts_on asc, c.views desc`,
      args,
    ));
  }

  const totals = cycles.reduce((a, r) => ({
    views: a.views + Number(r.views), clips: a.clips + r.clips, paid: a.paid + Number(r.paid),
    likes: a.likes + Number(r.likes), comments: a.comments + Number(r.comments),
  }), { views: 0, clips: 0, paid: 0, likes: 0, comments: 0 });
  totals.engagement = totals.views > 0 && (totals.likes + totals.comments) > 0
    ? (totals.likes + totals.comments) / totals.views : null;

  return { clipper, campaign, cycles, campaigns, clips, totals };
}
