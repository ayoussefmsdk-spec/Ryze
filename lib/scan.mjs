// Account-scan orchestrator: pull a clipper's recent posts from their linked
// accounts, keep only tagged + in-window + new ones, ingest them as clips.
import { query, getPool } from './db.mjs';
import { parseClip } from '../core/platform.mjs';
import { computeEngagement } from '../core/payout.mjs';
import { selectScanCandidates, estimateScanCostCents } from '../core/scan.mjs';
import { fetchChannelRecent } from './fetchers/youtube.mjs';
import { scanTikTokProfile, scanInstagramProfile } from './fetchers/apify.mjs';

const PAID = new Set(['tiktok', 'instagram']);

/**
 * scanClipper({ cycleId, clipperId, perAccount, autoApprove })
 * Returns { scanned, accepted, rejected:{...}, costCents, ingested:[clip] }.
 */
export async function scanClipper({ cycleId, clipperId, perAccount = 20, autoApprove = false }) {
  const cycle = (await query(`select * from cycles where id = $1`, [cycleId])).rows[0];
  if (!cycle) throw new Error('Cycle not found');
  if (cycle.status !== 'active') throw new Error('Cycle is not active');

  const accounts = (await query(
    `select platform, handle from clipper_accounts where clipper_id = $1`, [clipperId],
  )).rows;
  if (!accounts.length) throw new Error('This clipper has no linked accounts to scan');

  // Pull recent posts per linked account.
  const candidates = [];
  let paidPosts = 0;
  for (const acc of accounts) {
    const allowed = (cycle.allowed_platforms || []);
    if (allowed.length && !allowed.includes(acc.platform)) continue;
    let posts = [];
    try {
      if (acc.platform === 'youtube') posts = await fetchChannelRecent(acc.handle, perAccount);
      else if (acc.platform === 'tiktok') posts = await scanTikTokProfile(acc.handle, perAccount);
      else if (acc.platform === 'instagram') posts = await scanInstagramProfile(acc.handle, perAccount);
      else continue; // twitter/other — manual only
    } catch {
      continue; // one bad account never kills the scan
    }
    if (PAID.has(acc.platform)) paidPosts += posts.length;
    for (const p of posts) {
      const key = parseClip(p.url).key;
      if (!key) continue;
      candidates.push({
        key, platform: acc.platform, url: p.url,
        postedAt: p.postedAt || null,
        hashtags: p.hashtags || [],
        stat: p, accountHandle: p.accountHandle || acc.handle,
      });
    }
  }

  const existing = new Set(
    (await query(`select normalized_key from clips where cycle_id = $1`, [cycleId])).rows.map((r) => r.normalized_key),
  );

  const { accept, reject } = selectScanCandidates({
    candidates,
    requiredHashtags: cycle.hashtag_mode !== 'off' ? (cycle.required_hashtags || []) : [],
    startsOn: cycle.starts_on,
    endsOn: cycle.ends_on,
    enforceWindow: cycle.enforce_post_window,
    existingKeys: existing,
  });

  // Ingest accepted posts (stats already fetched, so no extra cost).
  const status = autoApprove ? 'approved' : 'pending';
  const client = await getPool().connect();
  const ingested = [];
  try {
    await client.query('begin');
    for (const c of accept) {
      const s = c.stat;
      const engagement = computeEngagement({ views: s.views, likes: s.likes, comments: s.comments });
      const flags = s.addedFlags || [];
      const { rows } = await client.query(
        `insert into clips
           (cycle_id, clipper_id, platform, url, normalized_key, account_handle, status, source,
            added_via, views, likes, comments, engagement, thumbnail_url, caption, posted_at,
            last_checked_at, flags)
         values ($1,$2,$3,$4,$5,$6,$7,'auto','scan',$8,$9,$10,$11,$12,$13,$14, now(), $15)
         on conflict do nothing
         returning id`,
        [cycleId, clipperId, c.platform, c.url, c.key, c.accountHandle, status,
         s.views || 0, s.likes, s.comments, engagement, s.thumbnailUrl || null, s.caption || null, c.postedAt, flags],
      );
      if (rows[0]) {
        ingested.push(rows[0].id);
        await client.query(`insert into view_history (clip_id, views, likes, comments) values ($1,$2,$3,$4)`,
          [rows[0].id, s.views || 0, s.likes, s.comments]);
      }
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }

  const rejectCounts = reject.reduce((m, r) => { m[r.reason] = (m[r.reason] || 0) + 1; return m; }, {});
  return {
    scanned: candidates.length,
    accepted: ingested.length,
    rejected: rejectCounts,
    costCents: estimateScanCostCents({ paidPosts }),
    autoApprove,
  };
}
