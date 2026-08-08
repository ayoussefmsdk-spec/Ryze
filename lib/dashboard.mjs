// Cross-campaign aggregates for the Dashboard landing.
import { query } from './db.mjs';
import { computeCyclePayouts } from './payouts.mjs';

export async function getDashboard() {
  const [counts, activeCycles, paidRow, topClippers] = await Promise.all([
    query(`
      select
        (select count(*) from campaigns where not archived) as campaigns,
        (select count(*) from cycles where status = 'active') as active_cycles,
        (select count(*) from clippers where not archived) as clippers,
        (select count(*) from clips) as clips,
        (select count(*) from clips where status = 'pending') as pending,
        (select count(*) from clips where status <> 'rejected' and array_length(flags,1) > 0) as flagged
    `),
    query(`
      select cy.id, cy.name, cy.status, cy.ends_on, cy.payout_model, cy.budget_cap_cents,
             ca.name as campaign_name,
             coalesce(sum(c.views) filter (where c.status='approved'),0)::bigint as views,
             count(c.id) filter (where c.status='approved')::int as clips
        from cycles cy
        join campaigns ca on ca.id = cy.campaign_id
        left join clips c on c.cycle_id = cy.id
       where cy.status = 'active'
       group by cy.id, ca.name
       order by cy.ends_on asc
       limit 8
    `),
    query(`select coalesce(sum(amount_cents),0)::bigint as paid from payouts`),
    query(`
      select cl.id, cl.name, coalesce(sum(p.amount_cents),0)::bigint as paid
        from clippers cl
        left join payouts p on p.clipper_id = cl.id
       where not cl.archived
       group by cl.id
       order by paid desc
       limit 5
    `),
  ]);

  // Total owed = sum of each active cycle's computed payouts minus already paid.
  let totalViews = 0;
  let owedCents = 0;
  const cycleCards = [];
  for (const cy of activeCycles.rows) {
    let pay = null;
    try { pay = await computeCyclePayouts(cy.id); } catch { /* ignore */ }
    const total = pay?.totalPayoutCents ?? 0;
    totalViews += Number(cy.views);
    owedCents += total;
    cycleCards.push({
      ...cy,
      computedCents: total,
      budget: pay?.budget ?? { pct: 0, band: 'ok' },
    });
  }

  return {
    counts: counts.rows[0],
    totalViews,
    owedCents,
    paidCents: Number(paidRow.rows[0].paid),
    cycles: cycleCards,
    topClippers: topClippers.rows.filter((c) => Number(c.paid) > 0),
  };
}
