import { NextResponse } from 'next/server';
import { hasSession } from '../../../../lib/auth.mjs';
import { query } from '../../../../lib/db.mjs';

// Editable-mid-cycle fields -> column + how to store the value.
const EDITABLE = {
  name: { col: 'name', map: (v) => String(v).trim() },
  startsOn: { col: 'starts_on', map: (v) => String(v) },
  endsOn: { col: 'ends_on', map: (v) => String(v) },
  timezone: { col: 'timezone', map: (v) => String(v).trim() || null },
  budgetDollars: { col: 'budget_cap_cents', map: (v) => Math.max(0, Math.round(Number(v || 0) * 100)) },
  minViewEnabled: { col: 'min_view_enabled', map: Boolean },
  minViewFloor: { col: 'min_view_floor', map: (v) => Math.max(0, Math.trunc(Number(v) || 0)) },
  enforcePostWindow: { col: 'enforce_post_window', map: Boolean },
  hashtagMode: { col: 'hashtag_mode', map: (v) => (['off', 'flag', 'auto_reject'].includes(v) ? v : 'off') },
  requiredHashtags: {
    col: 'required_hashtags',
    map: (v) => String(v || '').split(/[,\s]+/).map((t) => t.replace(/^#/, '').toLowerCase()).filter(Boolean),
  },
  payoutConfig: { col: 'payout_config', map: (v) => JSON.stringify(v && typeof v === 'object' ? v : {}) },
  autoCheckEnabled: { col: 'auto_check_enabled', map: Boolean },
  checkSchedule: { col: 'check_schedule', map: (v) => JSON.stringify(v && typeof v === 'object' ? v : {}) },
};

/** PATCH — edit cycle settings mid-flight (logged), stop/resume tracking, set CPM. */
export async function PATCH(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  const current = (await query(`select * from cycles where id = $1`, [params.id])).rows[0];
  if (!current) return NextResponse.json({ ok: false, error: 'Cycle not found' }, { status: 404 });

  if (b.action === 'stopTracking' || b.action === 'resumeTracking') {
    const to = b.action === 'stopTracking' ? 'frozen' : 'active';
    await query(
      `update cycles set status = $1::cycle_status_t,
              freeze_at = case when $1::text = 'frozen' then now() else null end
        where id = $2`,
      [to, params.id],
    );
    await query(
      `insert into cycle_changes (cycle_id, field, old_value, new_value, note)
         values ($1, 'status', $2, $3, $4)`,
      [params.id, current.status, to, b.action === 'stopTracking' ? 'Manually stopped' : 'Manually resumed'],
    );
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'setCpm') {
    const cents = Math.max(0, Math.round(Number(b.dollars || 0) * 100));
    await query(
      `insert into cycle_cpm (cycle_id, platform, cpm_cents) values ($1,$2,$3)
         on conflict (cycle_id, platform) do update set cpm_cents = excluded.cpm_cents`,
      [params.id, b.platform, cents],
    );
    await query(
      `insert into cycle_changes (cycle_id, field, new_value) values ($1, $2, $3)`,
      [params.id, `cpm.${b.platform}`, `$${(cents / 100).toFixed(2)}`],
    );
    return NextResponse.json({ ok: true });
  }

  // Date sanity: the cycle can't end before it starts.
  const nextStarts = 'startsOn' in b ? String(b.startsOn) : String(current.starts_on).slice(0, 10);
  const nextEnds = 'endsOn' in b ? String(b.endsOn) : String(current.ends_on).slice(0, 10);
  if (('startsOn' in b || 'endsOn' in b) && nextEnds < nextStarts) {
    return NextResponse.json({ ok: false, error: 'End date must be on or after the start date.' }, { status: 400 });
  }

  // Plain field edits — each change is recorded in the cycle change log.
  const sets = [];
  const vals = [];
  for (const [field, def] of Object.entries(EDITABLE)) {
    if (!(field in b)) continue;
    const value = def.map(b[field]);
    vals.push(value);
    sets.push(`${def.col} = $${vals.length}`);
    await query(
      `insert into cycle_changes (cycle_id, field, old_value, new_value)
         values ($1, $2, $3, $4)`,
      [params.id, def.col, String(current[def.col] ?? ''), String(Array.isArray(value) ? value.join(',') : value ?? '')],
    );
  }
  if (!sets.length) return NextResponse.json({ ok: false, error: 'Nothing to update' }, { status: 400 });
  vals.push(params.id);
  await query(`update cycles set ${sets.join(', ')} where id = $${vals.length}`, vals);
  return NextResponse.json({ ok: true });
}
