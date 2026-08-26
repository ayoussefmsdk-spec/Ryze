// Housekeeping: view_history grows on EVERY check of EVERY clip (hundreds of
// rows/day at full throttle) and it's what filled the database volume. Old
// history doesn't need per-check grain — every chart reads at day grain — so
// checks older than `detailDays` are compacted to the LAST check per clip per
// day. Charts stay identical; storage stops growing.
import { query } from './db.mjs';

export async function pruneHistory({ detailDays = 60 } = {}) {
  const { rows } = await query(
    `delete from view_history vh
      using (select id, row_number() over (partition by clip_id, checked_at::date
                                           order by checked_at desc) as rn
               from view_history
              where checked_at < now() - ($1 || ' days')::interval) d
      where vh.id = d.id and d.rn > 1
      returning vh.id`,
    [String(Math.max(7, Math.trunc(detailDays)))],
  );
  return rows.length;
}
