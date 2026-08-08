import { NextResponse } from 'next/server';
import { hasSession } from '../../../lib/auth.mjs';
import { query } from '../../../lib/db.mjs';

/** GET ?q= — unified search across campaigns, cycles, clippers for the palette. */
export async function GET(req) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 1) return NextResponse.json({ ok: true, results: [] });
  const like = `%${q}%`;

  const [camps, cycles, clippers] = await Promise.all([
    query(`select id, name from campaigns where not archived and name ilike $1 limit 5`, [like]),
    query(
      `select cy.id, cy.name, ca.name as campaign from cycles cy
         join campaigns ca on ca.id = cy.campaign_id
        where cy.name ilike $1 or ca.name ilike $1
        order by cy.starts_on desc limit 6`, [like],
    ),
    query(`select id, name from clippers where not archived and name ilike $1 limit 5`, [like]),
  ]);

  const results = [
    ...camps.rows.map((r) => ({ type: 'campaign', label: r.name, href: `/campaign/${r.id}` })),
    ...cycles.rows.map((r) => ({ type: 'cycle', label: `${r.campaign} · ${r.name}`, href: `/cycle/${r.id}` })),
    ...clippers.rows.map((r) => ({ type: 'clipper', label: r.name, href: `/clipper/${r.id}` })),
  ];
  return NextResponse.json({ ok: true, results });
}
