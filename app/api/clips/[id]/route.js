import { NextResponse } from 'next/server';
import { hasSession } from '../../../../lib/auth.mjs';
import { query } from '../../../../lib/db.mjs';
import { fetchSingleClip } from '../../../../lib/check.mjs';

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
    // Link this clip's account to its clipper and clear the unknown-account flag.
    const clip = (await query(`select clipper_id, platform, account_handle from clips where id = $1`, [params.id])).rows[0];
    if (!clip?.account_handle) {
      return NextResponse.json({ ok: false, error: 'No account handle on this clip yet' }, { status: 400 });
    }
    await query(
      `insert into clipper_accounts (clipper_id, platform, handle) values ($1,$2,$3)
         on conflict (platform, handle) do nothing`,
      [clip.clipper_id, clip.platform, clip.account_handle.toLowerCase()],
    );
    await query(`update clips set flags = array_remove(flags, 'unknown_account') where id = $1`, [params.id]);
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'clearFlag' && typeof b.flag === 'string') {
    await query(`update clips set flags = array_remove(flags, $1) where id = $2`, [b.flag, params.id]);
    return NextResponse.json({ ok: true });
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

/** DELETE — remove a clip entirely. */
export async function DELETE(_req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  await query(`delete from clips where id = $1`, [params.id]);
  return NextResponse.json({ ok: true });
}
