// Does this handle actually exist on the platform? Free existence probe via
// the public profile URL — no API tokens burned.
// Returns 'ok' | 'notfound' | 'unknown' (couldn't tell: bot-wall, timeout, X…).
const PROFILE_URL = {
  youtube: (h) => `https://www.youtube.com/@${encodeURIComponent(h)}`,
  tiktok: (h) => `https://www.tiktok.com/@${encodeURIComponent(h)}`,
  instagram: (h) => `https://www.instagram.com/${encodeURIComponent(h)}/`,
  facebook: (h) => `https://www.facebook.com/${encodeURIComponent(h)}`,
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function verifyAccountExists(platform, handle) {
  const build = PROFILE_URL[platform];
  if (!build) return 'unknown'; // X/other — no reliable free probe
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(build(handle), {
      method: 'GET',
      redirect: 'manual',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'text/html' },
    });
    if (res.status === 404 || res.status === 410) return 'notfound';
    if (res.status >= 200 && res.status < 300) return 'ok';
    return 'unknown'; // login-wall redirects, 403/429 bot blocks — don't guess
  } catch {
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}
