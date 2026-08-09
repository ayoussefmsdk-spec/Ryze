// Assembles the cycle "intelligence band" data from existing queries.
import { query } from './db.mjs';
import { roiProof, writeRecap, paceInfo, clipMoneyState } from '../core/intel.mjs';

/**
 * cycleIntel({ cycle, payouts, series, clips })
 * cycle: row w/ campaign_name; payouts: computeCyclePayouts result;
 * series: cycleDailySeries result; clips: full clip rows for the cycle.
 * Returns { recap, roi, pace, moneyStates } ready for <IntelBand/>.
 */
export async function cycleIntel({ cycle, payouts, series, clips }) {
  // ROI — views by platform from approved clips.
  const viewsByPlatform = {};
  for (const p of payouts.perPlatform) viewsByPlatform[p.platform] = p.views;
  const roi = roiProof({ viewsByPlatform, paidCents: payouts.totalPayoutCents });

  // Previous cycle in the same campaign (for the comparison sentence).
  const prev = (await query(
    `select cy.id from cycles cy
      where cy.campaign_id = $1 and cy.ends_on < $2
      order by cy.ends_on desc limit 1`,
    [cycle.campaign_id, cycle.ends_on],
  )).rows[0];
  let prevViews = 0;
  if (prev) {
    prevViews = Number((await query(
      `select coalesce(sum(views),0)::bigint as v from clips where cycle_id = $1 and status = 'approved'`,
      [prev.id],
    )).rows[0].v);
  }

  // Breakout clip.
  const approved = clips.filter((c) => c.status === 'approved');
  const best = approved.reduce((a, c) => (Number(c.views) > Number(a?.views || 0) ? c : a), null);
  const top = payouts.perPlatform[0];

  const recap = payouts.totalViews > 0
    ? writeRecap({
        campaignName: cycle.campaign_name,
        cycleName: cycle.name,
        totalViews: payouts.totalViews,
        clipCount: approved.length,
        clipperCount: payouts.perClipper.length,
        topPlatform: top?.platform,
        topPlatformShare: top && payouts.totalViews > 0 ? top.views / payouts.totalViews : 0,
        bestClip: best ? { platform: best.platform, handle: best.account_handle, clipper: best.clipper_name, views: Number(best.views) } : null,
        paidCents: payouts.totalPayoutCents,
        adEquivalentCents: roi.adEquivalentCents,
        multiple: roi.multiple,
        prevViews,
      })
    : null;

  const pace = cycle.status === 'active'
    ? paceInfo({
        series,
        budgetCapCents: Number(cycle.budget_cap_cents),
        totalPayoutCents: payouts.totalPayoutCents,
        endsOn: cycle.ends_on,
      })
    : null;

  // Money-state pipeline over the whole cycle.
  const paidSet = new Set(
    (await query(`select clipper_id from payouts where cycle_id = $1`, [cycle.id])).rows.map((r) => r.clipper_id),
  );
  const byState = {};
  for (const c of clips) {
    const cents = payouts.clipPayouts[c.id] ?? 0;
    if (!cents) continue;
    const state = clipMoneyState({
      status: c.status,
      flags: c.flags || [],
      cycleStatus: cycle.status,
      paid: paidSet.has(c.clipper_id),
    });
    byState[state] = (byState[state] || 0) + cents;
  }
  const moneyStates = ['paid', 'locked', 'estimating', 'pending'].map((s) => ({ state: s, cents: byState[s] || 0 }));

  // Structured facts for the stat-case band (the prose recap stays available
  // for the public watch room, which reads better as a sentence there).
  const facts = payouts.totalViews > 0 ? {
    clipperCount: payouts.perClipper.length,
    clipCount: approved.length,
    totalViews: payouts.totalViews,
    topPlatform: top ? { platform: top.platform, sharePct: Math.round((top.views / payouts.totalViews) * 100) } : null,
    bestClip: best ? { platform: best.platform, handle: best.account_handle, clipper: best.clipper_name, views: Number(best.views) } : null,
    investedCents: payouts.totalPayoutCents,
    adEquivalentCents: roi.adEquivalentCents,
    multiple: roi.multiple,
    costPer1kCents: roi.costPer1kCents,
    prevViews,
    deltaPct: prevViews > 0 ? Math.round(((payouts.totalViews - prevViews) / prevViews) * 100) : null,
  } : null;

  return { recap, facts, roi, pace, moneyStates };
}
