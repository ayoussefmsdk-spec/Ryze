// Personal clipper stats links (BEE-XXXX-XXXX): multi-use, revocable, tracked.
// Unlike streamer viewer codes these are NOT single-use — they're the
// clipper's living stats page, always rendering current data.
import crypto from 'node:crypto';
import { query } from './db.mjs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randCode() {
  let s = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `BEE-${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function generateClipperCode(clipperId, { label = null, showMoney = true, days = null } = {}) {
  const expires = days ? new Date(Date.now() + days * 86400000).toISOString() : null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randCode();
    try {
      const { rows } = await query(
        `insert into clipper_codes (code, clipper_id, label, show_money, expires_at)
           values ($1,$2,$3,$4,$5) returning *`,
        [code, clipperId, label, showMoney, expires],
      );
      return rows[0];
    } catch (err) {
      if (/unique/i.test(err.message)) continue;
      throw err;
    }
  }
  throw new Error('Could not generate a unique code');
}

export async function listClipperCodes(clipperId) {
  const { rows } = await query(
    `select id, code, label, show_money, expires_at, revoked, uses, last_used_at, created_at
       from clipper_codes where clipper_id = $1 order by created_at desc`,
    [clipperId],
  );
  return rows;
}

export async function updateClipperCode(id, clipperId, { revoked = null, expiresDays = undefined, showMoney = null } = {}) {
  const sets = [];
  const vals = [];
  if (revoked !== null) { vals.push(revoked); sets.push(`revoked = $${vals.length}`); }
  if (showMoney !== null) { vals.push(showMoney); sets.push(`show_money = $${vals.length}`); }
  if (expiresDays !== undefined) {
    vals.push(expiresDays == null ? null : new Date(Date.now() + Number(expiresDays) * 86400000).toISOString());
    sets.push(`expires_at = $${vals.length}`);
  }
  if (!sets.length) return;
  vals.push(id, clipperId);
  await query(`update clipper_codes set ${sets.join(', ')} where id = $${vals.length - 1} and clipper_id = $${vals.length}`, vals);
}

/** Resolve for the public page — live data, so just validate + count the open. */
export async function resolveClipperCode(code) {
  const { rows } = await query(`select * from clipper_codes where code = $1`, [code]);
  const cc = rows[0];
  if (!cc) return { ok: false, reason: 'notfound' };
  if (cc.revoked) return { ok: false, reason: 'revoked' };
  if (cc.expires_at && new Date(cc.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };
  await query(`update clipper_codes set uses = uses + 1, last_used_at = now() where id = $1`, [cc.id]);
  const clipper = (await query(`select id, name from clippers where id = $1`, [cc.clipper_id])).rows[0];
  if (!clipper) return { ok: false, reason: 'notfound' };
  return { ok: true, clipper, showMoney: cc.show_money };
}
