'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const PLAT_GLYPH = { youtube: '▶', tiktok: '♪', instagram: '◎', twitter: '𝕏', other: '∙' };
const SCANNABLE = new Set(['youtube', 'tiktok', 'instagram']);

export default function ScanPanel({ cycleId, members, accountsByClipper = {} }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clipperId, setClipperId] = useState('');
  const [perAccount, setPer] = useState('20');
  const [autoApprove, setAuto] = useState(false);
  const [picked, setPicked] = useState(null); // null = all accounts; Set = manual selection
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const accounts = useMemo(
    () => (accountsByClipper[clipperId] || []).map((a) => ({ ...a, key: `${a.platform}:${a.handle}`, scannable: SCANNABLE.has(a.platform) })),
    [accountsByClipper, clipperId],
  );

  function pickClipper(id) {
    setClipperId(id);
    setPicked(null); // default back to "all accounts" for the new clipper
    setResult(null);
  }

  function toggleAccount(key) {
    const base = picked ?? new Set(accounts.filter((a) => a.scannable).map((a) => a.key));
    const next = new Set(base);
    if (next.has(key)) next.delete(key); else next.add(key);
    setPicked(next);
  }

  const selectedKeys = picked ?? new Set(accounts.filter((a) => a.scannable).map((a) => a.key));
  const n = Math.min(100, Math.max(1, Math.trunc(Number(perAccount)) || 20));

  async function scan() {
    if (!clipperId || selectedKeys.size === 0) return;
    setBusy(true);
    setResult(null);
    const allScannable = accounts.filter((a) => a.scannable).map((a) => a.key);
    const body = {
      clipperId,
      perAccount: n,
      autoApprove,
      // Only send the filter when it's an actual subset — "all" stays default.
      ...(selectedKeys.size < allScannable.length ? { onlyAccounts: [...selectedKeys] } : {}),
    };
    const r = await fetch(`/api/cycles/${cycleId}/scan`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
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
        Pulls recent posts from the accounts you pick, keeps only the ones matching this cycle's
        hashtag &amp; dates, skips anything already added. YouTube is free; TikTok/IG cost fractions of a cent per post.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="field" style={{ flex: 1, minWidth: 170 }} value={clipperId} onChange={(e) => pickClipper(e.target.value)}>
          <option value="">Pick a clipper…</option>
          {members.map((m) => <option key={m.clipper_id} value={m.clipper_id}>{m.name}</option>)}
        </select>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>last</span>
          <input className="field" style={{ width: 74, padding: '8px 10px' }} inputMode="numeric"
            value={perAccount} onChange={(e) => setPer(e.target.value)} title="posts per account (1–100)" />
          <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>posts</span>
        </span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {[10, 20, 50].map((v) => (
            <button key={v} className="btn secondary" onClick={() => setPer(String(v))}
              style={{ padding: '4px 9px', fontSize: 12, borderColor: n === v ? 'var(--honey)' : 'var(--line-2)', color: n === v ? 'var(--honey)' : 'var(--text-2)' }}>
              {v}
            </button>
          ))}
        </span>
      </div>

      {/* Per-account picker */}
      {clipperId && (
        accounts.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>This clipper has no linked accounts — add their @handles on the Clippers page first.</div>
        ) : (
          <div className="grid" style={{ gap: 6 }}>
            <div className="eyebrow" style={{ letterSpacing: '0.08em' }}>Which accounts to scan</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {accounts.map((a) => (
                <label key={a.key} title={a.scannable ? `${a.platform} — scannable` : `${a.platform} — manual only, can't be scanned`}
                  style={{
                    display: 'inline-flex', gap: 7, alignItems: 'center', fontSize: 13,
                    border: `1px solid ${selectedKeys.has(a.key) ? 'var(--honey)' : 'var(--line-2)'}`,
                    borderRadius: 999, padding: '5px 12px', cursor: a.scannable ? 'pointer' : 'not-allowed',
                    opacity: a.scannable ? 1 : 0.45,
                    background: selectedKeys.has(a.key) ? 'var(--honey-soft)' : 'transparent',
                  }}>
                  <input type="checkbox" style={{ display: 'none' }} disabled={!a.scannable}
                    checked={selectedKeys.has(a.key)} onChange={() => toggleAccount(a.key)} />
                  <span>{PLAT_GLYPH[a.platform]}</span>
                  <span>@{a.handle}</span>
                  {selectedKeys.has(a.key) && <span style={{ color: 'var(--honey)' }}>✓</span>}
                </label>
              ))}
            </div>
            {selectedKeys.size === 0 && <div style={{ color: 'var(--crit)', fontSize: 12.5 }}>Pick at least one account.</div>}
          </div>
        )
      )}

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
        <input type="checkbox" checked={autoApprove} onChange={(e) => setAuto(e.target.checked)} />
        Auto-approve matches (they already passed hashtag + date + own-account checks)
      </label>
      <button className="btn" onClick={scan} disabled={busy || !clipperId || selectedKeys.size === 0}>
        {busy ? 'Scanning… (can take up to a minute)' : `Scan ${selectedKeys.size || ''} account${selectedKeys.size === 1 ? '' : 's'} · last ${n} posts`}
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
