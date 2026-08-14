import { NextResponse } from 'next/server';
import { hasSession } from '../../../lib/auth.mjs';
import { query, getPool } from '../../../lib/db.mjs';
import { computeCyclePayouts } from '../../../lib/payouts.mjs';

/**
 * POST — record payouts. Partial payments are first-class: what's owed is
 * always computed-minus-already-paid, and any amount up to that can be paid.
 * Body: { cycleId, action: 'payCycle' }                          -> pay every clipper their remaining
 *       { cycleId, action: 'payClipper', clipperId, amountCents? } -> pay one clipper; amountCents
 *         omitted = their full remaining, otherwise a partial amount (clamped to remaining).
 */
export async function POST(req) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.cycleId) return NextResponse.json({ ok: false, error: 'cycleId required' }, { status: 400 });

  const computed = await computeCyclePayouts(b.cycleId);
  const paidRows = (await query(
    `select clipper_id, coalesce(sum(amount_cents),0)::bigint as paid
       from payouts where cycle_id = $1 group by clipper_id`,
    [b.cycleId],
  )).rows;
  const paidBy = new Map(paidRows.map((r) => [r.clipper_id, Number(r.paid)]));

  let targets = computed.perClipper
    .map((p) => ({ ...p, remainingCents: Math.max(0, p.payoutCents - (paidBy.get(p.clipperId) || 0)) }))
    .filter((p) => p.remainingCents > 0);

  if (b.action === 'payClipper') {
    targets = targets.filter((p) => p.clipperId === b.clipperId);
    if (!targets.length) {
      return NextResponse.json({ ok: false, error: 'Nothing left to pay for this clipper.' }, { status: 400 });
    }
    // Partial amount: clamp to the remaining balance, never overpay.
    if (b.amountCents != null) {
      const amt = Math.trunc(Number(b.amountCents));
      if (!Number.isFinite(amt) || amt <= 0) {
        return NextResponse.json({ ok: false, error: 'Enter a positive amount.' }, { status: 400 });
      }
      targets[0].remainingCents = Math.min(amt, targets[0].remainingCents);
    }
  }
  if (!targets.length) {
    return NextResponse.json({ ok: false, error: 'Nothing left to pay for this cycle.' }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    await client.query('begin');
    for (const t of targets) {
      await client.query(
        `insert into payouts (cycle_id, clipper_id, amount_cents, method, notes)
           values ($1,$2,$3,$4,$5)`,
        [b.cycleId, t.clipperId, t.remainingCents, b.method || null, b.notes || null],
      );
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
  return NextResponse.json({
    ok: true,
    paid: targets.length,
    totalCents: targets.reduce((a, t) => a + t.remainingCents, 0),
  });
}
