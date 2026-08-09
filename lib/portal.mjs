// Data for the public per-clipper portal (their private magic link).
// STRICT rule: expose ONLY the clipper's own clips and numbers — the sole
// cross-clipper facts allowed out are their rank and the roster size.
import { query } from './db.mjs';
import { resolveToken } from './clips.mjs';
import { computeCyclePayouts } from './payouts.mjs';

export async function clipperPortal(token) {
  const resolved = await resolveToken(token);
  if (!resolved) return null;
  const { cycle, clipperId, clipperName } = resolved;

  const { rows: clips } = await query(
    `select id, platform, url, status, views, likes, comments, engagement, flags,
            thumbnail_url, account_handle, posted_at, created_at
       from clips
      where cycle_id = $1 and clipper_id = $2
      order by views desc, created_at desc`,
    [cycle.id, clipperId],
  );

  // Their standing + estimated earnings, from the same engine the manager sees.
  let mine = null;
  let rank = null;
  let rosterSize = 0;
  try {
    const pay = await computeCyclePayouts(cycle.id);
    rosterSize = pay.perClipper.length;
    const idx = pay.perClipper.findIndex((p) => p.clipperId === clipperId);
    if (idx >= 0) { mine = pay.perClipper[idx]; rank = idx + 1; }
  } catch { /* payouts unavailable — portal still shows clips */ }

  const { rows: paidRows } = await query(
    `select coalesce(sum(amount_cents),0)::bigint as paid from payouts
      where cycle_id = $1 and clipper_id = $2`,
    [cycle.id, clipperId],
  );

  const approved = clips.filter((c) => c.status === 'approved');
  return {
    cycle,
    clipperName,
    clips,
    byPlatform: mine?.byPlatform || {},
    stats: {
      views: approved.reduce((a, c) => a + Number(c.views), 0),
      approved: approved.length,
      pending: clips.filter((c) => c.status === 'pending').length,
      estimatedCents: mine?.payoutCents ?? 0,
      paidCents: Number(paidRows[0].paid),
      rank,
      rosterSize,
    },
  };
}
