import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { findViewDrops, restoreViewDrops } from '../../../../../lib/drops.mjs';

export const dynamic = 'force-dynamic';

/** GET — clips sitting below their recent view peak. */
export async function GET(_req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await findViewDrops(params.id)) });
}

/** POST { ids?: [clipId] } — restore those (or all) to their recent peak. */
export async function POST(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const ids = Array.isArray(b.ids) ? b.ids.map(String).slice(0, 5000) : null;
  try {
    return NextResponse.json({ ok: true, ...(await restoreViewDrops(params.id, ids)) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
