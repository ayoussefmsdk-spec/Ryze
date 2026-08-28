import { NextResponse } from 'next/server';
import { hasSession } from '../../../../lib/auth.mjs';

export const dynamic = 'force-dynamic';

/** GET ?url=<fb post>&handle=<page username>[&actor=user~name] — X-ray for
 *  Facebook fetching: tries the direct posts actor on the URL, the reels actor
 *  on the page, and optionally any store actor, returning every field of the
 *  raw items (values compacted). Same tool that cracked the IG views mystery. */
export async function GET(req) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const url = sp.get('url') || '';
  const handle = (sp.get('handle') || '').replace(/^@/, '');
  const customActor = sp.get('actor');
  const token = process.env.APIFY_TOKEN;
  if (!token) return NextResponse.json({ ok: false, error: 'APIFY_TOKEN is not set' }, { status: 500 });

  const compact = (v) => {
    if (v == null || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.length > 120 ? `${v.slice(0, 120)}…(${v.length})` : v;
    if (Array.isArray(v)) return `[array of ${v.length}]`;
    return `{object: ${Object.keys(v).slice(0, 12).join(',')}}`;
  };
  const run = async (actorId, input) => {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=180`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(220000),
        },
      );
      if (!res.ok) return { input: Object.keys(input).join(','), error: `${res.status}: ${(await res.text().catch(() => '')).slice(0, 250)}` };
      const items = await res.json();
      return {
        input: Object.keys(input).join(','),
        count: Array.isArray(items) ? items.length : 0,
        items: (Array.isArray(items) ? items : []).slice(0, 3).map((it) =>
          Object.fromEntries(Object.entries(it).map(([k, v]) => [k, compact(v)]))),
      };
    } catch (err) {
      return { input: Object.keys(input).join(','), error: String(err.message || err).slice(0, 250) };
    }
  };

  const postsActor = process.env.APIFY_FACEBOOK_POSTS_ACTOR || 'apify~facebook-posts-scraper';
  const reelsActor = process.env.APIFY_FACEBOOK_ACTOR || 'apify~facebook-reels-scraper';

  const [directPost, pageReels, custom] = await Promise.all([
    url ? run(postsActor, { startUrls: [{ url }], resultsLimit: 1 }) : null,
    handle ? run(reelsActor, { startUrls: [{ url: `https://www.facebook.com/${handle}/reels/` }], resultsLimit: 5 }) : null,
    customActor && /^[\w.-]+~[\w-]+$/.test(customActor) && url
      ? run(customActor, { startUrls: [{ url }], resultsLimit: 3 })
      : null,
  ]);
  // Second attempt for the reels actor with a different common input shape.
  const pageReels2 = handle && (pageReels?.error || pageReels?.count === 0)
    ? await run(reelsActor, { profiles: [handle], resultsLimit: 5 })
    : null;

  return NextResponse.json({ ok: true, url, handle, postsActor, reelsActor, directPost, pageReels, pageReels2, custom });
}
