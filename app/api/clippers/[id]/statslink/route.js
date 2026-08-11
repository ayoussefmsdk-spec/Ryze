import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { generateClipperCode, listClipperCodes, updateClipperCode } from '../../../../../lib/clipperlink.mjs';

/** GET — list a clipper's stats links (with usage tracking). */
export async function GET(_req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, codes: await listClipperCodes(params.id) });
}

/** POST — create a stats link. Body: { label?, showMoney?, days? (null = never expires) } */
export async function POST(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const code = await generateClipperCode(params.id, {
    label: String(b.label || '').trim() || null,
    showMoney: b.showMoney !== false,
    days: b.days == null ? null : Math.min(365, Math.max(1, Number(b.days))),
  });
  return NextResponse.json({ ok: true, code });
}

/** PATCH — manage one. Body: { codeId, action: 'revoke'|'restore'|'expiry'|'money', days?, showMoney? } */
export async function PATCH(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.codeId) return NextResponse.json({ ok: false, error: 'codeId required' }, { status: 400 });
  if (b.action === 'revoke') await updateClipperCode(b.codeId, params.id, { revoked: true });
  else if (b.action === 'restore') await updateClipperCode(b.codeId, params.id, { revoked: false });
  else if (b.action === 'expiry') await updateClipperCode(b.codeId, params.id, { expiresDays: b.days == null ? null : Number(b.days) });
  else if (b.action === 'money') await updateClipperCode(b.codeId, params.id, { showMoney: Boolean(b.showMoney) });
  else return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
