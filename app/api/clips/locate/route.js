import { NextResponse } from 'next/server';
import { hasSession } from '../../../../lib/auth.mjs';
import { query } from '../../../../lib/db.mjs';
import { parseClip } from '../../../../core/platform.mjs';

/** GET ?url= — the whole truth about one video: every copy of it anywhere in
 *  the app (any cycle, any clipper, any status) and any deletion tombstones.
 *  Answers "it says it's already uploaded — where?" definitively. */
export async function GET(req) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const url = new URL(req.url).searchParams.get('url') || '';
  const key = parseClip(url).key;
  if (!key) return NextResponse.json({ ok: false, error: 'Not a recognizable clip link' }, { status: 400 });

  const [copies, tombstones] = await Promise.all([
    query(
      `select c.id, c.status, c.views, c.url, c.created_at,
              cl.name as clipper_name, cy.id as cycle_id, cy.name as cycle_name, ca.name as campaign_name
         from clips c
         join clippers cl on cl.id = c.clipper_id
         join cycles cy on cy.id = c.cycle_id
         join campaigns ca on ca.id = cy.campaign_id
        where c.normalized_key = $1
        order by c.created_at desc`,
      [key],
    ),
    query(
      `select dc.deleted_at, cy.id as cycle_id, cy.name as cycle_name, ca.name as campaign_name
         from deleted_clips dc
         join cycles cy on cy.id = dc.cycle_id
         join campaigns ca on ca.id = cy.campaign_id
        where dc.normalized_key = $1
        order by dc.deleted_at desc`,
      [key],
    ),
  ]);

  return NextResponse.json({
    ok: true,
    key,
    copies: copies.rows.map((r) => ({
      clipId: r.id, status: r.status, views: Number(r.views), url: r.url,
      clipper: r.clipper_name, cycleId: r.cycle_id, cycle: r.cycle_name, campaign: r.campaign_name,
    })),
    tombstones: tombstones.rows.map((r) => ({
      deletedAt: r.deleted_at, cycleId: r.cycle_id, cycle: r.cycle_name, campaign: r.campaign_name,
    })),
  });
}
