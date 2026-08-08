// Apify actors for TikTok + Instagram. Uses the synchronous
// run-sync-get-dataset-items endpoint (fine on Railway's always-on server; the
// scheduler and single-clip rechecks share the same path). Actor ids and input
// shapes are configurable via env in case the store changes.
import { normalizeTikTok, normalizeInstagram } from '../../core/normalize.mjs';
import { parseClip } from '../../core/platform.mjs';

const TIKTOK_ACTOR = process.env.APIFY_TIKTOK_ACTOR || 'clockworks~tiktok-scraper';
const INSTA_ACTOR = process.env.APIFY_INSTAGRAM_ACTOR || 'apify~instagram-scraper';

async function runActorSync(actor, input) {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN is not set');
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=240`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(280000), // > actor timeout so we get its result
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Apify ${actor} ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * fetchTikTokStats(urls) -> Map(normalizedKey -> stats)
 * One actor run for the whole batch of video URLs.
 */
export async function fetchTikTokStats(urls) {
  if (!urls.length) return new Map();
  const items = await runActorSync(TIKTOK_ACTOR, {
    postURLs: urls,
    resultsPerPage: urls.length,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
  });
  const out = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const link = item.webVideoUrl || item.submittedVideoUrl || item.url;
    const key = link ? parseClip(link).key : null;
    if (key) out.set(key, normalizeTikTok(item));
  }
  return out;
}

/**
 * fetchInstagramStats(urls) -> Map(normalizedKey -> stats)
 */
export async function fetchInstagramStats(urls) {
  if (!urls.length) return new Map();
  const items = await runActorSync(INSTA_ACTOR, {
    directUrls: urls,
    resultsType: 'posts',
    resultsLimit: urls.length,
    addParentData: false,
  });
  const out = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const link = item.inputUrl || item.url;
    const key = link ? parseClip(link).key : null;
    if (key) out.set(key, normalizeInstagram(item));
  }
  return out;
}
