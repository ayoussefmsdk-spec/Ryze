// Tiny in-memory sliding-window rate limiter (per-process; resets on deploy —
// fine as a brute-force brake, not an accounting tool).
const buckets = new Map(); // key -> number[] timestamps

export function limited(key, { max, windowMs }) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { buckets.set(key, arr); return true; }
  arr.push(now);
  buckets.set(key, arr);
  // Opportunistic cleanup so the map can't grow unbounded under a scan.
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) { if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k); }
  }
  return false;
}

/** Best-effort client IP behind Railway's proxy. */
export function clientIp(headersLike) {
  const get = typeof headersLike?.get === 'function' ? (k) => headersLike.get(k) : () => null;
  const fwd = get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || get('x-real-ip') || 'unknown';
}
