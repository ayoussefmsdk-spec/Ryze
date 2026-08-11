'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function status(c) {
  if (c.revoked) return ['revoked', 'var(--crit)'];
  if (c.expires_at && new Date(c.expires_at) < new Date()) return ['expired', 'var(--crit)'];
  if (c.expires_at) {
    const d = Math.ceil((new Date(c.expires_at) - Date.now()) / 86400000);
    return [d > 1 ? `expires in ${d}d` : 'expires today', 'var(--warn, #f6a64b)'];
  }
  return ['live', 'var(--good)'];
}

/** Per-clipper personal stats links: generate, copy, revoke, expiry, usage. */
export default function StatsLinkPanel({ clipperId, clipperName, codes }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showMoney, setShowMoney] = useState(true);
  const [days, setDays] = useState('');       // '' = never expires
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  async function api(method, body) {
    setBusy(true);
    await fetch(`/api/clippers/${clipperId}/statslink`, {
      method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  function copy(code) {
    navigator.clipboard.writeText(
      `Hey ${clipperName}! Your personal ClipHive stats page (always live, don't share it): ${window.location.origin}/me/${code}`,
    );
    setCopied(code);
    setTimeout(() => setCopied(''), 1500);
  }

  if (!open) {
    const live = codes.filter((c) => !c.revoked && (!c.expires_at || new Date(c.expires_at) > new Date())).length;
    return (
      <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={() => setOpen(true)}>
        📊 Stats link{live > 0 ? ` (${live} live)` : ''}
      </button>
    );
  }

  return (
    <div className="card grid" style={{ gap: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <strong style={{ fontSize: 14 }}>{clipperName}'s personal stats links</strong>
        <button className="btn secondary" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 12 }} onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
        A live page with their lifetime views, charts and cycle history — always shows CURRENT numbers,
        never a snapshot. Multi-use: they can bookmark it.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={showMoney} onChange={(e) => setShowMoney(e.target.checked)} />
          show their earnings
        </label>
        <select className="field" style={{ width: 130, padding: '5px 9px', fontSize: 13 }} value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="">never expires</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
        <button className="btn" style={{ padding: '6px 13px', fontSize: 13 }} disabled={busy}
          onClick={() => api('POST', { showMoney, days: days === '' ? null : Number(days) })}>
          + Generate link
        </button>
      </div>

      {codes.length > 0 && (
        <div className="grid" style={{ gap: 4 }}>
          {codes.map((c, i) => {
            const [label, color] = status(c);
            const dead = c.revoked || (c.expires_at && new Date(c.expires_at) < new Date());
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: i ? '1px solid var(--line)' : '1px solid var(--line)', paddingTop: 8, fontSize: 13 }}>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: '0.04em' }}>{c.code}</span>
                <span style={{ color, fontSize: 11.5, fontFamily: 'var(--mono)' }}>{label}{c.show_money ? ' · $' : ''}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  opened {c.uses}×{c.last_used_at ? ` · last ${new Date(c.last_used_at).toLocaleDateString()}` : ''}
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
                  {!dead && (
                    <button className="btn secondary" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => copy(c.code)}>
                      {copied === c.code ? 'copied ✓' : 'copy link'}
                    </button>
                  )}
                  {c.revoked
                    ? <button className="btn secondary" style={{ padding: '3px 9px', fontSize: 12, color: 'var(--good)' }} disabled={busy} onClick={() => api('PATCH', { codeId: c.id, action: 'restore' })}>restore</button>
                    : <button className="btn secondary" style={{ padding: '3px 9px', fontSize: 12, color: 'var(--crit)' }} disabled={busy} onClick={() => api('PATCH', { codeId: c.id, action: 'revoke' })}>revoke</button>}
                  <button className="btn secondary" style={{ padding: '3px 9px', fontSize: 12 }} disabled={busy}
                    title="Toggle whether the page shows their earnings"
                    onClick={() => api('PATCH', { codeId: c.id, action: 'money', showMoney: !c.show_money })}>
                    {c.show_money ? 'hide $' : 'show $'}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
