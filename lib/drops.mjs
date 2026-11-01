// View-drop recovery: real views almost never go DOWN, so a clip sitting
// below its own recent peak was usually written by a bad scrape. List them,
// and restore any (or all) to that peak on request.
import { query } from './db.mjs';

const WINDOW_DAYS = 14;

/** Clips in a cycle whose current views are below their peak in the recent
 *  view history. Small wobbles (<100 views and <3%) are ignored. */
export async function findViewDrops(cycleId) {
  const { rows } = await query(
    `with peaks as (
       select vh.clip_id, max(vh.views) as peak
         from view_history vh join clips c on c.id = vh.clip_id
        where c.cycle_id = $1 and vh.checked_at > now() - ($2 || ' days')::interval
        group by vh.clip_id
     )
     select c.id, c.url, c.platform, c.views::bigint as views, p.peak::bigint as peak,
            c.status, c.last_checked_at, cl.name as clipper
       from clips c
       join peaks p on p.clip_id = c.id
       join clippers cl on cl.id = c.clipper_id
      where c.cycle_id = $1 and c.status in ('approved', 'pending')
        and p.peak > c.views
        and (p.peak - c.views >= 100 or c.views < p.peak * 0.97)
      order by (p.peak - c.views) desc`,
    [cycleId, String(WINDOW_DAYS)],
  );
  const clips = rows.map((r) => ({
    id: r.id, url: r.url, platform: r.platform, clipper: r.clipper, status: r.status,
    views: Number(r.views), peak: Number(r.peak), lost: Number(r.peak) - Number(r.views),
    lastChecked: r.last_checked_at,
  }));
  return {
    clips,
    totalLost: clips.reduce((a, c) => a + c.lost, 0),
    approvedLost: clips.filter((c) => c.status === 'approved').reduce((a, c) => a + c.lost, 0),
  };
}

/** Restore clips (all listed drops, or just `ids`) to their recent peak.
 *  Engagement is recomputed for the restored views; a history point records
 *  the restore; the clip is flagged api_glitch ("kept last good numbers"). */
export async function restoreViewDrops(cycleId, ids = null) {
  const { clips } = await findViewDrops(cycleId);
  const pick = ids ? new Set(ids.map(String)) : null;
  let restored = 0;
  let views = 0;
  for (const c of clips) {
    if (pick && !pick.has(String(c.id))) continue;
    const { rows } = await query(
      `update clips set
          views = $2,
          engagement = case when likes is null and comments is null then null
                            else round((coalesce(likes,0) + coalesce(comments,0))::numeric / $2, 4) end,
          glitch_hold_views = null,
          flags = (select array(select distinct unnest(flags || '{api_glitch}'::text[])))
        where id = $1 and cycle_id = $3 and views < $2
        returning id, likes, comments`,
      [c.id, c.peak, cycleId],
    );
    if (rows[0]) {
      restored++;
      views += c.lost;
      await query(
        `insert into view_history (clip_id, views, likes, comments) values ($1, $2, $3, $4)`,
        [c.id, c.peak, rows[0].likes, rows[0].comments],
      );
    }
  }
  return { restored, views };
}
