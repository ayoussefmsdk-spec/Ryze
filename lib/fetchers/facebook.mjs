// Facebook page/profile scan via an Apify actor. FACEBOOK IS SCAN-ONLY by
// design: no automatic checks ever run for it, so Apify cost happens only when
// the manager presses Scan (typically once at month-end). The actor id is
// configurable (APIFY_FACEBOOK_ACTOR) and, since FB actors disagree on input
// shape, several common shapes are tried until one returns items.
import { normalizeFacebook } from '../../core/normalize.mjs';
import { parseClip } from '../../core/platform.mjs';

const FB_ACTOR = process.env.APIFY_FACEBOOK_ACTOR || 'apify~facebook-reels-scraper';

async function runActorSync(input) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN is not set');
  const res = await fetch(
    `https://api.apify.com/v2/acts/${FB_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=240`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(280000),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 402 || /not-enough-usage/i.test(body)) {
      throw new Error('Apify credit is used up — Facebook scans are paused until it renews or you top up at console.apify.com/billing.');
    }
    throw new Error(`Apify ${FB_ACTOR} ${res.status}: ${body.slice(0, 200)}`);
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

const collectByKey = (items, out) => {
  for (const item of Array.isArray(items) ? items : []) {
    const link = item.inputUrl || item.url || item.postUrl || item.topLevelUrl || item.link;
    const key = link ? parseClip(link).key : null;
    if (!key) continue;
    const s = normalizeFacebook(item);
    const prev = out.get(key);
    if (!prev || s.views > prev.views) out.set(key, s);
  }
  return out;
};

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
      if (res.status === 402 || /not-enough-usage/i.test(body)) {
        throw new Error('Apify credit is used up — Facebook checks are paused until it renews or you top up at console.apify.com/billing.');
      }
      throw new Error(`Apify ${FB_POSTS_ACTOR} ${res.status}: ${body.slice(0, 200)}`);
    }
    collectByKey(await res.json(), out);
  } catch (err) {
    directErr = err;
  }

  // Page route for anything the direct call didn't cover — every candidate
  // page of every missing clip gets scanned.
  const missing = list.filter((c) => { const k = parseClip(c.url).key; return k && !out.has(k); });
  const handles = [...new Set(missing.flatMap((c) => c.handles || [c.handle]).filter(Boolean))];
  let pageErr = null;
  for (const h of handles) {
    try {
      const posts = await scanFacebookPage(h, 100);
      for (const p of posts) {
        const key = parseClip(p.url).key;
        if (key && !out.has(key)) out.set(key, p);
      }
    } catch (err) {
      pageErr = err;
    }
  }

  // Nothing worked at all -> surface the most useful error.
  if (out.size === 0 && (pageErr || directErr)) throw pageErr || directErr;
  return out;
}

/** Scan a Facebook page/profile's recent reels/videos -> [normalized stats]. */
export async function scanFacebookPage(handle, n = 20) {
  const user = String(handle).replace(/^@/, '');
  // Pages WITHOUT a username are addressed by numeric ID (profile.php?id=…).
  const numeric = /^\d{5,}$/.test(user);
  const pageUrl = numeric ? `https://www.facebook.com/profile.php?id=${user}` : `https://www.facebook.com/${user}`;
  const reelsUrl = numeric ? `${pageUrl}&sk=reels_tab` : `${pageUrl}/reels/`;
  const shapes = [
    { startUrls: [{ url: reelsUrl }], resultsLimit: n },
    { startUrls: [{ url: pageUrl }], resultsLimit: n },
    { profiles: [user], resultsLimit: n },
    { username: [user], resultsLimit: n },
  ];
  let lastErr = null;
  let ranButEmpty = false;
  for (const input of shapes) {
    let items;
    try {
      items = await runActorSync(input);
    } catch (err) {
      lastErr = err;
      continue;
    }
    if (!Array.isArray(items) || items.length === 0) { ranButEmpty = true; continue; }
    const out = [];
    for (const item of items) {
      const link = item.url || item.postUrl || item.topLevelUrl || item.link
        || (item.postId && /^\d+$/.test(String(item.postId)) ? `https://www.facebook.com/reel/${item.postId}` : null);
      if (!link) continue;
      const key = parseClip(link).key;
      if (!key) continue;
      out.push({ ...normalizeFacebook(item), url: link, platform: 'facebook' });
    }
    if (out.length) return out;
    ranButEmpty = true;
  }
  // An accepted-but-empty run is the truth ("no posts visible") — don't bury it
  // under a LATER shape's validation error.
  if (ranButEmpty) return [];
  if (lastErr) throw lastErr;
  return [];
}
