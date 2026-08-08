import { NextResponse } from 'next/server';
import { hasSession } from '../../../lib/auth.mjs';
import { query, getPool } from '../../../lib/db.mjs';
import { computeCyclePayouts } from '../../../lib/payouts.mjs';

/**
 * POST — record payouts.
 * Body: { cycleId, action: 'payCycle' }              -> settle every unpaid clipper
 *       { cycleId, action: 'payClipper', clipperId } -> settle one clipper
 */
export async function POST(req) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.cycleId) return NextResponse.json({ ok: false, error: 'cycleId required' }, { status: 400 });

  const computed = await computeCyclePayouts(b.cycleId);
  const already = new Set(
    (await query(`select clipper_id from payouts where cycle_id = $1`, [b.cycleId])).rows.map((r) => r.clipper_id),
  );

  let targets = computed.perClipper.filter((p) => !already.has(p.clipperId) && p.payoutCents > 0);
  if (b.action === 'payClipper') {
    targets = targets.filter((p) => p.clipperId === b.clipperId);
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
        [b.cycleId, t.clipperId, t.payoutCents, b.method || null, b.notes || null],
      );
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true, paid: targets.length });
}
