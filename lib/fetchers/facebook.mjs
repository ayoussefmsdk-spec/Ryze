// Facebook page/profile scan via an Apify actor. FACEBOOK IS SCAN-ONLY by
// design: no automatic checks ever run for it, so Apify cost happens only when
// the manager presses Scan (typically once at month-end). The actor id is
// configurable (APIFY_FACEBOOK_ACTOR) and, since FB actors disagree on input
// shape, several common shapes are tried until one returns items.
import { normalizeFacebook } from '../../core/normalize.mjs';
import { parseClip } from '../../core/platform.mjs';
import { friendlyApifyError } from './apify-errors.mjs';

const FB_ACTOR = process.env.APIFY_FACEBOOK_ACTOR || 'apify~facebook-reels-scraper';

async function runActorSync(input, actor = FB_ACTOR) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN is not set');
  const res = await fetch(
    `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=240`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(280000),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(friendlyApifyError(actor, res.status, body));
  }
  return res.json();
}

/**
 * fetchFacebookStats(urls) -> Map(normalizedKey -> stats)
 * Direct-post batch fetch — the exact counterpart of fetchTikTokStats, so
 * Facebook clips work with scheduled checks, "Check now", per-clip Recheck and
 * fetch-on-submit like every other paid platform. Actor input shapes vary, so
 * common shapes are tried until one returns items.
 */
const FB_POSTS_ACTOR = process.env.APIFY_FACEBOOK_POSTS_ACTOR || 'apify~facebook-posts-scraper';

/** The per-item URL, in order of trustworthiness (verified against real actor
 *  output): reels-feed items carry it in shareable_url/topLevelReelUrl (their
 *  inputUrl is the PROFILE url!), direct-post items in facebookUrl/facebookId. */
export const fbItemUrl = (item, { pageId = null } = {}) => {
  // The post's OWN address first. `facebookId` is NOT a post id on every
  // actor: the posts scraper puts the PAGE's id there, so building
  // /reel/<facebookId> turned every post of a page into one fake "reel".
  // Only use an id-built URL as a last resort, and never from a page's id.
  const pageIds = new Set(
    [pageId, item.pageId, item.profileId, item.userId, item.ownerId, item.user?.id]
      .filter((x) => x != null).map(String),
  );
  const idUrl = (id) => (id != null && /^\d{6,}$/.test(String(id)) && !pageIds.has(String(id))
    ? `https://www.facebook.com/reel/${id}` : null);
  const candidates = [
    item.shareable_url, item.topLevelReelUrl,
    item.url, item.postUrl, item.facebookUrl, item.topLevelUrl, item.link,
    idUrl(item.postId), idUrl(item.videoId),
    idUrl(item.facebookId),
    item.inputUrl,
  ];
  // First candidate that names an actual POST wins — feed items carry the
  // profile URL in several of these fields, and that must never pass as a clip.
  return candidates.find((u) => typeof u === 'string' && parseClip(u).valid) || null;
};

/** Merge two stat reads of the same post: max views, fill gaps from both
 *  (the direct read has likes/comments but no plays; the reels feed has plays
 *  but no likes — together they're complete). */
export const mergeStats = (a, b) => {
  const hi = (Number(b.views) || 0) >= (Number(a.views) || 0) ? b : a;
  const lo = hi === b ? a : b;
  const merged = { ...lo };
  for (const [k, v] of Object.entries(hi)) if (v != null) merged[k] = v;
  merged.views = Math.max(Number(a.views) || 0, Number(b.views) || 0);
  if (merged.likes == null) merged.likes = lo.likes ?? hi.likes ?? null;
  if (merged.comments == null) merged.comments = lo.comments ?? hi.comments ?? null;
  return merged;
};

const collectByKey = (items, out, aliases = null) => {
  for (const item of Array.isArray(items) ? items : []) {
    const link = fbItemUrl(item);
    const key = link ? parseClip(link).key : null;
    if (!key) continue;
    const s = normalizeFacebook(item);
    const prev = out.get(key);
    const merged = prev ? mergeStats(prev, s) : s;
    out.set(key, merged);
    // Share links (facebook.com/share/r/…) are opaque: the actor answers with
    // the REAL reel URL, so the clip's share key would never match. Direct
    // reads echo the URL we sent as inputUrl — use it to map the answer back,
    // and carry the real URL so the clip can be upgraded to it.
    const inKey = item.inputUrl ? parseClip(item.inputUrl).key : null;
    if (inKey && inKey.startsWith('facebook:share:') && inKey !== key) {
      out.set(inKey, { ...merged, resolvedUrl: link });
      if (aliases) aliases.set(inKey, key);
    }
  }
  return out;
};

/**
 * resolveFbShareUrl(url) -> real post URL | null
 * facebook.com/share/r/SLUG and fb.watch/SLUG are redirects with an opaque
 * slug. Follow them (best effort, short timeout) to the numeric /reel/ or
 * /videos/ address so matching and duplicate detection work. Returns null for
 * non-share URLs or when Facebook won't say (login wall, network).
 */
export async function resolveFbShareUrl(url) {
  const start = parseClip(String(url || ''));
  if (!start.key || !start.key.startsWith('facebook:share:')) return null;
  const real = (u) => {
    const p = parseClip(u);
    // Only a numeric post id counts — login walls and checkpoints parse as
    // "valid facebook" URLs too, and must never be mistaken for the post.
    return p.valid && p.platform === 'facebook' && /^\d{6,}$/.test(String(p.id || ''))
      ? (p.canonicalUrl || u) : null;
  };
  let current = start.canonicalUrl || url;
  try {
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(current, {
        redirect: 'manual',
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'accept-language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      });
      const loc = res.headers.get('location');
      if (loc) {
        const next = new URL(loc, current).toString();
        const hit = real(next);
        if (hit) return hit;
        // Login walls carry the destination in ?next= — read it from there.
        const nxt = new URL(next).searchParams.get('next');
        if (nxt) { const h2 = real(decodeURIComponent(nxt)); if (h2) return h2; }
        current = next;
        continue;
      }
      // No redirect: the page itself may name its canonical post URL.
      const html = (await res.text()).slice(0, 300000);
      for (const m of html.matchAll(/(?:og:url"\s+content|rel="canonical"\s+href)="([^"]+)"/g)) {
        const hit = real(m[1].replace(/&amp;/g, '&'));
        if (hit) return hit;
      }
      const raw = html.match(/https?:\\?\/\\?\/www\.facebook\.com\\?\/reel\\?\/(\d{6,})/);
      if (raw) return `https://www.facebook.com/reel/${raw[1]}`;
      return null;
    }
  } catch { /* network / timeout — caller keeps the share link */ }
  return null;
}

/**
 * fetchFacebookStats(clips) -> Map(normalizedKey -> stats)
 * clips: [{ url, handle }] (handle = the posting page, when known).
 * Two strategies, cheapest first:
 *  1. Direct: the posts actor with the clip URLs as startUrls (works only if
 *     the actor supports single-post URLs — many are page-oriented).
 *  2. Page route: for keys still missing, scan each known page's recent reels
 *     (the thing FB scrapers are actually built for) and match by video id.
 */
export async function fetchFacebookStats(clips) {
  const list = clips.map((c) => (typeof c === 'string' ? { url: c, handle: null } : c));
  if (!list.length) return new Map();
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN is not set');

  const out = new Map();
  const aliases = new Map(); // share key -> real key (learned from the direct read)
  let directErr = null;
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${FB_POSTS_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=240`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ startUrls: list.map((c) => ({ url: c.url })), resultsLimit: list.length }),
        signal: AbortSignal.timeout(280000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(friendlyApifyError(FB_POSTS_ACTOR, res.status, body));
    }
    collectByKey(await res.json(), out, aliases);
  } catch (err) {
    directErr = err;
  }

  // Page route for anything the direct call didn't cover — including posts the
  // direct read returned WITHOUT a view count (it reports likes/comments but
  // often no plays; the reels feed supplies them and the reads merge).
  const missing = list.filter((c) => {
    const k = parseClip(c.url).key;
    return k && (!out.has(k) || !(out.get(k).views > 0));
  });
  const handles = [...new Set(missing.flatMap((c) => c.handles || [c.handle]).filter(Boolean))];
  let pageErr = null;
  for (const h of handles) {
    try {
      const posts = await scanFacebookPage(h, 100);
      for (const p of posts) {
        const key = parseClip(p.url).key;
        if (!key) continue;
        // MERGE, don't skip: the direct read may already hold this key with
        // likes/comments but 0 views — the reels feed supplies the plays.
        const prev = out.get(key);
        out.set(key, prev ? mergeStats(prev, p) : p);
      }
    } catch (err) {
      pageErr = err;
    }
  }

  // The page scan answers under REAL reel keys; a share-link clip learned its
  // real key from the direct read — fold the page's plays into it too.
  for (const [shareKey, realKey] of aliases) {
    const fromPage = out.get(realKey);
    const cur = out.get(shareKey);
    if (fromPage && cur) out.set(shareKey, { ...mergeStats(cur, fromPage), resolvedUrl: cur.resolvedUrl });
  }

  // Nothing worked at all -> surface the most useful error.
  if (out.size === 0 && (pageErr || directErr)) throw pageErr || directErr;
  return out;
}

/** Scan a Facebook page/profile's recent reels/videos -> [normalized stats]. */
/** Is a posts-scraper item a video/reel (vs a photo or text post)? Numeric
 *  reel/video URLs are; otherwise look for a play count or a video field. */
function isFbVideoItem(item, key) {
  if (/^facebook:\d+$/.test(key)) return true;
  for (const [k, v] of Object.entries(item || {})) {
    if (/play|view/i.test(k) && typeof v === 'number' && v > 0) return true;
    if (/^is_?video$/i.test(k) && v === true) return true;
  }
  return /"(?:video_?url|playable_url|videoId|video_id)"\s*:\s*"/i.test(JSON.stringify(item).slice(0, 20000));
}

export async function scanFacebookPage(handle, n = 20) {
  const user = String(handle).replace(/^@/, '');
  // Pages WITHOUT a username are addressed by numeric ID (profile.php?id=…).
  const numeric = /^\d{5,}$/.test(user);
  const pageUrl = numeric ? `https://www.facebook.com/profile.php?id=${user}` : `https://www.facebook.com/${user}`;
  const reelsUrl = numeric ? `${pageUrl}&sk=reels_tab` : `${pageUrl}/reels/`;
  // [actor, input] attempts, cheapest-to-most-general. The reels scraper is
  // tried first; when it can't read an account ("Empty or private data" —
  // common on personal profiles even when public), the POSTS scraper reads
  // the same feed a different way and its reels/videos come back as posts.
  const shapes = [
    [FB_ACTOR, { startUrls: [{ url: reelsUrl }], resultsLimit: n }],
    [FB_ACTOR, { startUrls: [{ url: pageUrl }], resultsLimit: n }],
    [FB_ACTOR, { profiles: [user], resultsLimit: n }],
    [FB_ACTOR, { username: [user], resultsLimit: n }],
    [FB_POSTS_ACTOR, { startUrls: [{ url: pageUrl }], resultsLimit: n }],
  ];
  let lastErr = null;
  let ranButEmpty = false;
  let actorSaid = null; // the actor's own explanation, e.g. "content isn't available"
  for (const [actor, input] of shapes) {
    let items;
    try {
      items = await runActorSync(input, actor);
    } catch (err) {
      lastErr = err;
      continue;
    }
    if (!Array.isArray(items) || items.length === 0) { ranButEmpty = true; continue; }
    const out = [];
    const seen = new Set();
    for (const item of items) {
      // Error / "no posts" placeholder items are not posts — remember why.
      if (item.error || item.errorDescription) {
        actorSaid ??= String(item.errorDescription || item.error).slice(0, 200);
        continue;
      }
      const link = fbItemUrl(item, { pageId: numeric ? user : null });
      if (!link) continue;
      const key = parseClip(link).key;
      if (!key || seen.has(key)) continue;
      // The posts scraper returns the WHOLE feed (photos, text posts…); clips
      // are videos, so keep only items that are reels/videos.
      if (actor === FB_POSTS_ACTOR && !isFbVideoItem(item, key)) continue;
      seen.add(key);
      out.push({ ...normalizeFacebook(item), url: link, platform: 'facebook' });
    }
    if (out.length) return out;
    ranButEmpty = true; // only placeholders/unusable items — try the next shape
  }
  // An accepted-but-empty run is the truth ("no posts visible") — don't bury it
  // under a LATER shape's validation error. Say what Facebook said, if anything.
  if (ranButEmpty) {
    const empty = [];
    if (actorSaid) empty.warning = `the scraper got no reels — Facebook said: “${actorSaid}”`;
    return empty;
  }
  if (lastErr) throw lastErr;
  return [];
}
