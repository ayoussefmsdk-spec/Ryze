import { NextResponse } from 'next/server';
import { hasSession } from '../../../../lib/auth.mjs';
import { query } from '../../../../lib/db.mjs';
import { fetchSingleClip } from '../../../../lib/check.mjs';

/** GET — one clip + its full check history (powers the per-clip analytics). */
export async function GET(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const clip = (await query(
    `select c.*, cl.name as clipper_name from clips c
       join clippers cl on cl.id = c.clipper_id where c.id = $1`,
    [params.id],
  )).rows[0];
  if (!clip) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  const { rows: history } = await query(
    `select checked_at, views, likes, comments from view_history
      where clip_id = $1 order by checked_at asc limit 500`,
    [params.id],
  );
  return NextResponse.json({
    ok: true,
    clip: { id: clip.id, views: Number(clip.views), likes: clip.likes, comments: clip.comments, engagement: clip.engagement },
    history: history.map((h) => ({
      t: new Date(h.checked_at).toISOString(),
      views: Number(h.views),
      likes: h.likes == null ? null : Number(h.likes),
      comments: h.comments == null ? null : Number(h.comments),
    })),
  });
}

/** PATCH — approve / reject / set manual views / clear a flag. */
export async function PATCH(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'approve' || b.action === 'reject') {
    const status = b.action === 'approve' ? 'approved' : 'rejected';
    await query(`update clips set status = $1 where id = $2`, [status, params.id]);
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'setViews') {
    const views = Math.max(0, Math.trunc(Number(b.views) || 0));
    const num = (x) => (x === '' || x == null ? null : Math.max(0, Math.trunc(Number(x) || 0)));
    // Optional manual likes/comments (for X/manual platforms); else keep stored.
    const cur = (await query(`select likes, comments from clips where id = $1`, [params.id])).rows[0] || {};
    const likes = b.likes !== undefined ? num(b.likes) : cur.likes;
    const comments = b.comments !== undefined ? num(b.comments) : cur.comments;
    const { computeEngagement } = await import('../../../../core/payout.mjs');
    const engagement = computeEngagement({ views, likes, comments });
    await query(
      `update clips set views = $1, likes = $2, comments = $3, engagement = $4,
              source = 'manual', manual_override = true, last_checked_at = now()
        where id = $5`,
      [views, likes, comments, engagement, params.id],
    );
    await query(
      `insert into view_history (clip_id, views) values ($1, $2)`,
      [params.id, views],
    );
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'trustAccount') {
    // Link this clip's account to its clipper and clear the unknown-account
    // flag — here AND on the clipper's other clips from the same handle.
    const clip = (await query(`select clipper_id, platform, account_handle from clips where id = $1`, [params.id])).rows[0];
    if (!clip?.account_handle) {
      return NextResponse.json({ ok: false, error: 'No account handle on this clip yet' }, { status: 400 });
    }
    const handle = clip.account_handle.toLowerCase();
    // If the handle already belongs to a DIFFERENT clipper, say so instead of
    // silently clearing the flag — that's exactly the fraud the flag catches.
    const owner = (await query(
      `select cl.id, cl.name from clipper_accounts a join clippers cl on cl.id = a.clipper_id
        where a.platform = $1 and a.handle = $2`,
      [clip.platform, handle],
    )).rows[0];
    if (owner && owner.id !== clip.clipper_id) {
      return NextResponse.json({
        ok: false,
        error: `@${handle} is already linked to ${owner.name} — unlink it there first if it really belongs to this clipper.`,
      }, { status: 409 });
    }
    await query(
      `insert into clipper_accounts (clipper_id, platform, handle) values ($1,$2,$3)
         on conflict (platform, handle) do nothing`,
      [clip.clipper_id, clip.platform, handle],
    );
    await query(
      `update clips set flags = array_remove(flags, 'unknown_account')
        where clipper_id = $1 and platform = $2 and lower(account_handle) = $3`,
      [clip.clipper_id, clip.platform, handle],
    );
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'clearFlag' && typeof b.flag === 'string') {
    // Sticky: remember the dismissal so later checks never re-add this flag.
    await query(
      `update clips set flags = array_remove(flags, $1),
              dismissed_flags = (select array(select distinct unnest(dismissed_flags || $1)))
        where id = $2`,
      [b.flag, params.id],
    );
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'markInWindow') {
    // "Count it as in-cycle": clamp posted_at to the nearest cycle edge so the
    // outside_dates flag stays gone on every future check.
    const row = (await query(
      `select c.posted_at, cy.starts_on, cy.ends_on from clips c
         join cycles cy on cy.id = c.cycle_id where c.id = $1`,
      [params.id],
    )).rows[0];
    if (!row) return NextResponse.json({ ok: false, error: 'Clip not found' }, { status: 404 });
    const posted = row.posted_at ? new Date(row.posted_at).getTime() : null;
    const start = Date.parse(`${String(row.starts_on)}T12:00:00Z`);
    const end = Date.parse(`${String(row.ends_on)}T12:00:00Z`);
    const clamped = posted == null || posted < start ? start : posted > end ? end : posted;
    await query(
      `update clips set posted_at = $1, flags = array_remove(flags, 'outside_dates') where id = $2`,
      [new Date(clamped).toISOString(), params.id],
    );
    return NextResponse.json({ ok: true, postedAt: new Date(clamped).toISOString() });
  }

  if (b.action === 'recheck') {
    try {
      const updated = await fetchSingleClip(params.id);
      return NextResponse.json({ ok: true, clip: updated });
    } catch (err) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
}

/** DELETE — remove a clip entirely, leaving a tombstone so the same video
 *  can't quietly re-enter this cycle (clippers blocked, manager confirms). */
export async function DELETE(_req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  await query(
    `insert into deleted_clips (cycle_id, normalized_key, url, platform, clipper_id)
       select cycle_id, normalized_key, url, platform, clipper_id from clips where id = $1
     on conflict (cycle_id, normalized_key) do update set deleted_at = now()`,
    [params.id],
  );
  await query(`delete from clips where id = $1`, [params.id]);
  return NextResponse.json({ ok: true });
}
