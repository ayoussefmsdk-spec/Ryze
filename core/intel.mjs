// ============================================================================
// ClipHive intelligence layer — pure, testable logic. No I/O.
// - View-curve forensics (catch injected/bought views)
// - Engagement sanity bands (catch "50k views, 4 likes")
// - Money-state pipeline (Estimating / Pending / Locked / Paid)
// - ROI proof ("what this reach would've cost in ads")
// - Auto-written cycle recap (template prose, no LLM)
// - Pace & ETA math (velocity, days-to-cap)
// ============================================================================

// ---- View-curve forensics ---------------------------------------------------
/**
 * analyzeViewCurve(points) — points: [{t: epoch-ms, views: number}] ascending.
 * Flags an "injection" shape: one interval carrying almost all growth,
 * surrounded by near-flat intervals (organic clips rise then taper smoothly).
 * Returns { suspect, reason, spikeIndex } — conservative by design.
 */
export function analyzeViewCurve(points) {
  if (!Array.isArray(points) || points.length < 4) return { suspect: false, reason: 'insufficient_data' };
  const deltas = [];
  for (let i = 1; i < points.length; i++) {
    deltas.push({ i, gain: Math.max(0, points[i].views - points[i - 1].views) });
  }
  const total = deltas.reduce((a, d) => a + d.gain, 0);
  if (total < 5000) return { suspect: false, reason: 'too_small' }; // ignore tiny clips
  const max = deltas.reduce((a, d) => (d.gain > a.gain ? d : a), deltas[0]);
  const share = max.gain / total;
  // One interval carries ≥90% of ALL growth and its neighbours are dead flat.
  const before = deltas.filter((d) => d.i < max.i).reduce((a, d) => a + d.gain, 0);
  const after = deltas.filter((d) => d.i > max.i).reduce((a, d) => a + d.gain, 0);
  const neighboursDead = before + after < total * 0.1;
  if (share >= 0.9 && neighboursDead && deltas.length >= 3) {
    return { suspect: true, reason: 'single_interval_spike', spikeIndex: max.i };
  }
  // Flatline that suddenly resumes with a huge burst late in life.
  const lastQuarter = deltas.slice(Math.floor(deltas.length * 0.75));
  const lateGain = lastQuarter.reduce((a, d) => a + d.gain, 0);
  if (deltas.length >= 6 && before < total * 0.05 && max.i > deltas.length * 0.7 && lateGain > total * 0.9) {
    return { suspect: true, reason: 'late_burst_after_flatline', spikeIndex: max.i };
  }
  return { suspect: false, reason: 'organic' };
}

// ---- Engagement sanity band -------------------------------------------------
// Typical floor of (likes+comments)/views by platform. Real clips rarely fall
// below these; bought views usually do. Conservative to avoid false accusations.
export const ENGAGEMENT_FLOORS = {
  tiktok: 0.005,     // 0.5% — TikTok engagement is normally 3-10%
  youtube: 0.002,    // 0.2%
  instagram: 0.003,  // 0.3%
};

/**
 * engagementSuspect({ platform, views, likes, comments })
 * True when views are meaningful but engagement sits under the platform floor.
 * Null/hidden counts are NOT judged (absent data isn't evidence).
 */
export function engagementSuspect({ platform, views, likes, comments }) {
  const floor = ENGAGEMENT_FLOORS[platform];
  if (!floor) return false;
  const v = Number(views) || 0;
  if (v < 10000) return false;                 // small clips: not enough signal
  if (likes == null && comments == null) return false; // hidden counts: no verdict
  const eng = ((Number(likes) || 0) + (Number(comments) || 0)) / v;
  return eng < floor;
}

// ---- Money-state pipeline ---------------------------------------------------
/**
 * clipMoneyState({ status, flags, cycleStatus, paid })
 * -> 'paid' | 'locked' | 'estimating' | 'pending' | 'out'
 */
export function clipMoneyState({ status, flags = [], cycleStatus, paid = false }) {
  if (paid) return 'paid';
  if (status === 'rejected') return 'out';
  if (status === 'pending') return 'pending';
  if (flags.length > 0) return 'pending';        // approved but held by flags
  if (cycleStatus === 'frozen') return 'locked'; // final numbers — guaranteed
  return 'estimating';                            // approved, still growing
}

// ---- ROI proof --------------------------------------------------------------
// Conservative benchmark ad CPMs (what 1k impressions costs in paid ads, cents).
export const AD_CPM_CENTS = { tiktok: 1000, youtube: 2000, instagram: 1200, twitter: 650, other: 800 };

/**
 * roiProof({ viewsByPlatform: {platform: views}, paidCents })
 * -> { adEquivalentCents, multiple, costPer1kCents } (nulls when not computable)
 */
export function roiProof({ viewsByPlatform = {}, paidCents = 0 }) {
  let adEquivalentCents = 0;
  let totalViews = 0;
  for (const [plat, views] of Object.entries(viewsByPlatform)) {
    const v = Number(views) || 0;
    totalViews += v;
    adEquivalentCents += Math.round((v / 1000) * (AD_CPM_CENTS[plat] ?? AD_CPM_CENTS.other));
  }
  const multiple = paidCents > 0 ? Math.round((adEquivalentCents / paidCents) * 10) / 10 : null;
  const costPer1kCents = totalViews > 0 && paidCents > 0 ? Math.round(paidCents / (totalViews / 1000)) : null;
  return { adEquivalentCents, multiple, costPer1kCents, totalViews };
}

// ---- Auto-written recap -----------------------------------------------------
const money = (c) => `$${(Math.round(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const num = (n) => Number(n || 0).toLocaleString('en-US');

/**
 * writeRecap({ cycleName, campaignName, totalViews, clipCount, clipperCount,
 *              topPlatform, topPlatformShare, bestClip, paidCents, adEquivalentCents,
 *              multiple, prevViews })
 * Returns 3-5 plain-English sentences. Include only what's known.
 */
export function writeRecap(d) {
  const s = [];
  s.push(
    `${d.clipperCount} clipper${d.clipperCount === 1 ? '' : 's'} posted ${num(d.clipCount)} clip${d.clipCount === 1 ? '' : 's'} for ${d.campaignName}, reaching ${num(d.totalViews)} views.`,
  );
  if (d.topPlatform && d.topPlatformShare >= 0.34) {
    s.push(`${cap(d.topPlatform)} led the way with ${Math.round(d.topPlatformShare * 100)}% of all views.`);
  }
  if (d.bestClip?.views >= 1000) {
    const who = d.bestClip.handle ? `@${d.bestClip.handle}` : d.bestClip.clipper;
    s.push(`The breakout: a ${cap(d.bestClip.platform)} clip by ${who} at ${num(d.bestClip.views)} views on its own.`);
  }
  if (d.prevViews > 0 && d.totalViews > 0) {
    const x = d.totalViews / d.prevViews;
    if (x >= 1.15) s.push(`That's ${x >= 2 ? `${Math.round(x * 10) / 10}×` : `${Math.round((x - 1) * 100)}% more`} than the previous cycle.`);
    else if (x <= 0.85) s.push(`Reach came in below the previous cycle — worth a look at posting cadence.`);
  }
  if (d.paidCents > 0 && d.adEquivalentCents > d.paidCents) {
    s.push(`Total invested: ${money(d.paidCents)} — the same reach would cost roughly ${money(d.adEquivalentCents)} in paid ads (${d.multiple}× cheaper).`);
  }
  return s.join(' ');
}
function cap(x) { return String(x).charAt(0).toUpperCase() + String(x).slice(1); }

// ---- Pace & ETA -------------------------------------------------------------
/**
 * paceInfo({ series, budgetCapCents, totalPayoutCents, endsOn })
 * series: [{label:'YYYY-MM-DD', value: cumulative views}] ascending.
 * -> { viewsPerDay, daysToCap, capBeforeEnd } (nulls when unknowable)
 */
export function paceInfo({ series = [], budgetCapCents = 0, totalPayoutCents = 0, endsOn = null }) {
  if (series.length < 2) return { viewsPerDay: null, daysToCap: null, capBeforeEnd: false };
  const a = series[series.length - 2];
  const b = series[series.length - 1];
  const days = Math.max(1, (Date.parse(b.label) - Date.parse(a.label)) / 86400000);
  const viewsPerDay = Math.max(0, Math.round((b.value - a.value) / days));

  let daysToCap = null;
  let capBeforeEnd = false;
  if (budgetCapCents > 0 && totalPayoutCents > 0 && b.value > 0 && viewsPerDay > 0) {
    const centsPerView = totalPayoutCents / b.value;
    const centsPerDay = viewsPerDay * centsPerView;
    const remaining = budgetCapCents - totalPayoutCents;
    if (remaining > 0 && centsPerDay > 0) {
      daysToCap = Math.ceil(remaining / centsPerDay);
      if (endsOn) {
        const daysToEnd = Math.ceil((Date.parse(endsOn) - Date.now()) / 86400000);
        capBeforeEnd = daysToCap < daysToEnd;
      }
    } else if (remaining <= 0) {
      daysToCap = 0;
      capBeforeEnd = true;
    }
  }
  return { viewsPerDay, daysToCap, capBeforeEnd };
}
