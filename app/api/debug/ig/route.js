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
  const run = async (resultsType) => {
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=120`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ directUrls: [url], resultsType, resultsLimit: 1, addParentData: false }),
          signal: AbortSignal.timeout(150000),
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

  const [details, posts] = await Promise.all([run('details'), run('posts')]);
  return NextResponse.json({ ok: true, url, actor, details, posts });
}
