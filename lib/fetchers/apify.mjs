// Apify actors for TikTok + Instagram. Uses the synchronous
// run-sync-get-dataset-items endpoint (fine on Railway's always-on server; the
// scheduler and single-clip rechecks share the same path). Actor ids and input
// shapes are configurable via env in case the store changes.
import { normalizeTikTok, normalizeInstagram } from '../../core/normalize.mjs';
import { parseClip } from '../../core/platform.mjs';

const TIKTOK_ACTOR = process.env.APIFY_TIKTOK_ACTOR || 'clockworks~tiktok-scraper';
const INSTA_ACTOR = process.env.APIFY_INSTAGRAM_ACTOR || 'apify~instagram-scraper';

/** Note every Apify success/failure in app_settings so the System hub and the
 *  Dashboard can warn "Apify is failing right now — TikTok/IG numbers may be
 *  stale". Best-effort: health notes must never break a fetch. */
async function recordHealth(ok, message = null) {
  try {
    const { query } = await import('../db.mjs');
    if (ok) await query(`update app_settings set apify_ok_at = now() where id = 1`);
    else {
      await query(
        `update app_settings set apify_error_at = now(), apify_error = $1 where id = 1`,
        [String(message || 'unknown error').slice(0, 400)],
      );
    }
  } catch { /* never let bookkeeping break the fetch */ }
}

async function runActorSync(actor, input) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    await recordHealth(false, 'APIFY_TOKEN is not set');
    throw new Error('APIFY_TOKEN is not set');
  }
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=240`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(280000), // > actor timeout so we get its result
    });
  } catch (err) {
    await recordHealth(false, `network: ${err.message}`);
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Out of Apify credit — say it in plain words instead of raw JSON.
    const msg = (res.status === 402 || /not-enough-usage/i.test(body))
      ? 'Apify credit is used up — TikTok/Instagram checks are paused until it renews or you top up at console.apify.com/billing. YouTube checks keep working (free).'
      : `Apify ${actor} ${res.status}: ${body.slice(0, 300)}`;
    await recordHealth(false, msg);
    throw new Error(msg);
  }
  await recordHealth(true);
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

/** Scan a TikTok profile's recent videos -> [normalized stats] (for account-scan). */
export async function scanTikTokProfile(handle, n = 20) {
  const items = await runActorSync(TIKTOK_ACTOR, {
    profiles: [String(handle).replace(/^@/, '')],
    resultsPerPage: n,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
  });
  return (Array.isArray(items) ? items : []).map((item) => {
    const link = item.webVideoUrl || item.url;
    return { ...normalizeTikTok(item), url: link, platform: 'tiktok' };
  }).filter((c) => c.url);
}

/** Scan an Instagram profile's recent posts -> [normalized stats]. */
export async function scanInstagramProfile(handle, n = 20) {
  const items = await runActorSync(INSTA_ACTOR, {
    directUrls: [`https://www.instagram.com/${String(handle).replace(/^@/, '')}/`],
    resultsType: 'posts',
    resultsLimit: n,
    addParentData: false,
  });
  return (Array.isArray(items) ? items : []).map((item) => {
    const link = item.url || item.inputUrl;
    return { ...normalizeInstagram(item), url: link, platform: 'instagram' };
  }).filter((c) => c.url);
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
