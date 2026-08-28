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
