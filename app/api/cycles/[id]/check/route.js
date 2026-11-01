import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { startCheckRun, getCheckRun } from '../../../../../lib/checkRuns.mjs';

export const dynamic = 'force-dynamic';

/** POST — "Check now". Body: { scope: 'free' | 'paid' | 'facebook' | 'retry' | 'all' }
 *  ('retry' = only clips flagged check-failed / stats-glitch, all platforms).
 *  ('all' = YouTube+TikTok+IG; Facebook only ever runs via its own scope).
 *  Starts the check in the BACKGROUND and returns at once; poll GET. */
export async function POST(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const scope = ['free', 'facebook', 'paid', 'retry'].includes(b.scope) ? b.scope : 'all';
  try {
    const { run, alreadyRunning } = await startCheckRun(params.id, scope);
    return NextResponse.json({ ok: true, run, alreadyRunning }, { status: 202 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/** GET ?run=ID — status of one run (or the latest run when no id). */
export async function GET(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const runId = new URL(req.url).searchParams.get('run');
  try {
    const run = await getCheckRun(params.id, runId && /^\d+$/.test(runId) ? Number(runId) : null);
    return NextResponse.json({ ok: true, run });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
