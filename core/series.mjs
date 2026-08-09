// ClipHive — calendar-series helpers (pure, no I/O).
// view_history only has rows on days a check ran; charts want REAL calendar
// days. fillDailySeries stretches a sparse cumulative series onto consecutive
// dates (carrying the last known total forward), dailyGains turns cumulative
// totals into how-many-views-came-in-each-day.

const DAY_CAP = 400; // safety: never build more than ~13 months of days

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * fillDailySeries(series, { from, to }) -> [{label, value}] one point per
 * calendar day. `series` is sparse cumulative [{label:'YYYY-MM-DD', value}]
 * (ascending). Days before the first datapoint are 0; gap days carry the last
 * total forward. Bounds default to the series' own range and clamp sanely.
 */
export function fillDailySeries(series, { from = null, to = null } = {}) {
  if (!series || !series.length) return [];
  let start = from || series[0].label;
  let end = to || series[series.length - 1].label;
  // Never cut off real data: widen bounds to include every datapoint.
  if (series[0].label < start) start = series[0].label;
  if (series[series.length - 1].label > end) end = series[series.length - 1].label;
  if (end < start) end = start;

  const byDay = new Map(series.map((p) => [p.label, Number(p.value)]));
  const out = [];
  let last = 0;
  let day = start;
  for (let i = 0; i < DAY_CAP; i++) {
    if (byDay.has(day)) last = byDay.get(day);
    out.push({ label: day, value: last });
    if (day >= end) break;
    day = addDays(day, 1);
  }
  return out;
}

/**
 * zeroFillDaily(series, { from, to }) -> one point per calendar day, where
 * missing days are 0 (for per-day COUNTS — unlike fillDailySeries, nothing
 * carries forward). Bounds widen to include every datapoint.
 */
export function zeroFillDaily(series, { from = null, to = null } = {}) {
  if ((!series || !series.length) && !(from && to)) return [];
  const pts = series || [];
  let start = from || pts[0].label;
  let end = to || pts[pts.length - 1].label;
  if (pts.length && pts[0].label < start) start = pts[0].label;
  if (pts.length && pts[pts.length - 1].label > end) end = pts[pts.length - 1].label;
  if (end < start) end = start;

  const byDay = new Map(pts.map((p) => [p.label, Number(p.value)]));
  const out = [];
  let day = start;
  for (let i = 0; i < DAY_CAP; i++) {
    out.push({ label: day, value: byDay.get(day) ?? 0 });
    if (day >= end) break;
    day = addDays(day, 1);
  }
  return out;
}

/** dailyGains(filledSeries) -> [{label, value: views gained that day}] */
export function dailyGains(filled) {
  const out = [];
  for (let i = 0; i < filled.length; i++) {
    const prev = i === 0 ? 0 : filled[i - 1].value;
    out.push({ label: filled[i].label, value: Math.max(0, filled[i].value - prev) });
  }
  return out;
}

/** Smallest of two 'YYYY-MM-DD' strings (for capping a range at "today"). */
export function minIso(a, b) {
  return a <= b ? a : b;
}
