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

export async function fetchFacebookStats(urls) {
  if (!urls.length) return new Map();
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN is not set');
  const shapes = [
    { startUrls: urls.map((u) => ({ url: u })), resultsLimit: urls.length },
    { postUrls: urls },
    { urls },
  ];
  let lastErr = null;
  for (const input of shapes) {
    let items;
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${FB_POSTS_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=240`,
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
          throw new Error('Apify credit is used up — Facebook checks are paused until it renews or you top up at console.apify.com/billing.');
        }
        throw new Error(`Apify ${FB_POSTS_ACTOR} ${res.status}: ${body.slice(0, 200)}`);
      }
      items = await res.json();
    } catch (err) {
      lastErr = err;
      continue;
    }
    if (!Array.isArray(items) || items.length === 0) continue;
    const out = new Map();
    for (const item of items) {
      const link = item.inputUrl || item.url || item.postUrl || item.topLevelUrl || item.link;
      const key = link ? parseClip(link).key : null;
      if (!key) continue;
      const s = normalizeFacebook(item);
      const prev = out.get(key);
      if (!prev || s.views > prev.views) out.set(key, s);
    }
    if (out.size) return out;
  }
  if (lastErr) throw lastErr;
  return new Map();
}

/** Scan a Facebook page/profile's recent reels/videos -> [normalized stats]. */
export async function scanFacebookPage(handle, n = 20) {
  const user = String(handle).replace(/^@/, '');
  const pageUrl = `https://www.facebook.com/${user}`;
  const shapes = [
    { startUrls: [{ url: `${pageUrl}/reels/` }], resultsLimit: n },
    { startUrls: [{ url: pageUrl }], resultsLimit: n },
    { profiles: [user], resultsLimit: n },
    { username: [user], resultsLimit: n },
  ];
  let lastErr = null;
  for (const input of shapes) {
    let items;
    try {
      items = await runActorSync(input);
    } catch (err) {
      lastErr = err;
      continue;
    }
    if (!Array.isArray(items) || items.length === 0) continue;
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
  }
  if (lastErr) throw lastErr;
  return [];
}
