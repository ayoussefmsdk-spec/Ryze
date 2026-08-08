import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { query } from '../../../../../lib/db.mjs';

/** GET — clippers enrolled in this cycle, with their submission tokens. */
export async function GET(_req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const { rows } = await query(
    `select cc.clipper_id, cc.submission_token, cl.name
       from cycle_clippers cc join clippers cl on cl.id = cc.clipper_id
      where cc.cycle_id = $1 order by cl.name`,
    [params.id],
  );
  return NextResponse.json({ ok: true, members: rows });
}

/** POST — enroll a clipper (generates their private submission token). */
export async function POST(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.clipperId) return NextResponse.json({ ok: false, error: 'clipperId required' }, { status: 400 });
  const token = crypto.randomBytes(12).toString('base64url'); // unguessable, URL-safe
  await query(
    `insert into cycle_clippers (cycle_id, clipper_id, submission_token)
       values ($1, $2, $3) on conflict (cycle_id, clipper_id) do nothing`,
    [params.id, b.clipperId, token],
  );
  return NextResponse.json({ ok: true });
}

/** DELETE — remove a clipper from the cycle (their clips stay). */
export async function DELETE(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const clipperId = searchParams.get('clipperId');
  if (!clipperId) return NextResponse.json({ ok: false, error: 'clipperId required' }, { status: 400 });
  await query(`delete from cycle_clippers where cycle_id = $1 and clipper_id = $2`, [params.id, clipperId]);
  return NextResponse.json({ ok: true });
}

/** PATCH — regenerate a clipper's submission token (revoke the old link). */
export async function PATCH(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.clipperId) return NextResponse.json({ ok: false, error: 'clipperId required' }, { status: 400 });
  const token = crypto.randomBytes(12).toString('base64url');
  await query(
    `update cycle_clippers set submission_token = $1 where cycle_id = $2 and clipper_id = $3`,
    [token, params.id, b.clipperId],
  );
  return NextResponse.json({ ok: true, token });
}
