import { NextResponse } from 'next/server';
import { hasSession } from '../../../../lib/auth.mjs';

export const dynamic = 'force-dynamic';

/** GET ?url= — X-ray one Instagram post: run BOTH scraper routes and return
 *  every field the actor gives back (values compacted), so "which field holds
 *  the real view count" is answerable by looking instead of guessing.
 *  Manager-only; costs a couple of paid checks per call. */
export async function GET(req) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const url = new URL(req.url).searchParams.get('url') || '';
  if (!/instagram\.com\//i.test(url)) {
    return NextResponse.json({ ok: false, error: 'Pass ?url=<instagram post link>' }, { status: 400 });
  }

  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ ok: false, error: 'APIFY_TOKEN is not set' }, { status: 500 });
  const actor = process.env.APIFY_INSTAGRAM_ACTOR || 'apify~instagram-scraper';

  const compact = (v) => {
    if (v == null || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.length > 120 ? `${v.slice(0, 120)}…(${v.length})` : v;
    if (Array.isArray(v)) return `[array of ${v.length}]`;
    return `{object: ${Object.keys(v).slice(0, 12).join(',')}}`;
  };
  const runActor = async (actorId, input, timeoutSec = 120) => {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSec}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout((timeoutSec + 40) * 1000),
        },
      );
      if (!res.ok) return { error: `${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}` };
      const items = await res.json();
      return {
        items: (Array.isArray(items) ? items : []).slice(0, 3).map((it) =>
          Object.fromEntries(Object.entries(it).map(([k, v]) => [k, compact(v)]))),
      };
    } catch (err) {
      return { error: String(err.message || err).slice(0, 300) };
    }
  };
  const run = (resultsType) =>
    runActor(actor, { directUrls: [url], resultsType, resultsLimit: 1, addParentData: false });

  const [details, posts] = await Promise.all([run('details'), run('posts')]);

  // Fresh-data hunt: direct-post scrapes can get a STALE cached snapshot of a
  // post (day-zero views/likes). Test every other route that might see the
  // CURRENT numbers, so the fix targets whichever source is actually fresh.
  const short = (url.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/) || [])[1] || '';
  const owner = details?.items?.[0]?.ownerUsername || posts?.items?.[0]?.ownerUsername || null;
  const pickMatch = (r) => {
    if (!r?.items) return r;
    const match = r.items.find((it) => String(it.url || it.inputUrl || '').includes(short))
      || (r.items.find((it) => it.shortCode === short));
    return {
      matchingPost: match || `not in the first ${r.items.length} items`,
      sample: r.items.slice(0, 2).map((it) => ({
        url: it.url || it.inputUrl, views: it.videoPlayCount ?? it.videoViewCount, likes: it.likesCount,
      })),
    };
  };
  const [profileGrid, reelsActor, apiScraper] = owner
    ? await Promise.all([
      runActor(actor, {
        directUrls: [`https://www.instagram.com/${owner}/`],
        resultsType: 'posts', resultsLimit: 12, addParentData: false,
      }).then(pickMatch),
      runActor(process.env.APIFY_INSTAGRAM_REELS_ACTOR || 'apify~instagram-reel-scraper', {
        username: [owner], resultsLimit: 12,
      }, 280).then(pickMatch),
      runActor('apify~instagram-api-scraper', {
        directUrls: [url], resultsType: 'posts', resultsLimit: 1,
      }).then(pickMatch),
    ])
    : [null, null, null];

  // Trial ANY store actor: append &actor=someuser~actor-name to the debug URL.
  // Input schemas differ per actor, so several common shapes are tried until
  // one returns items — the result names the shape that worked.
  const customActor = new URL(req.url).searchParams.get('actor');
  let custom = null;
  if (customActor && /^[\w.-]+~[\w-]+$/.test(customActor)) {
    const shapes = [
      { directUrls: [url], resultsType: 'posts', resultsLimit: 1 },
      { directUrls: [url], resultsLimit: 1 },
      { postUrls: [url] },
      { urls: [url] },
      { reelUrls: [url] },
      { startUrls: [{ url }] },
    ];
    const attempts = [];
    for (const input of shapes) {
      const r = await runActor(customActor, input, 180);
      if (r.items?.length) { custom = { actor: customActor, workingInput: Object.keys(input)[0], ...pickMatch(r) }; break; }
      attempts.push({ input: Object.keys(input)[0], error: String(r.error || 'no items').slice(0, 140) });
    }
    if (!custom) custom = { actor: customActor, note: 'no input shape returned items', attempts };
  }

  return NextResponse.json({ ok: true, url, actor, details, posts, profileGrid, reelsActor, apiScraper, custom });
}
