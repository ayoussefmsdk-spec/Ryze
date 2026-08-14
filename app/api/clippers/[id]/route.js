import { NextResponse } from 'next/server';
import { hasSession } from '../../../../lib/auth.mjs';
import { query } from '../../../../lib/db.mjs';
import { verifyAccountExists } from '../../../../lib/verifyAccount.mjs';
import { normalizeHandleInput } from '../../../../core/platform.mjs';

const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'twitter', 'other'];

/** PATCH — update clipper details, or add/remove a linked account. */
export async function PATCH(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b.action === 'addAccount') {
    const platform = PLATFORMS.includes(b.platform) ? b.platform : null;
    // Accepts "@Handle", " @handle ", plain handles, or pasted profile URLs —
    // always stored clean (lowercase, no @, no spaces) so matching never misses.
    const handle = normalizeHandleInput(platform, b.handle);
    if (!platform || !handle) {
      return NextResponse.json({ ok: false, error: 'Platform and handle are required' }, { status: 400 });
    }
    // Existence check — a typo'd handle would silently break scans + matching.
    // force:true skips it (private accounts / temporary blocks).
    let verified = 'skipped';
    if (!b.force) {
      verified = await verifyAccountExists(platform, handle);
      if (verified === 'notfound') {
        return NextResponse.json({
          ok: false,
          code: 'invalid_handle',
          error: `@${handle} doesn't seem to exist on ${platform} — double-check the spelling.`,
        }, { status: 422 });
      }
    }
    try {
      const { rows } = await query(
        `insert into clipper_accounts (clipper_id, platform, handle) values ($1,$2,$3)
           returning id, platform, handle`,
        [params.id, platform, handle],
      );
      return NextResponse.json({ ok: true, account: rows[0], verified });
    } catch (err) {
      if (/unique/i.test(err.message)) {
        return NextResponse.json({ ok: false, error: 'That handle is already linked to a clipper' }, { status: 409 });
      }
      throw err;
    }
  }

  if (b.action === 'removeAccount') {
    await query(`delete from clipper_accounts where id = $1 and clipper_id = $2`, [b.accountId, params.id]);
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'archive') {
    await query(`update clippers set archived = true where id = $1`, [params.id]);
    return NextResponse.json({ ok: true });
  }

  // Plain field updates.
  const sets = [];
  const vals = [];
  if (typeof b.name === 'string' && b.name.trim()) { vals.push(b.name.trim()); sets.push(`name = $${vals.length}`); }
  if (typeof b.paymentHandle === 'string') { vals.push(b.paymentHandle.trim() || null); sets.push(`payment_handle = $${vals.length}`); }
  if (typeof b.notes === 'string') { vals.push(b.notes.trim() || null); sets.push(`notes = $${vals.length}`); }
  if (!sets.length) return NextResponse.json({ ok: false, error: 'Nothing to update' }, { status: 400 });
  vals.push(params.id);
  await query(`update clippers set ${sets.join(', ')} where id = $${vals.length}`, vals);
  return NextResponse.json({ ok: true });
}
