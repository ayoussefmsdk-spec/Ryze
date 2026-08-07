// ============================================================================
// Ryze — platform + URL logic (pure, no I/O)
// ============================================================================
// Decides which platform a link belongs to, pulls out the canonical video id /
// account handle, and builds a "normalized key" used for duplicate detection so
// that youtu.be/X, youtube.com/watch?v=X and youtube.com/shorts/X all collapse
// to the same clip. These rules were verified against the live URL formats.
// ============================================================================

/** Tracking / share junk we drop so it never defeats duplicate detection. */
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'si', 'igsh', 'igshid', 'fbclid', 'gclid', 'ref', 'ref_src', 'ref_url',
  'source', 'feature', '_r', '_t', '_u', 'is_from_webapp', 'sender_device',
  'web_link_time', 'lang', 'spm', 'checksum',
]);

/** A valid YouTube video id is exactly 11 chars from this alphabet. */
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function safeUrl(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s; // tolerate "tiktok.com/..." with no scheme
  try {
    return new URL(s);
  } catch {
    return null;
  }
}

function bareHost(u) {
  return u.hostname.replace(/^www\./i, '').toLowerCase();
}

/**
 * detectPlatform(url) -> 'youtube'|'tiktok'|'instagram'|'twitter'|'other'|null
 * Returns null when the input is not a usable URL at all.
 */
export function detectPlatform(raw) {
  const u = safeUrl(raw);
  if (!u) return null;
  const host = bareHost(u);
  if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) return 'youtube';
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  if (host === 'x.com' || host === 'twitter.com' || host.endsWith('.x.com') || host.endsWith('.twitter.com')) return 'twitter';
  return 'other';
}

/** Extract the 11-char YouTube id from any standard URL shape, else null. */
export function extractYouTubeId(raw) {
  const u = safeUrl(raw);
  if (!u) return null;
  const host = bareHost(u);
  const ok = (id) => (id && YT_ID.test(id) ? id : null);

  if (host === 'youtu.be') return ok(u.pathname.slice(1).split('/')[0]);
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (u.pathname === '/watch') return ok(u.searchParams.get('v'));
    const m = u.pathname.match(/^\/(?:shorts|embed|v|live)\/([^/?#]+)/);
    if (m) return ok(m[1]);
  }
  return null;
}

function stripHandle(h) {
  return h ? h.replace(/^@/, '').toLowerCase() : null;
}

/**
 * parseClip(url) -> {
 *   valid, platform, id, handle, key, canonicalUrl
 * }
 * `key` is the duplicate-detection fingerprint. `handle` is the posting account
 * where the URL itself reveals it (TikTok, Twitter); for YouTube/Instagram it is
 * null here and resolved later from the fetch.
 */
export function parseClip(raw) {
  const platform = detectPlatform(raw);
  const u = safeUrl(raw);
  const base = { valid: false, platform, id: null, handle: null, key: null, canonicalUrl: null };
  if (!platform || !u) return base;

  const host = bareHost(u);
  const path = u.pathname.replace(/\/+$/, ''); // drop trailing slash

  if (platform === 'youtube') {
    const id = extractYouTubeId(raw);
    if (!id) return { ...base, canonicalUrl: canonical(u) };
    return { valid: true, platform, id, handle: null, key: `youtube:${id}`, canonicalUrl: `https://www.youtube.com/watch?v=${id}` };
  }

  if (platform === 'tiktok') {
    // Full form: tiktok.com/@handle/video/1234567890
    const full = path.match(/^\/@([\w.]+)\/video\/(\d+)/i);
    if (full) {
      const handle = stripHandle(full[1]);
      const id = full[2];
      return { valid: true, platform, id, handle, key: `tiktok:${id}`, canonicalUrl: `https://www.tiktok.com/@${handle}/video/${id}` };
    }
    // Short/redirect form: vm.tiktok.com/XXXX, /t/XXXX — id unknown until resolved.
    const short = path.match(/^\/(?:t\/)?([A-Za-z0-9]+)/);
    if (host !== 'tiktok.com' && short) {
      return { valid: true, platform, id: null, handle: null, key: `tiktok:short:${short[1].toLowerCase()}`, canonicalUrl: canonical(u) };
    }
    return { ...base, canonicalUrl: canonical(u) };
  }

  if (platform === 'instagram') {
    // /reel/CODE, /reels/CODE, /p/CODE, /tv/CODE
    const m = path.match(/^\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
    if (m) {
      const code = m[1];
      return { valid: true, platform, id: code, handle: null, key: `instagram:${code}`, canonicalUrl: `https://www.instagram.com/reel/${code}/` };
    }
    return { ...base, canonicalUrl: canonical(u) };
  }

  if (platform === 'twitter') {
    // /USER/status/ID
    const m = path.match(/^\/([A-Za-z0-9_]+)\/status\/(\d+)/i);
    if (m) {
      const handle = m[1].toLowerCase();
      const id = m[2];
      return { valid: true, platform, id, handle, key: `twitter:${id}`, canonicalUrl: `https://x.com/${handle}/status/${id}` };
    }
    return { ...base, canonicalUrl: canonical(u) };
  }

  // other: no known id scheme — key off the cleaned host+path.
  const cu = canonical(u);
  return { valid: true, platform: 'other', id: null, handle: null, key: `other:${host}${path}`.toLowerCase(), canonicalUrl: cu };
}

/** Rebuild a URL with tracking params and fragments stripped (for display/storage). */
function canonical(u) {
  const clean = new URL(u.toString());
  clean.hash = '';
  for (const p of [...clean.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(p.toLowerCase())) clean.searchParams.delete(p);
  }
  let out = clean.toString().replace(/\/$/, '');
  return out;
}

/** normalizedKey(url) — the single value duplicate detection compares. */
export function normalizedKey(raw) {
  return parseClip(raw).key;
}

/** True when two links point at the same clip (same platform + same id). */
export function isSameClip(a, b) {
  const ka = normalizedKey(a);
  const kb = normalizedKey(b);
  return ka != null && ka === kb;
}
