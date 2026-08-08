// Streamer viewer codes: single-use, read-only access to one cycle's numbers.
import crypto from 'node:crypto';
import { query } from './db.mjs';

// Unambiguous alphabet (no 0/O/1/I) for codes people read aloud/type.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GRACE_MS = 60 * 60 * 1000; // after first open, code keeps working 60 min (refresh-friendly)

function randCode() {
  let s = '';
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `HIVE-${s}`;
}

/** Create a viewer code for a cycle. days = validity window. */
export async function generateViewerCode(cycleId, { label = null, showMoney = false, days = 7 } = {}) {
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randCode();
    try {
      const { rows } = await query(
        `insert into viewer_codes (code, cycle_id, label, show_money, expires_at)
           values ($1,$2,$3,$4,$5) returning *`,
        [code, cycleId, label, showMoney, expires],
      );
      return rows[0];
    } catch (err) {
      if (/unique/i.test(err.message)) continue; // collision, retry
      throw err;
    }
  }
  throw new Error('Could not generate a unique code');
}

export async function listViewerCodes(cycleId) {
  const { rows } = await query(
    `select id, code, label, show_money, used_at, expires_at, revoked, created_at
       from viewer_codes where cycle_id = $1 order by created_at desc`,
    [cycleId],
  );
  return rows;
}

export async function revokeViewerCode(id) {
  await query(`update viewer_codes set revoked = true where id = $1`, [id]);
}

/**
 * Resolve a code for the public watch page and CONSUME it (single-use).
 * Returns { ok, reason?, cycle?, showMoney? }.
 */
export async function resolveViewerCode(code) {
  const { rows } = await query(`select * from viewer_codes where code = $1`, [code]);
  const vc = rows[0];
  if (!vc) return { ok: false, reason: 'notfound' };
  if (vc.revoked) return { ok: false, reason: 'revoked' };
  if (new Date(vc.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if (vc.used_at && Date.now() - new Date(vc.used_at).getTime() > GRACE_MS) {
    return { ok: false, reason: 'used' };
  }
  if (!vc.used_at) {
    await query(`update viewer_codes set used_at = now() where id = $1`, [vc.id]);
  }
  const cycle = (await query(
    `select cy.*, ca.name as campaign_name, ca.streamer_handle,
            coalesce(cy.timezone, ca.timezone) as effective_tz
       from cycles cy join campaigns ca on ca.id = cy.campaign_id where cy.id = $1`,
    [vc.cycle_id],
  )).rows[0];
  return { ok: true, cycle, showMoney: vc.show_money };
}
