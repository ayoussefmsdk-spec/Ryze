import { NextResponse } from 'next/server';
import { hasSession } from '../../../../../lib/auth.mjs';
import { scanClipper, ingestScannedClip } from '../../../../../lib/scan.mjs';

/** POST — scan a clipper's linked accounts for matching recent posts.
 *  Body: { clipperId, perAccount?, autoApprove?, onlyAccounts?: ["platform:handle"] } */
export async function POST(req, { params }) {
  if (!hasSession()) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.clipperId) return NextResponse.json({ ok: false, error: 'clipperId required' }, { status: 400 });

  // Rescue MANY skipped posts in one request (the "+ all …" buttons) — one
  // round-trip instead of hundreds; each still reuses its scan-fetched stats.
  if (b.action === 'addSkippedBatch') {
    const candidates = (Array.isArray(b.candidates) ? b.candidates : []).slice(0, 400);
    let added = 0;
    const failed = [];
    for (const candidate of candidates) {
      try {
        const r = await ingestScannedClip({
          cycleId: params.id,
          clipperId: b.clipperId,
          candidate,
          autoApprove: Boolean(b.autoApprove),
        });
        if (r.ok) added++; else failed.push(candidate.url);
      } catch {
        failed.push(candidate.url);
      }
    }
    return NextResponse.json({ ok: true, added, failed });
  }

  // Rescue one skipped post from a previous scan (uses its already-fetched stats).
  if (b.action === 'addSkipped') {
    try {
      const r = await ingestScannedClip({
        cycleId: params.id,
        clipperId: b.clipperId,
        candidate: b.candidate || {},
        autoApprove: Boolean(b.autoApprove),
      });
      return r.ok
        ? NextResponse.json(r)
        : NextResponse.json(r, { status: 400 });
    } catch (err) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
  }

  // Scan-only hashtag rule: 'cycle' (default) follows the cycle's setting,
  // 'none' skips the requirement, 'custom' uses tags from this request only.
  let scanHashtags;
  if (b.hashtagMode === 'none') scanHashtags = [];
  else if (b.hashtagMode === 'custom') {
    scanHashtags = String(b.hashtags || '')
      .split(/[,\s]+/).map((t) => t.replace(/^#/, '').toLowerCase()).filter(Boolean).slice(0, 10);
  }

  try {
    const result = await scanClipper({
      cycleId: params.id,
      clipperId: b.clipperId,
      perAccount: Math.min(100, Math.max(1, Math.trunc(Number(b.perAccount)) || 20)),
      autoApprove: Boolean(b.autoApprove),
      onlyAccounts: Array.isArray(b.onlyAccounts) ? b.onlyAccounts.map(String).slice(0, 30) : null,
      scanHashtags,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
