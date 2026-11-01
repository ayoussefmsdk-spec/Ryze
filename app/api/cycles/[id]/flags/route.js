import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { query } from '../../../../../lib/db.mjs';
import { TRANSIENT_FLAGS } from '../../../../../core/normalize.mjs';

/** DELETE — dismiss EVERY flag on every clip in this cycle, the bulk twin of
 *  the per-clip ✕. Sticky, same as the single version: each flag moves into
 *  dismissed_flags so later checks never re-raise it on that clip — except
 *  per-fetch flags (TRANSIENT_FLAGS), which are cleared but never remembered. Rejected
 *  clips are left alone (their flags document why they were rejected). */
export async function DELETE(_req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const { rowCount } = await query(
    `update clips set
        dismissed_flags = (select array(select distinct f from unnest(dismissed_flags || flags) f
                                         where not (f = any($2::text[])))),
        flags = '{}'
      where cycle_id = $1 and array_length(flags, 1) > 0 and status <> 'rejected'`,
    [params.id, TRANSIENT_FLAGS],
  );
  return NextResponse.json({ ok: true, cleared: rowCount });
}
