import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { generateViewerCode, listViewerCodes, revokeViewerCode } from '../../../../../lib/viewer.mjs';

export async function GET(_req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, codes: await listViewerCodes(params.id) });
}

export async function POST(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const code = await generateViewerCode(params.id, {
    label: (b.label || '').trim() || null,
    showMoney: Boolean(b.showMoney),
    days: Math.min(30, Math.max(1, Number(b.days) || 7)),
  });
  return NextResponse.json({ ok: true, code });
}

export async function DELETE(req) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  await revokeViewerCode(id);
  return NextResponse.json({ ok: true });
}
