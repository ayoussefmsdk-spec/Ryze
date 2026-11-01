import { NextResponse } from 'next/server';
import { hasSession } from '../../../../lib/auth.mjs';
import { runScraperSelfTest } from '../../../../lib/scraperTest.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** POST — live, read-only scraper self-test (one clip per paid platform). */
export async function POST() {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runScraperSelfTest()) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
