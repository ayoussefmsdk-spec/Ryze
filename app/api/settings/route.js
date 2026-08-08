import { NextResponse } from 'next/server';
import { hasSession } from '../../../lib/auth.mjs';
import { query } from '../../../lib/db.mjs';

/** Update global app settings (currently the Apify daily spend cap). */
export async function POST(req) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.apifyDailyCap !== undefined) {
    const cap = Math.max(0, Math.min(100000, Math.trunc(Number(b.apifyDailyCap) || 0)));
    await query(`update app_settings set apify_daily_cap = $1, updated_at = now() where id = 1`, [cap]);
  }
  return NextResponse.json({ ok: true });
}
