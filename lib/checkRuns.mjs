// Background "Check now": start a check without holding the web request open,
// and let the page poll for the outcome. One run per cycle at a time.
import { query } from './db.mjs';
import { runCheck } from './check.mjs';

// A run unfinished after this long died with its server (e.g. a redeploy).
const STALE_MIN = 30;

const shape = (r) => r && ({
  id: Number(r.id),
  scope: r.scope,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  status: r.finished_at ? (r.error ? 'failed' : 'done')
    : (Date.now() - new Date(r.started_at).getTime() > STALE_MIN * 60_000 ? 'lost' : 'running'),
  result: r.result,
  error: r.error,
});

export async function startCheckRun(cycleId, scope) {
  const { rows: busy } = await query(
    `select * from check_runs
      where cycle_id = $1 and finished_at is null
        and started_at > now() - ($2 || ' minutes')::interval
      order by started_at desc limit 1`,
    [cycleId, String(STALE_MIN)],
  );
  if (busy[0]) return { run: shape(busy[0]), alreadyRunning: true };
  const { rows } = await query(
    `insert into check_runs (cycle_id, scope) values ($1, $2) returning *`,
    [cycleId, scope],
  );
  const run = rows[0];
  // Deliberately NOT awaited: the server keeps working after the request ends.
  runCheck(cycleId, { scope })
    .then((summary) => query(`update check_runs set finished_at = now(), result = $1 where id = $2`, [JSON.stringify(summary), run.id]))
    .catch((err) => query(`update check_runs set finished_at = now(), error = $1 where id = $2`, [String(err?.message || err).slice(0, 1000), run.id]))
    .catch(() => { /* DB unreachable — the run will read as 'lost' later */ });
  return { run: shape(run), alreadyRunning: false };
}

export async function getCheckRun(cycleId, runId = null) {
  const { rows } = runId
    ? await query(`select * from check_runs where cycle_id = $1 and id = $2`, [cycleId, runId])
    : await query(`select * from check_runs where cycle_id = $1 order by started_at desc limit 1`, [cycleId]);
  return shape(rows[0]) || null;
}
