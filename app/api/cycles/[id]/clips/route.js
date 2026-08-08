import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { addClip, getCycle } from '../../../../../lib/clips.mjs';
import { fetchSingleClip } from '../../../../../lib/check.mjs';

/** POST — manager adds a clip manually. Body: { clipperId, url, confirmDuplicate? } */
export async function POST(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.clipperId) return NextResponse.json({ ok: false, error: 'Pick a clipper' }, { status: 400 });

  const cycle = await getCycle(params.id);
  const result = await addClip({
    cycle,
    clipperId: b.clipperId,
    url: b.url,
    addedVia: 'manual',
    confirmDuplicate: Boolean(b.confirmDuplicate),
  });

  if (!result.ok) {
    const status = result.code === 'duplicate' ? 409 : 400;
    return NextResponse.json(result, { status });
  }

  // Best effort: fetch stats right away so the pending row shows real numbers
  // and the date/hashtag/account checks can run. Failures are non-fatal.
  try { await fetchSingleClip(result.clip.id); } catch { /* flagged on next check */ }

  return NextResponse.json(result);
}
