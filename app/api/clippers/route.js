import { NextResponse } from 'next/server';
import { hasSession } from '../../../lib/auth.mjs';
import { query } from '../../../lib/db.mjs';

export async function GET() {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const { rows } = await query(
    `select cl.id, cl.name, cl.payment_handle, cl.notes,
            coalesce(json_agg(json_build_object('id', a.id, 'platform', a.platform, 'handle', a.handle)
                     order by a.platform, a.handle)
                     filter (where a.id is not null), '[]') as accounts
       from clippers cl
       left join clipper_accounts a on a.clipper_id = cl.id
      where not cl.archived
      group by cl.id
      order by cl.name`,
  );
  return NextResponse.json({ ok: true, clippers: rows });
}

export async function POST(req) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!name) return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });
  const { rows } = await query(
    `insert into clippers (name, payment_handle, notes) values ($1, $2, $3)
       returning id, name, payment_handle, notes`,
    [name, (b.paymentHandle || '').trim() || null, (b.notes || '').trim() || null],
  );
  return NextResponse.json({ ok: true, clipper: rows[0] });
}
