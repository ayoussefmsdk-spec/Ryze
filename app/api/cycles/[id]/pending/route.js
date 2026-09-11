import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { query } from '../../../../../lib/db.mjs';

/** DELETE — bulk-clear the cycle's pending queue. Body: { scope: 'all' | 'scan' }
 *  ('scan' = only clips a scan ingested; hand-added and submitted ones stay).
 *  Every deleted clip leaves a tombstone, so a re-scan won't bring it back —
 *  the cherry-pick workflow: scan wide, approve the keepers, delete the rest. */
export async function DELETE(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const scanOnly = b.scope === 'scan';
  const filter = `cycle_id = $1 and status = 'pending'${scanOnly ? ` and added_via = 'scan'` : ''}`;

  await query(
    `insert into deleted_clips (cycle_id, normalized_key, url, platform, clipper_id)
       select cycle_id, normalized_key, url, platform, clipper_id from clips where ${filter}
     on conflict (cycle_id, normalized_key) do update set deleted_at = now()`,
    [params.id],
  );
  const { rowCount } = await query(`delete from clips where ${filter}`, [params.id]);
  return NextResponse.json({ ok: true, deleted: rowCount });
}
