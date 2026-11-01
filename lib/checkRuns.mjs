// Background "Check now": start a check without holding the web request open,
// and let the page poll for the outcome. One run per cycle at a time.
import { query } from './db.mjs';
import { runCheck } from './check.mjs';

// A run whose heartbeat stopped this long ago died with its server (redeploy).
// Heartbeat = progress notes; a healthy run always notes within minutes.
const STALE_MIN = 20;

const shape = (r) => r && ({
  id: Number(r.id),
  scope: r.scope,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  status: r.finished_at ? (r.error ? 'failed' : 'done')
    : (Date.now() - new Date(r.heartbeat_at || r.started_at).getTime() > STALE_MIN * 60_000 ? 'lost' : 'running'),
  progress: r.progress || null,
  result: r.result,
  error: r.error,
});

export async function startCheckRun(cycleId, scope) {
  const { rows: busy } = await query(
    `select * from check_runs
      where cycle_id = $1 and finished_at is null
        and coalesce(heartbeat_at, started_at) > now() - ($2 || ' minutes')::interval
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
  const onProgress = (text) => query(
    `update check_runs set progress = $1, heartbeat_at = now() where id = $2`,
    [String(text).slice(0, 300), run.id],
  );
  runCheck(cycleId, { scope, onProgress })
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
