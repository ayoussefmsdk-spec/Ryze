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
 * scanClipper({ cycleId, clipperId, perAccount, autoApprove, onlyAccounts })
 * onlyAccounts: optional array of "platform:handle" strings — when given, only
 * those linked accounts are scanned (the panel's per-account checkboxes).
 * Returns { scanned, accepted, rejected:{...}, costCents, ingested:[clip] }.
 */
export async function scanClipper({ cycleId, clipperId, perAccount = 20, autoApprove = false, onlyAccounts = null }) {
  const cycle = (await query(`select * from cycles where id = $1`, [cycleId])).rows[0];
  if (!cycle) throw new Error('Cycle not found');
  if (cycle.status !== 'active') throw new Error('Cycle is not active');

  let accounts = (await query(
    `select platform, handle from clipper_accounts where clipper_id = $1`, [clipperId],
  )).rows;
  if (!accounts.length) throw new Error('This clipper has no linked accounts to scan');
  if (Array.isArray(onlyAccounts) && onlyAccounts.length) {
    const pick = new Set(onlyAccounts.map(String));
    accounts = accounts.filter((a) => pick.has(`${a.platform}:${a.handle}`));
    if (!accounts.length) throw new Error('None of the selected accounts belong to this clipper');
  }

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
  // The skipped posts themselves (stats already fetched) so the manager can
  // rescue individual ones without re-scanning.
  const skipped = reject
    .filter((r) => r.reason !== 'invalid' && r.url)
    .slice(0, 60)
    .map((r) => ({
      reason: r.reason,
      url: r.url,
      platform: r.platform,
      accountHandle: r.accountHandle || r.stat?.accountHandle || null,
      postedAt: r.postedAt || null,
      views: r.stat?.views ?? 0,
      likes: r.stat?.likes ?? null,
      comments: r.stat?.comments ?? null,
      caption: r.stat?.caption ?? null,
      thumbnailUrl: r.stat?.thumbnailUrl ?? null,
    }));

  return {
    scanned: candidates.length,
    accepted: ingested.length,
    rejected: rejectCounts,
    skipped,
    costCents: estimateScanCostCents({ paidPosts }),
    autoApprove,
  };
}

/**
 * ingestScannedClip — rescue ONE post the scan skipped (duplicate /
 * outside_dates / missing_hashtag), reusing the stats the scan already
 * fetched — no extra API cost. The skip reason stays on the clip as a flag.
 */
export async function ingestScannedClip({ cycleId, clipperId, candidate, autoApprove = false }) {
  const { addClip } = await import('./clips.mjs');
  const cycle = (await query(`select * from cycles where id = $1`, [cycleId])).rows[0];
  if (!cycle) throw new Error('Cycle not found');

  const result = await addClip({
    cycle, clipperId,
    url: String(candidate?.url || ''),
    addedVia: 'scan',
    confirmDuplicate: true, // the manager explicitly chose to add it
  });
  if (!result.ok) return result;

  const s = candidate;
  const views = Math.max(0, Math.trunc(Number(s.views) || 0));
  const num = (x) => (x == null ? null : Math.max(0, Math.trunc(Number(x) || 0)));
  const engagement = computeEngagement({ views, likes: num(s.likes), comments: num(s.comments) });
  const reasonFlag = ['outside_dates', 'missing_hashtag'].includes(s.reason) ? [s.reason] : [];
  const { rows } = await query(
    `update clips set
        views = $1, likes = $2, comments = $3, engagement = $4,
        caption = coalesce($5, caption), posted_at = coalesce($6, posted_at),
        thumbnail_url = coalesce($7, thumbnail_url),
        account_handle = coalesce($8, account_handle),
        status = $9, last_checked_at = now(),
        flags = (select array(select distinct unnest(flags || $10::text[])))
      where id = $11 returning id`,
    [views, num(s.likes), num(s.comments), engagement,
     s.caption || null, s.postedAt || null, s.thumbnailUrl || null,
     (s.accountHandle || '').toLowerCase() || null,
     autoApprove ? 'approved' : 'pending', reasonFlag, result.clip.id],
  );
  await query(
    `insert into view_history (clip_id, views, likes, comments) values ($1,$2,$3,$4)`,
    [result.clip.id, views, num(s.likes), num(s.comments)],
  );
  return { ok: true, clipId: rows[0].id };
}
