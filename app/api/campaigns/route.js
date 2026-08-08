import { NextResponse } from 'next/server';
import { hasSession } from '../../../lib/auth.mjs';
import { query } from '../../../lib/db.mjs';

export async function GET() {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const { rows } = await query(
    `select id, name, streamer_handle, timezone, created_at
       from campaigns where not archived order by created_at desc`,
  );
  return NextResponse.json({ ok: true, campaigns: rows });
}

export async function POST(req) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });

  const timezone = (body.timezone || 'Africa/Casablanca').trim();
  const streamer = (body.streamerHandle || '').trim() || null;
  const avatar = (body.avatar || '').trim() || null;

  const { rows } = await query(
    `insert into campaigns (name, streamer_handle, timezone, avatar_url)
       values ($1, $2, $3, $4)
       returning id, name, streamer_handle, timezone, created_at`,
    [name, streamer, timezone, avatar],
  );
  return NextResponse.json({ ok: true, campaign: rows[0] });
}
