import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { scanClipper } from '../../../../../lib/scan.mjs';

/** POST — scan a clipper's linked accounts for matching recent posts.
 *  Body: { clipperId, perAccount?, autoApprove?, onlyAccounts?: ["platform:handle"] } */
export async function POST(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.clipperId) return NextResponse.json({ ok: false, error: 'clipperId required' }, { status: 400 });
  try {
    const result = await scanClipper({
      cycleId: params.id,
      clipperId: b.clipperId,
      perAccount: Math.min(100, Math.max(1, Math.trunc(Number(b.perAccount)) || 20)),
      autoApprove: Boolean(b.autoApprove),
      onlyAccounts: Array.isArray(b.onlyAccounts) ? b.onlyAccounts.map(String).slice(0, 30) : null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
