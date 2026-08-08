'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ScanPanel({ cycleId, members }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clipperId, setClipperId] = useState('');
  const [perAccount, setPer] = useState(20);
  const [autoApprove, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function scan() {
    if (!clipperId) return;
    setBusy(true);
    setResult(null);
    const r = await fetch(`/api/cycles/${cycleId}/scan`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clipperId, perAccount, autoApprove }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setResult(d);
    if (r.ok) router.refresh();
  }

  if (!open) return <button className="btn secondary" onClick={() => setOpen(true)}>📡 Scan accounts</button>;

  const rej = result?.rejected || {};
  const rejParts = [
    rej.missing_hashtag ? `${rej.missing_hashtag} missing hashtag` : null,
    rej.outside_dates ? `${rej.outside_dates} outside dates` : null,
    rej.duplicate ? `${rej.duplicate} already in` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="card grid" style={{ gap: 12, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Scan a clipper's accounts</h2>
        <button className="btn secondary" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12.5 }} onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Pulls their recent posts from every linked account, keeps only the ones matching this cycle's
        hashtag &amp; dates, skips anything already added. YouTube is free; TikTok/IG cost fractions of a cent per post.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="field" style={{ flex: 1, minWidth: 170 }} value={clipperId} onChange={(e) => setClipperId(e.target.value)}>
          <option value="">Pick a clipper…</option>
          {members.map((m) => <option key={m.clipper_id} value={m.clipper_id}>{m.name}</option>)}
        </select>
        <select className="field" style={{ width: 150 }} value={perAccount} onChange={(e) => setPer(Number(e.target.value))}>
          <option value={10}>last 10 posts</option>
          <option value={20}>last 20 posts</option>
          <option value={50}>last 50 posts</option>
        </select>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
        <input type="checkbox" checked={autoApprove} onChange={(e) => setAuto(e.target.checked)} />
        Auto-approve matches (they already passed hashtag + date + own-account checks)
      </label>
      <button className="btn" onClick={scan} disabled={busy || !clipperId}>
        {busy ? 'Scanning… (can take up to a minute)' : 'Run scan'}
      </button>
      {result && (
        <div style={{ fontSize: 13.5, color: result.ok ? 'var(--text)' : 'var(--crit)' }}>
          {result.ok
            ? <>✓ Scanned {result.scanned} posts → <b style={{ color: 'var(--honey)' }}>{result.accepted} added</b>{rejParts ? ` (skipped: ${rejParts})` : ''} · scan cost ≈ ${(result.costCents / 100).toFixed(2)}</>
            : `✗ ${result.error}`}
        </div>
      )}
    </div>
  );
}
