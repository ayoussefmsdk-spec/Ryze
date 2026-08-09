import { NextResponse } from 'next/server';
import { addClip, resolveToken, rateLimited } from '../../../../lib/clips.mjs';
import { fetchSingleClip } from '../../../../lib/check.mjs';

/**
 * PUBLIC endpoint — no session. Auth is the unguessable per-clipper token.
 * Body: { url, confirmDuplicate? }
 */
export async function POST(req, { params }) {
  const token = params.token || '';
  if (rateLimited(token)) {
    return NextResponse.json(
      { ok: false, error: 'Too many submissions — try again in a bit.' },
      { status: 429 },
    );
  }

  const resolved = await resolveToken(token);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: 'This link is not valid anymore.' }, { status: 404 });
  }

  const b = await req.json().catch(() => ({}));
  // Clippers can NEVER force a duplicate through — only the manager's manual
  // add has that override. confirmDuplicate from this endpoint is ignored.
  const result = await addClip({
    cycle: resolved.cycle,
    clipperId: resolved.clipperId,
    url: b.url,
    addedVia: 'submission',
    confirmDuplicate: false,
  });

  if (!result.ok) {
    const status = result.code === 'duplicate' ? 409 : 400;
    // Don't leak other clippers' names to submitters.
    if (result.code === 'duplicate') {
      return NextResponse.json(
        { ok: false, code: 'duplicate', sameClipper: result.existing.sameClipper },
        { status },
      );
    }
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  try { await fetchSingleClip(result.clip.id); } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, platform: result.clip.platform });
}
