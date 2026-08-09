import { NextResponse } from 'next/server';
import { hasSession } from '../../../../lib/auth.mjs';
import { query } from '../../../../lib/db.mjs';

/** PATCH — edit campaign identity/settings, or archive/unarchive. */
export async function PATCH(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  const current = (await query(`select * from campaigns where id = $1`, [params.id])).rows[0];
  if (!current) return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });

  const FIELDS = {
    name: { col: 'name', map: (v) => String(v).trim() },
    streamerHandle: { col: 'streamer_handle', map: (v) => String(v).trim() || null },
    avatar: { col: 'avatar_url', map: (v) => String(v).trim() || null },
    timezone: { col: 'timezone', map: (v) => String(v).trim() || 'UTC' },
    notes: { col: 'notes', map: (v) => String(v).trim() || null },
    archived: { col: 'archived', map: Boolean },
  };

  if ('name' in b && !String(b.name).trim()) {
    return NextResponse.json({ ok: false, error: 'Name can’t be empty' }, { status: 400 });
  }

  const sets = [];
  const vals = [];
  for (const [field, def] of Object.entries(FIELDS)) {
    if (!(field in b)) continue;
    vals.push(def.map(b[field]));
    sets.push(`${def.col} = $${vals.length}`);
  }
  if (!sets.length) return NextResponse.json({ ok: false, error: 'Nothing to update' }, { status: 400 });
  vals.push(params.id);
  await query(`update campaigns set ${sets.join(', ')} where id = $${vals.length}`, vals);
  return NextResponse.json({ ok: true });
}

/**
 * DELETE — permanently remove the campaign and (via cascade) every cycle,
 * clip, payout and view-history row under it. The client must echo the
 * campaign's exact name as confirmation.
 */
export async function DELETE(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  const current = (await query(`select name from campaigns where id = $1`, [params.id])).rows[0];
  if (!current) return NextResponse.json({ ok: false, error: 'Campaign not found' }, { status: 404 });
  if ((b.confirmName || '') !== current.name) {
    return NextResponse.json({ ok: false, error: 'Confirmation name does not match.' }, { status: 400 });
  }

  await query(`delete from campaigns where id = $1`, [params.id]);
  return NextResponse.json({ ok: true });
}
