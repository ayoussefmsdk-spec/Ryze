// Apify actors for TikTok + Instagram. Small jobs (profile scans) use the
// synchronous run-sync endpoint; big stat batches use chunked async runs that
// are polled to completion (see runActorAsync). Actor ids and input
// shapes are configurable via env in case the store changes.
import { normalizeTikTok, normalizeInstagram } from '../../core/normalize.mjs';
import { friendlyApifyError } from './apify-errors.mjs';
import { parseClip } from '../../core/platform.mjs';

const TIKTOK_ACTOR = process.env.APIFY_TIKTOK_ACTOR || 'clockworks~tiktok-scraper';
const INSTA_ACTOR = process.env.APIFY_INSTAGRAM_ACTOR || 'apify~instagram-scraper';
const INSTA_REELS_ACTOR = process.env.APIFY_INSTAGRAM_REELS_ACTOR || 'apify~instagram-reel-scraper';

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
    const msg = friendlyApifyError(actor, res.status, body);
    await recordHealth(false, msg);
    throw new Error(msg);
  }
  await recordHealth(true);
  return res.json();
}

// ---- Big batches: async runs, chunked, a few in parallel -------------------
// A single run-sync call is capped (~4–5 min); hundreds of URLs in one run
// blew past it, so checks were cut off half-done ("check failed" on the rest)
// and took 15+ minutes. Instead: split into chunks, START each run, and poll
// it until it finishes — no request held open, no hard cap.
const CHUNK = Number(process.env.APIFY_BATCH_SIZE) || 100;
const PARALLEL = Number(process.env.APIFY_PARALLEL_RUNS) || 4;
const RUN_TIMEOUT_SECS = 1800; // generous per-run ceiling (Apify-side)

async function runActorAsync(actor, input) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    await recordHealth(false, 'APIFY_TOKEN is not set');
    throw new Error('APIFY_TOKEN is not set');
  }
  const api = 'https://api.apify.com/v2';
  const fail = async (res) => {
    const body = await res.text().catch(() => '');
    const msg = friendlyApifyError(actor, res.status, body);
    await recordHealth(false, msg);
    throw new Error(msg);
  };
  let res;
  try {
    res = await fetch(`${api}/acts/${actor}/runs?token=${token}&timeout=${RUN_TIMEOUT_SECS}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    await recordHealth(false, `network: ${err.message}`);
    throw err;
  }
  if (!res.ok) await fail(res);
  let run = (await res.json()).data;
  // Long-poll: Apify answers as soon as the run ends, or after 60s.
  const deadline = Date.now() + (RUN_TIMEOUT_SECS + 120) * 1000;
  while (!['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(run.status)) {
    if (Date.now() > deadline) throw new Error(`Apify ${actor} run ${run.id} didn't finish in time`);
    const r = await fetch(`${api}/actor-runs/${run.id}?token=${token}&waitForFinish=60`, {
      signal: AbortSignal.timeout(90000),
    }).catch(() => null);
    if (r && r.ok) run = (await r.json()).data;
    else if (r && !r.ok && r.status < 500) await fail(r);
  }
  // Even a failed / timed-out run keeps what it scraped — use it.
  const items = await fetch(`${api}/datasets/${run.defaultDatasetId}/items?token=${token}&clean=true&format=json`, {
    signal: AbortSignal.timeout(120000),
  });
  if (!items.ok) await fail(items);
  const data = await items.json();
  if (run.status === 'SUCCEEDED' || (Array.isArray(data) && data.length)) await recordHealth(true);
  else await recordHealth(false, `Apify ${actor} run ended ${run.status}`);
  return data;
}

const RETRY_WAIT_MS = Number(process.env.APIFY_RETRY_WAIT_MS) || 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Errors no retry can fix (account-level): fail fast instead of hammering. */
export function isPermanentApifyError(err) {
  return /USAGE LIMIT|ONE-TIME approval|credit is used up|APIFY_TOKEN/i.test(String(err?.message || err));
}

/** One chunk, with retries: try, wait, try again; if it still fails, split
 *  the chunk in half and retry each half (down to 10 links) so one bad link
 *  can't sink 99 good ones. Returns what was fetched plus the inputs that
 *  could NOT be fetched — the caller must never treat those as "post gone". */
async function runChunkWithRetry(chunk, work, depth = 0) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return { items: await work(chunk), failed: [], err: null }; }
    catch (err) {
      lastErr = err;
      if (isPermanentApifyError(err)) return { items: [], failed: [...chunk], err };
      if (attempt === 0) await sleep(RETRY_WAIT_MS);
    }
  }
  if (chunk.length > 10 && depth < 4) {
    const mid = Math.ceil(chunk.length / 2);
    const [a, b] = await Promise.all([
      runChunkWithRetry(chunk.slice(0, mid), work, depth + 1),
      runChunkWithRetry(chunk.slice(mid), work, depth + 1),
    ]);
    return { items: [...a.items, ...b.items], failed: [...a.failed, ...b.failed], err: a.err || b.err || lastErr };
  }
  return { items: [], failed: [...chunk], err: lastErr };
}

/** Run `work(chunk)` over `list` in chunks, `PARALLEL` at a time, each chunk
 *  with retries. Result: flat items, plus `failedInputs` (inputs never
 *  successfully fetched). Throws only if NOTHING at all could be fetched. */
async function inChunks(list, work) {
  const chunks = [];
  for (let i = 0; i < list.length; i += CHUNK) chunks.push(list.slice(i, i + CHUNK));
  const results = new Array(chunks.length);
  let next = 0;
  const lane = async () => {
    while (next < chunks.length) {
      const i = next++;
      results[i] = await runChunkWithRetry(chunks[i], work);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, chunks.length) }, lane));
  const items = results.flatMap((r) => r.items);
  const failedInputs = results.flatMap((r) => r.failed);
  const firstErr = results.find((r) => r.err)?.err || null;
  if (!items.length && failedInputs.length && firstErr) throw firstErr;
  items.failedInputs = failedInputs;
  items.failError = firstErr ? String(firstErr.message || firstErr).slice(0, 300) : null;
  return items;
}

/**
 * fetchTikTokStats(urls) -> Map(normalizedKey -> stats)
 * Chunked async actor runs (see inChunks), a few in parallel.
 */
export async function fetchTikTokStats(urls) {
  if (!urls.length) return new Map();
  const items = await inChunks(urls, (chunk) => runActorAsync(TIKTOK_ACTOR, {
    postURLs: chunk,
    resultsPerPage: chunk.length,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
  }));
  const out = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const link = item.webVideoUrl || item.submittedVideoUrl || item.url;
    const key = link ? parseClip(link).key : null;
    if (key) out.set(key, normalizeTikTok(item));
  }
  // Links whose batch could not be fetched even after retries: NOT evidence
  // the post is gone — the checker keeps their numbers and flags "check failed".
  out.unfetched = new Set((items.failedInputs || []).map((u) => parseClip(u).key).filter(Boolean));
  out.failError = items.failError || null;
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

/** Scan an Instagram profile -> [normalized stats].
 *  Two feeds, merged: the profile's POSTS grid misses reels that weren't
 *  shared to the grid (very common for clippers), so the REELS feed is
 *  scraped too and the results deduped by post code. If one of the two
 *  feeds fails, the other still returns — with a `warning` attached so the
 *  scan can tell the manager coverage was partial. */
export async function scanInstagramProfile(handle, n = 20) {
  const user = String(handle).replace(/^@/, '');
  // Reels route with fallback: the dedicated reels actor first (best coverage);
  // if it fails (not rented / renamed / erroring), point the MAIN scraper at
  // the profile's /reels/ tab instead. Only both failing loses the reels feed.
  const reelsRoute = runActorSync(INSTA_REELS_ACTOR, { username: [user], resultsLimit: n })
    .catch((firstErr) =>
      runActorSync(INSTA_ACTOR, {
        directUrls: [`https://www.instagram.com/${user}/reels/`],
        resultsType: 'posts',
        resultsLimit: n,
        addParentData: false,
      }).catch(() => { throw firstErr; }), // report the PRIMARY reason
    );
  const [grid, reels] = await Promise.allSettled([
    runActorSync(INSTA_ACTOR, {
      directUrls: [`https://www.instagram.com/${user}/`],
      resultsType: 'posts',
      resultsLimit: n,
      addParentData: false,
    }),
    reelsRoute,
  ]);
  if (grid.status === 'rejected' && reels.status === 'rejected') throw grid.reason;

  const items = [
    ...(grid.status === 'fulfilled' && Array.isArray(grid.value) ? grid.value : []),
    ...(reels.status === 'fulfilled' && Array.isArray(reels.value) ? reels.value : []),
  ];
  const seen = new Set();
  const out = [];
  for (const item of items) {
    // Some actor versions return shortCode without a full url — rebuild it.
    const link = item.url || item.inputUrl
      || (item.shortCode ? `https://www.instagram.com/reel/${item.shortCode}/` : null);
    if (!link) continue;
    const key = parseClip(link).key;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...normalizeInstagram(item), url: link, platform: 'instagram' });
  }
  const why = (r) => String(r.reason?.message || r.reason || 'unknown').slice(0, 140);
  if (grid.status === 'rejected') out.warning = `posts grid failed (${why(grid)}) — only the reels feed was scanned`;
  else if (reels.status === 'rejected') out.warning = `reels feed failed (${why(reels)}) — grid-hidden reels missed. If this mentions the actor, open console.apify.com and add/rent "apify/instagram-reel-scraper".`;
  return out;
}

/**
 * fetchInstagramStats(urls) -> Map(normalizedKey -> stats)
 * Two-pass: normal fetch, then any post that came back physically impossible
 * (more likes than views ⇒ the view count is under-reported) is retried via
 * the richer 'details' route; the LARGER numbers win.
 */
export async function fetchInstagramStats(urls) {
  if (!urls.length) return new Map();
  const out = new Map();
  const collect = (items) => {
    for (const item of Array.isArray(items) ? items : []) {
      const link = item.inputUrl || item.url
        || (item.shortCode ? `https://www.instagram.com/reel/${item.shortCode}/` : null);
      const key = link ? parseClip(link).key : null;
      if (!key) continue;
      const s = normalizeInstagram(item);
      const prev = out.get(key);
      if (!prev || s.views > prev.views) out.set(key, s);
    }
  };

  // 'details' is the CORRECT mode for direct post URLs — full post objects
  // with the real plays count. ('posts' is the profile-listing mode; on single
  // posts it can return a degraded shape with under-reported views.)
  let firstErr = null;
  let unfetched = new Set(urls.map((u) => parseClip(u).key).filter(Boolean)); // until proven fetched
  let failError = null;
  try {
    const items = await inChunks(urls, (chunk) => runActorAsync(INSTA_ACTOR, {
      directUrls: chunk,
      resultsType: 'details',
      resultsLimit: chunk.length,
      addParentData: false,
    }));
    collect(items);
    unfetched = new Set((items.failedInputs || []).map((u) => parseClip(u).key).filter(Boolean));
    failError = items.failError;
  } catch (err) { firstErr = err; failError = String(err.message || err).slice(0, 300); }

  // Second opinion for anything missing or physically impossible (more likes
  // than views ⇒ under-reported): the 'posts' route. Larger numbers win.
  const bad = urls.filter((u) => {
    const k = parseClip(u).key;
    const s = k ? out.get(k) : null;
    return !s || (s.likes != null && s.views < s.likes);
  });
  if (bad.length) {
    try {
      const items = await inChunks(bad, (chunk) => runActorAsync(INSTA_ACTOR, {
        directUrls: chunk,
        resultsType: 'posts',
        resultsLimit: chunk.length,
        addParentData: false,
      }));
      collect(items);
      // After the second pass, "unfetched" = links neither pass could fetch.
      const failed2 = new Set((items.failedInputs || []).map((u) => parseClip(u).key).filter(Boolean));
      unfetched = new Set([...unfetched].filter((k) => failed2.has(k)));
      failError = failError || items.failError;
    } catch (err) {
      if (out.size === 0) throw firstErr || err; // both routes down — real failure
      // Second pass down entirely: everything it was meant to cover stays unknown.
      unfetched = new Set(bad.map((u) => parseClip(u).key).filter((k) => k && !out.has(k)));
      failError = failError || String(err.message || err).slice(0, 300);
    }
  } else if (out.size === 0 && firstErr) throw firstErr;
  out.unfetched = unfetched;
  out.failError = failError;
  return out;
}
