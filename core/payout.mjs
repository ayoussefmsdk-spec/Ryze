// ============================================================================
// ClipHive — payout + engagement math (pure, no I/O)
// ============================================================================
// All money is in integer CENTS. CPM is dollars-per-1000-views, also stored in
// cents (cpm_cents). Rounding rule: each clip's payout is rounded to the nearest
// cent, and totals are the sum of those rounded per-clip amounts — so the number
// you see per clip is exactly what adds up, with no penny drift.
// ============================================================================

/**
 * computeClipPayoutCents({ views, cpmCents, minViewFloor, maxPerClipCents })
 *   payout = round(views / 1000 * cpmCents), then:
 *     - 0 if views are below an enabled floor
 *     - capped at maxPerClipCents when that cap is set
 */
export function computeClipPayoutCents({ views, cpmCents, minViewFloor = 0, maxPerClipCents = null }) {
  const v = toNonNegInt(views);
  const cpm = toNonNegInt(cpmCents);
  if (minViewFloor && v < minViewFloor) return 0;
  // views * cpm / 1000, rounded to the nearest cent.
  let cents = Math.round((v * cpm) / 1000);
  if (maxPerClipCents != null && cents > maxPerClipCents) cents = maxPerClipCents;
  return cents;
}

/**
 * computeClipperCycleTotalCents(clipPayoutCents[], maxPerClipperCents)
 * Sum of already-rounded per-clip payouts, capped per clipper if set.
 */
export function computeClipperCycleTotalCents(clipPayoutCents, maxPerClipperCents = null) {
  let sum = 0;
  for (const c of clipPayoutCents) sum += toNonNegInt(c);
  if (maxPerClipperCents != null && sum > maxPerClipperCents) sum = maxPerClipperCents;
  return sum;
}

/**
 * computeEngagement({ views, likes, comments }) -> fraction | null
 * (likes + comments) / views. Missing likes/comments are treated as UNKNOWN,
 * not zero: if both are unknown, engagement is null (rendered as "—"); if only
 * one is known, the other is left out rather than assumed 0-and-counted.
 * Returns a fraction rounded to 4 dp (e.g. 0.0062 -> show as 0.62%).
 */
export function computeEngagement({ views, likes, comments }) {
  const v = toNonNegInt(views);
  if (!v) return null;
  const l = numOrNull(likes);
  const c = numOrNull(comments);
  if (l == null && c == null) return null;
  const numerator = (l ?? 0) + (c ?? 0);
  return Math.round((numerator / v) * 10000) / 10000;
}

/** Budget helper: percent of cap consumed (0..∞), plus a status band for the UI. */
export function budgetStatus(totalPayoutCents, capCents) {
  const total = toNonNegInt(totalPayoutCents);
  const cap = toNonNegInt(capCents);
  if (!cap) return { pct: 0, band: 'ok', over: false };
  const pct = Math.round((total / cap) * 1000) / 10; // one decimal
  let band = 'ok';
  if (pct >= 100) band = 'over';
  else if (pct >= 90) band = 'critical';
  else if (pct >= 80) band = 'warn';
  return { pct, band, over: total > cap };
}

/** Format integer cents as a plain money string, e.g. 2060 -> "$20.60". */
export function formatCents(cents, symbol = '$') {
  const c = Math.round(Number(cents) || 0);
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  return `${sign}${symbol}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Format an engagement fraction as a percent string, "—" when null. */
export function formatEngagement(fraction) {
  if (fraction == null) return '—';
  return `${(fraction * 100).toFixed(1)}%`;
}

// ============================================================================
// Alternative payout models (per-cycle choice). Each takes already-aggregated
// "entries" — [{ key, views }] where key identifies a clipper (or a clip, for
// flat_per_clip) — and returns a Map(key -> cents). The manager picks the model
// per cycle and can change it (and its params) mid-cycle; payouts recalc live.
// ============================================================================

/** True when an entry meets the qualifying view threshold (and has >0 views). */
export function qualifies(views, qualifyMinViews = 0) {
  const v = toNonNegInt(views);
  return v > 0 && v >= (qualifyMinViews || 0);
}

/**
 * distributePot(totalCents, weights[]) -> cents[]
 * Splits a fixed pot proportionally to weights, using largest-remainder rounding
 * so the parts sum to EXACTLY totalCents (no lost or phantom pennies).
 */
export function distributePot(totalCents, weights) {
  const total = weights.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const pot = toNonNegInt(totalCents);
  if (total <= 0 || pot <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (pot * (w > 0 ? w : 0)) / total);
  const out = raw.map((x) => Math.floor(x));
  let remainder = pot - out.reduce((a, b) => a + b, 0);
  const byFrac = raw
    .map((x, i) => ({ i, f: x - Math.floor(x) }))
    .sort((a, b) => b.f - a.f);
  for (let k = 0; k < remainder; k++) out[byFrac[k % byFrac.length].i] += 1;
  return out;
}

/** pot_proportional — split the pot by each qualifier's share of total views. */
export function computePotProportional({ potCents, entries, qualifyMinViews = 0, maxPerClipperCents = null }) {
  const weights = entries.map((e) => (qualifies(e.views, qualifyMinViews) ? toNonNegInt(e.views) : 0));
  let cents = distributePot(potCents, weights);
  if (maxPerClipperCents != null) cents = cents.map((c) => Math.min(c, maxPerClipperCents));
  return new Map(entries.map((e, i) => [e.key, cents[i]]));
}

/** pot_equal — split the pot equally among all qualifiers. */
export function computePotEqual({ potCents, entries, qualifyMinViews = 0 }) {
  const weights = entries.map((e) => (qualifies(e.views, qualifyMinViews) ? 1 : 0));
  const cents = distributePot(potCents, weights);
  return new Map(entries.map((e, i) => [e.key, cents[i]]));
}

/** placement — fixed prizes to the top qualifiers, ranked by views (desc). */
export function computePlacement({ prizesCents, entries, qualifyMinViews = 0 }) {
  const ranked = entries
    .filter((e) => qualifies(e.views, qualifyMinViews))
    .sort((a, b) => toNonNegInt(b.views) - toNonNegInt(a.views));
  const result = new Map(entries.map((e) => [e.key, 0]));
  ranked.forEach((e, rank) => {
    if (rank < prizesCents.length) result.set(e.key, toNonNegInt(prizesCents[rank]));
  });
  return result;
}

/** flat_per_clip — fixed amount per qualifying clip (entries are clips here). */
export function computeFlatPerClip({ amountCents, entries, qualifyMinViews = 0 }) {
  const amt = toNonNegInt(amountCents);
  return new Map(entries.map((e) => [e.key, qualifies(e.views, qualifyMinViews) ? amt : 0]));
}

/** Apply signed manual adjustments (bonuses/deductions), never below $0. */
export function applyAdjustments(baseCentsByKey, adjustmentsByKey = {}) {
  const out = new Map(baseCentsByKey);
  for (const [key, delta] of Object.entries(adjustmentsByKey)) {
    const base = out.get(key) ?? 0;
    out.set(key, Math.max(0, base + Math.trunc(Number(delta) || 0)));
  }
  return out;
}

// ---- helpers ----------------------------------------------------------------
function toNonNegInt(x) {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function numOrNull(x) {
  if (x == null) return null;
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return null; // -1 (hidden) / NaN => unknown
  return Math.trunc(n);
}
