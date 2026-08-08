import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { query } from '../../../../../lib/db.mjs';

const MODELS = ['cpm', 'pot_proportional', 'pot_equal', 'placement', 'flat_per_clip'];
const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'twitter', 'other'];
const HASHTAG_MODES = ['off', 'flag', 'auto_reject'];

export async function GET(_req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const { rows } = await query(
    `select id, name, status, starts_on, ends_on, timezone, payout_model,
            budget_cap_cents, min_view_enabled, min_view_floor, allowed_platforms,
            hashtag_mode, required_hashtags, created_at
       from cycles where campaign_id = $1 order by starts_on desc`,
    [params.id],
  );
  return NextResponse.json({ ok: true, cycles: rows });
}

export async function POST(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  // Clone mode: copy settings, CPM rates, and roster from a previous cycle;
  // only name + dates come from the request. New submission tokens are minted.
  if (b.cloneFromCycleId) {
    const src = (await query(`select * from cycles where id = $1 and campaign_id = $2`, [b.cloneFromCycleId, params.id])).rows[0];
    if (!src) return NextResponse.json({ ok: false, error: 'Source cycle not found' }, { status: 404 });
    if (!b.name?.trim() || !b.startsOn || !b.endsOn) {
      return NextResponse.json({ ok: false, error: 'Name, start and end dates are required' }, { status: 400 });
    }
    const { rows } = await query(
      `insert into cycles
         (campaign_id, name, timezone, starts_on, ends_on, payout_model, payout_config,
          budget_cap_cents, min_view_enabled, min_view_floor, allowed_platforms,
          enforce_post_window, hashtag_mode, required_hashtags, auto_check_enabled, check_schedule, status)
       select campaign_id, $1, timezone, $2, $3, payout_model, payout_config,
              budget_cap_cents, min_view_enabled, min_view_floor, allowed_platforms,
              enforce_post_window, hashtag_mode, required_hashtags, auto_check_enabled, check_schedule, 'active'
         from cycles where id = $4
       returning id`,
      [b.name.trim(), b.startsOn, b.endsOn, src.id],
    );
    const newId = rows[0].id;
    await query(
      `insert into cycle_cpm (cycle_id, platform, cpm_cents)
         select $1, platform, cpm_cents from cycle_cpm where cycle_id = $2`,
      [newId, src.id],
    );
    // Re-enroll the same clippers with FRESH tokens.
    const { rows: oldMembers } = await query(`select clipper_id from cycle_clippers where cycle_id = $1`, [src.id]);
    const crypto = await import('node:crypto');
    for (const m of oldMembers) {
      await query(
        `insert into cycle_clippers (cycle_id, clipper_id, submission_token) values ($1,$2,$3)`,
        [newId, m.clipper_id, crypto.randomBytes(12).toString('base64url')],
      );
    }
    return NextResponse.json({ ok: true, cycleId: newId, cloned: true });
  }

  const name = (b.name || '').trim();
  if (!name) return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });
  if (!b.startsOn || !b.endsOn) {
    return NextResponse.json({ ok: false, error: 'Start and end dates are required' }, { status: 400 });
  }
  if (b.endsOn < b.startsOn) {
    return NextResponse.json({ ok: false, error: 'End date must be after the start date' }, { status: 400 });
  }
  const payoutModel = MODELS.includes(b.payoutModel) ? b.payoutModel : 'cpm';
  const hashtagMode = HASHTAG_MODES.includes(b.hashtagMode) ? b.hashtagMode : 'off';
  const allowed = Array.isArray(b.allowedPlatforms)
    ? b.allowedPlatforms.filter((p) => PLATFORMS.includes(p))
    : PLATFORMS;
  if (allowed.length === 0) {
    return NextResponse.json({ ok: false, error: 'Pick at least one platform' }, { status: 400 });
  }

  const toCents = (v) => Math.max(0, Math.round(Number(v || 0) * 100));
  const budgetCents = toCents(b.budgetDollars);
  const requiredHashtags = String(b.requiredHashtags || '')
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#/, '').toLowerCase())
    .filter(Boolean);

  // Model-specific config (kept minimal; editable later from the cycle page).
  const optCents = (v) => {
    const n = Number(v);
    return v !== '' && v != null && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  };
  const payoutConfig = {};
  if (payoutModel === 'cpm') {
    const perClip = optCents(b.maxPerClipDollars);
    const perClipper = optCents(b.maxPerClipperDollars);
    if (perClip) payoutConfig.maxPerClipCents = perClip;
    if (perClipper) payoutConfig.maxPerClipperCents = perClipper;
  }
  if (payoutModel === 'pot_proportional' || payoutModel === 'pot_equal') {
    payoutConfig.potCents = budgetCents;
    payoutConfig.qualifyMinViews = b.minViewEnabled ? Number(b.minViewFloor || 0) : 0;
    const perClipper = optCents(b.maxPerClipperDollars);
    if (payoutModel === 'pot_proportional' && perClipper) payoutConfig.maxPerClipperCents = perClipper;
  }
  if (payoutModel === 'placement') {
    payoutConfig.prizesCents = Array.isArray(b.prizesDollars)
      ? b.prizesDollars.map(toCents).filter((c) => c > 0)
      : [];
    payoutConfig.qualifyMinViews = b.minViewEnabled ? Number(b.minViewFloor || 0) : 0;
  }
  if (payoutModel === 'flat_per_clip') {
    payoutConfig.amountCents = toCents(b.flatAmountDollars);
  }

  const client = await (await import('../../../../../lib/db.mjs')).getPool().connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `insert into cycles
         (campaign_id, name, timezone, starts_on, ends_on, payout_model, payout_config,
          budget_cap_cents, min_view_enabled, min_view_floor,
          allowed_platforms, enforce_post_window, hashtag_mode, required_hashtags, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active')
       returning id`,
      [
        params.id,
        name,
        (b.timezone || '').trim() || null,
        b.startsOn,
        b.endsOn,
        payoutModel,
        JSON.stringify(payoutConfig),
        budgetCents,
        Boolean(b.minViewEnabled),
        Number(b.minViewFloor || 0),
        allowed,
        b.enforcePostWindow !== false,
        hashtagMode,
        requiredHashtags,
      ],
    );
    const cycleId = rows[0].id;

    // CPM rates per platform (dollars per 1000 views -> cents).
    if (payoutModel === 'cpm' && b.cpm && typeof b.cpm === 'object') {
      for (const p of allowed) {
        const cents = toCents(b.cpm[p]);
        await client.query(
          `insert into cycle_cpm (cycle_id, platform, cpm_cents) values ($1,$2,$3)
             on conflict (cycle_id, platform) do update set cpm_cents = excluded.cpm_cents`,
          [cycleId, p, cents],
        );
      }
    }

    await client.query('commit');
    return NextResponse.json({ ok: true, cycleId });
  } catch (err) {
    await client.query('rollback');
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
