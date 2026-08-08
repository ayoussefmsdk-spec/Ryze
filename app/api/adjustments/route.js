import { NextResponse } from 'next/server';
import { hasSession } from '../../../lib/auth.mjs';
import { query } from '../../../lib/db.mjs';

/** POST — add a manual bonus (+) or deduction (−) for a clipper in a cycle. */
export async function POST(req) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const cents = Math.round(Number(b.amountDollars || 0) * 100);
  if (!b.cycleId || !b.clipperId || !cents) {
    return NextResponse.json({ ok: false, error: 'cycleId, clipperId and a non-zero amount are required' }, { status: 400 });
  }
  await query(
    `insert into payout_adjustments (cycle_id, clipper_id, amount_cents, reason)
       values ($1,$2,$3,$4)`,
    [b.cycleId, b.clipperId, cents, (b.reason || '').trim() || null],
  );
  return NextResponse.json({ ok: true });
}
