// Shared clip-ingestion logic used by the manager's manual add AND the public
// per-clipper submission endpoint. One code path = one set of rules.
import { parseClip } from '../core/platform.mjs';
import { query } from './db.mjs';

/**
 * addClip({ cycle, clipperId, url, addedVia, confirmDuplicate })
 * Returns:
 *   { ok: true, clip }                          — inserted (possibly with flags)
 *   { ok: false, code, error }                  — validation failure
 *   { ok: false, code: 'duplicate', existing }  — duplicate found and not confirmed
 */
export async function addClip({ cycle, clipperId, url, addedVia = 'manual', confirmDuplicate = false }) {
  const parsed = parseClip(url);
  if (!parsed.valid || !parsed.key) {
    return { ok: false, code: 'bad_url', error: "That doesn't look like a valid clip link." };
  }
  const { platform, key, handle, canonicalUrl } = parsed;

  if (!cycle) return { ok: false, code: 'no_cycle', error: 'No active cycle to submit into.' };
  if (cycle.status !== 'active') {
    return { ok: false, code: 'cycle_closed', error: 'Submissions are closed for this cycle.' };
  }
  const allowed = cycle.allowed_platforms || [];
  if (allowed.length && !allowed.includes(platform)) {
    return { ok: false, code: 'platform_not_allowed', error: `This cycle doesn't accept ${platform} clips.` };
  }

  // Duplicate detection — same canonical video in this cycle (any clipper).
  const dup = await query(
    `select c.id, c.url, c.status, cl.name as clipper_name, c.clipper_id
       from clips c join clippers cl on cl.id = c.clipper_id
      where c.cycle_id = $1 and c.normalized_key = $2
      limit 1`,
    [cycle.id, key],
  );
  const flags = [];
  if (dup.rows.length) {
    if (!confirmDuplicate) {
      return {
        ok: false,
        code: 'duplicate',
        // Enough detail for the MANAGER's UI to point at the existing copy
        // (the public submit route only forwards sameClipper — no leaks).
        existing: {
          sameClipper: dup.rows[0].clipper_id === clipperId,
          clipperName: dup.rows[0].clipper_name,
          status: dup.rows[0].status,
          url: dup.rows[0].url,
          clipId: dup.rows[0].id,
        },
      };
    }
    flags.push('duplicate');
  } else {
    // Deleted-clip memory: this exact video was removed from this cycle before.
    // Clippers are always blocked; the manager can knowingly re-add (flagged).
    const tomb = await query(
      `select deleted_at from deleted_clips where cycle_id = $1 and normalized_key = $2`,
      [cycle.id, key],
    );
    if (tomb.rows.length) {
      if (!confirmDuplicate) {
        const when = new Date(tomb.rows[0].deleted_at).toLocaleDateString('en-US');
        return {
          ok: false,
          code: 'deleted_before',
          error: `This clip was removed from this cycle on ${when} — it can’t be submitted again.`,
        };
      }
      flags.push('previously_deleted');
    }
    // Same video used in a PREVIOUS cycle (recycled clip) — flag, don't block.
    const past = await query(
      `select 1 from clips where normalized_key = $1 and cycle_id <> $2 limit 1`,
      [key, cycle.id],
    );
    if (past.rows.length) flags.push('repeat_from_past_cycle');
  }

  // Account match for platforms whose URL reveals the poster (TikTok, X).
  if (handle) {
    const known = await query(
      `select 1 from clipper_accounts where clipper_id = $1 and platform = $2 and handle = $3`,
      [clipperId, platform, handle],
    );
    const anyLinked = await query(
      `select 1 from clipper_accounts where clipper_id = $1 and platform = $2 limit 1`,
      [clipperId, platform],
    );
    if (anyLinked.rows.length && !known.rows.length) flags.push('unknown_account');
  }

  // The clips_one_per_cycle unique index is the hard backstop: even if two
  // submissions race past the check above, the database allows only one
  // un-flagged copy per cycle — the loser gets a clean duplicate answer.
  try {
    const { rows } = await query(
      `insert into clips (cycle_id, clipper_id, platform, url, normalized_key, account_handle, added_via, flags)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning *`,
      [cycle.id, clipperId, platform, canonicalUrl || url, key, handle, addedVia, flags],
    );
    return { ok: true, clip: rows[0] };
  } catch (err) {
    if (/clips_one_per_cycle|unique/i.test(err.message)) {
      return { ok: false, code: 'duplicate', existing: { sameClipper: false, clipperName: null } };
    }
    throw err;
  }
}

/** Load a cycle row by id. */
export async function getCycle(cycleId) {
  const { rows } = await query(`select * from cycles where id = $1`, [cycleId]);
  return rows[0] || null;
}

/** Resolve a public submission token -> { cycle, clipperId, clipperName }.
 *  Revoked or expired links resolve to null — the page shows "link not valid". */
export async function resolveToken(token) {
  const { rows } = await query(
    `select cc.clipper_id, cl.name as clipper_name, cy.*
       from cycle_clippers cc
       join clippers cl on cl.id = cc.clipper_id
       join cycles cy on cy.id = cc.cycle_id
      where cc.submission_token = $1
        and not cc.token_revoked
        and (cc.token_expires_at is null or cc.token_expires_at > now())`,
    [token],
  );
  if (!rows.length) return null;
  const { clipper_id, clipper_name, ...cycle } = rows[0];
  return { cycle, clipperId: clipper_id, clipperName: clipper_name };
}

/** Resolve a STATS-ONLY token (view their cycle stats, no submitting).
 *  Same shape as resolveToken; bumps the open counter for tracking. */
export async function resolveStatsToken(token) {
  const { rows } = await query(
    `select cc.clipper_id, cl.name as clipper_name, cy.*
       from cycle_clippers cc
       join clippers cl on cl.id = cc.clipper_id
       join cycles cy on cy.id = cc.cycle_id
      where cc.stats_token = $1
        and not cc.stats_token_revoked
        and (cc.stats_token_expires_at is null or cc.stats_token_expires_at > now())`,
    [token],
  );
  if (!rows.length) return null;
  await query(
    `update cycle_clippers set stats_token_uses = stats_token_uses + 1, stats_token_last_used_at = now()
      where stats_token = $1`,
    [token],
  );
  const { clipper_id, clipper_name, ...cycle } = rows[0];
  return { cycle, clipperId: clipper_id, clipperName: clipper_name };
}

// ---- tiny in-memory rate limiter for the public endpoint --------------------
const buckets = new Map(); // token -> number[] (timestamps)
export function rateLimited(token, { max = 20, windowMs = 60 * 60 * 1000 } = {}) {
  const now = Date.now();
  const arr = (buckets.get(token) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { buckets.set(token, arr); return true; }
  arr.push(now);
  buckets.set(token, arr);
  return false;
}
