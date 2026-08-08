import { NextResponse } from 'next/server';
import { runDueChecks } from '../../../../lib/scheduler.mjs';

/**
 * External trigger for the scheduler (backup to the in-process interval).
 * Protected by CRON_SECRET: GET/POST /api/cron/run?secret=...
 */
async function handle(req) {
  const secret = process.env.CRON_SECRET;
  const given = new URL(req.url).searchParams.get('secret');
  if (!secret || given !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const summary = await runDueChecks();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
