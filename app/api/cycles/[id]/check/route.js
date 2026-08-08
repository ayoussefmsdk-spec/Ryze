import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { runCheck } from '../../../../../lib/check.mjs';

/** POST — "Check now". Body: { scope: 'free' | 'all' } */
export async function POST(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const scope = b.scope === 'free' ? 'free' : 'all';
  try {
    const summary = await runCheck(params.id, { scope });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
