import { NextResponse } from 'next/server';
import { resolveViewerCode } from '../../../../../../lib/viewer.mjs';
import { query } from '../../../../../../lib/db.mjs';
import { limited, clientIp } from '../../../../../../lib/ratelimit.mjs';

/**
 * PUBLIC, viewer-code-scoped: one clip's stats + check history for the
 * streamer room's analytics modal. Only clips belonging to the code's cycle
 * resolve; never any money fields.
 */
export async function GET(req, { params }) {
  const ip = clientIp(req.headers);
  if (limited(`watchclip:${ip}`, { max: 240, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const res = await resolveViewerCode(params.code).catch(() => null);
  if (!res?.ok) return NextResponse.json({ ok: false }, { status: 404 });

  const clip = (await query(
    `select id, views, likes, comments, engagement from clips
      where id = $1 and cycle_id = $2 and status = 'approved'`,
    [params.clipId, res.cycle.id],
  )).rows[0];
  if (!clip) return NextResponse.json({ ok: false }, { status: 404 });

  const { rows: history } = await query(
    `select checked_at, views, likes, comments from view_history
      where clip_id = $1 order by checked_at asc limit 500`,
    [params.clipId],
  );
  return NextResponse.json({
    ok: true,
    history: history.map((h) => ({
      t: new Date(h.checked_at).toISOString(),
      views: Number(h.views),
      likes: h.likes == null ? null : Number(h.likes),
      comments: h.comments == null ? null : Number(h.comments),
    })),
  });
}
