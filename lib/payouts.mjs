// Computes what everyone is owed for a cycle, under whichever payout model the
// cycle uses. Reads approved clips only. All amounts in integer cents.
import { query } from './db.mjs';
import {
  computeClipPayoutCents,
  computeClipperCycleTotalCents,
  computePotProportional,
  computePotEqual,
  computePlacement,
  computeFlatPerClip,
  applyAdjustments,
  budgetStatus,
} from '../core/payout.mjs';

/**
 * computeCyclePayouts(cycleId) -> {
 *   cycle, perClipper: [{clipperId, name, paymentHandle, views, clipCount, payoutCents, byPlatform}],
 *   perPlatform: [{platform, views, payoutCents}],
 *   totalViews, totalPayoutCents, budget: {pct, band, over}
 * }
 */
export async function computeCyclePayouts(cycleId) {
  const cycle = (await query(`select * from cycles where id = $1`, [cycleId])).rows[0];
  if (!cycle) throw new Error('Cycle not found');
  const cfg = cycle.payout_config || {};

  const { rows: clips } = await query(
    `select c.*, cl.name as clipper_name, cl.payment_handle
       from clips c join clippers cl on cl.id = c.clipper_id
      where c.cycle_id = $1 and c.status = 'approved'`,
    [cycleId],
  );
  const { rows: cpmRows } = await query(`select platform, cpm_cents from cycle_cpm where cycle_id = $1`, [cycleId]);
  const cpm = Object.fromEntries(cpmRows.map((r) => [r.platform, Number(r.cpm_cents)]));
  const { rows: adjRows } = await query(
    `select clipper_id, sum(amount_cents)::bigint as delta from payout_adjustments
      where cycle_id = $1 group by clipper_id`,
    [cycleId],
  );
  const adjustments = Object.fromEntries(adjRows.map((r) => [r.clipper_id, Number(r.delta)]));

  const minFloor = cycle.min_view_enabled ? Number(cycle.min_view_floor) : 0;

  // Group clips per clipper.
  const byClipper = new Map();
  for (const c of clips) {
    if (!byClipper.has(c.clipper_id)) {
      byClipper.set(c.clipper_id, { name: c.clipper_name, paymentHandle: c.payment_handle, clips: [] });
    }
    byClipper.get(c.clipper_id).clips.push(c);
  }

  // Per-clip payouts (CPM & flat show per-clip amounts; pot/placement are per-clipper).
  const clipPayouts = new Map(); // clipId -> cents
  let totals = new Map(); // clipperId -> cents

  if (cycle.payout_model === 'cpm') {
    for (const [clipperId, g] of byClipper) {
      const per = g.clips.map((c) => {
        const cents = computeClipPayoutCents({
          views: Number(c.views),
          cpmCents: cpm[c.platform] ?? 0,
          minViewFloor: minFloor,
          maxPerClipCents: cfg.maxPerClipCents ?? null,
          maxPaidViews: cfg.maxPaidViewsPerClip ?? null,
        });
        clipPayouts.set(c.id, cents);
        return cents;
      });
      totals.set(clipperId, computeClipperCycleTotalCents(per, cfg.maxPerClipperCents ?? null));
    }
  } else if (cycle.payout_model === 'flat_per_clip') {
    for (const [clipperId, g] of byClipper) {
      const entries = g.clips.map((c) => ({ key: c.id, views: Number(c.views) }));
      const out = computeFlatPerClip({
        amountCents: cfg.amountCents ?? 0,
        entries,
        qualifyMinViews: minFloor,
      });
      let sum = 0;
      for (const c of g.clips) { const v = out.get(c.id) ?? 0; clipPayouts.set(c.id, v); sum += v; }
      totals.set(clipperId, sum);
    }
  } else {
    // Pot / placement models operate on per-clipper totals. FACEBOOK views are
    // EXCLUDED from the money math here: FB is a free, track-only platform
    // (CPM 0 by design), and in share-based models its views would otherwise
    // silently shift pot money between clippers. Reach totals still count FB.
    const entries = [...byClipper.entries()].map(([clipperId, g]) => ({
      key: clipperId,
      views: g.clips.reduce((a, c) => a + (c.platform === 'facebook' ? 0 : Number(c.views)), 0),
    }));
    const qualify = cfg.qualifyMinViews ?? minFloor ?? 0;
    let out;
    if (cycle.payout_model === 'pot_proportional') {
      out = computePotProportional({
        potCents: cfg.potCents ?? Number(cycle.budget_cap_cents),
        entries,
        qualifyMinViews: qualify,
        maxPerClipperCents: cfg.maxPerClipperCents ?? null,
      });
    } else if (cycle.payout_model === 'pot_equal') {
      out = computePotEqual({
        potCents: cfg.potCents ?? Number(cycle.budget_cap_cents),
        entries,
        qualifyMinViews: qualify,
      });
    } else {
      out = computePlacement({
        prizesCents: cfg.prizesCents ?? [],
        entries,
        qualifyMinViews: qualify,
      });
    }
    totals = out;
  }

  totals = applyAdjustments(totals, adjustments);

  // Assemble result rows.
  const perClipper = [...byClipper.entries()].map(([clipperId, g]) => {
    const views = g.clips.reduce((a, c) => a + Number(c.views), 0);
    const byPlatform = {};
    for (const c of g.clips) {
      byPlatform[c.platform] ??= { views: 0, payoutCents: 0, clips: 0 };
      byPlatform[c.platform].views += Number(c.views);
      byPlatform[c.platform].clips += 1;
      byPlatform[c.platform].payoutCents += clipPayouts.get(c.id) ?? 0;
    }
    return {
      clipperId,
      name: g.name,
      paymentHandle: g.paymentHandle,
      views,
      clipCount: g.clips.length,
      payoutCents: totals.get(clipperId) ?? 0,
      byPlatform,
    };
  }).sort((a, b) => b.payoutCents - a.payoutCents || b.views - a.views);

  const perPlatformMap = new Map();
  for (const c of clips) {
    const p = perPlatformMap.get(c.platform) || { platform: c.platform, views: 0, payoutCents: 0, clips: 0 };
    p.views += Number(c.views);
    p.clips += 1;
    p.payoutCents += clipPayouts.get(c.id) ?? 0;
    perPlatformMap.set(c.platform, p);
  }

  const totalViews = clips.reduce((a, c) => a + Number(c.views), 0);
  const totalPayoutCents = [...totals.values()].reduce((a, b) => a + b, 0);

  return {
    cycle,
    perClipper,
    perPlatform: [...perPlatformMap.values()].sort((a, b) => b.views - a.views),
    clipPayouts: Object.fromEntries(clipPayouts),
    totalViews,
    totalPayoutCents,
    budget: budgetStatus(totalPayoutCents, Number(cycle.budget_cap_cents)),
  };
}
