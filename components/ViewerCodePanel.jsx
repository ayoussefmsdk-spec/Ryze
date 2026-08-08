'use client';

import { useEffect, useState } from 'react';

export default function ViewerCodePanel({ cycleId }) {
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState([]);
  const [label, setLabel] = useState('');
  const [showMoney, setShowMoney] = useState(false);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');

  async function load() {
    const r = await fetch(`/api/cycles/${cycleId}/viewer-codes`);
    if (r.ok) setCodes((await r.json()).codes || []);
  }
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);

  async function generate() {
    setBusy(true);
    await fetch(`/api/cycles/${cycleId}/viewer-codes`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label, showMoney, days }),
    });
    setLabel('');
    setBusy(false);
    load();
  }

  async function revoke(id) {
    await fetch(`/api/cycles/${cycleId}/viewer-codes?id=${id}`, { method: 'DELETE' });
    load();
  }

  function copy(code) {
    const url = `${window.location.origin}/watch/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(''), 1500);
  }

  function status(c) {
    if (c.revoked) return ['revoked', 'var(--text-3)'];
    if (new Date(c.expires_at) < new Date()) return ['expired', 'var(--text-3)'];
    if (c.used_at) return ['viewed', 'var(--good)'];
    return ['unused', 'var(--honey)'];
  }

  if (!open) {
    return <button className="btn secondary" onClick={() => setOpen(true)}>👁 Streamer view code</button>;
  }

  return (
    <div className="card grid" style={{ gap: 12, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Streamer viewer codes</h2>
        <button className="btn secondary" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12.5 }} onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Give a streamer a single-use, read-only link — they watch views, clips &amp; the leaderboard, but can’t touch anything.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="field" style={{ flex: 1, minWidth: 160 }} placeholder="Label (e.g. for Camy)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select className="field" style={{ width: 110 }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>1 day</option>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
        </select>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
        <input type="checkbox" checked={showMoney} onChange={(e) => setShowMoney(e.target.checked)} />
        Include spend / payout numbers (off = reach only)
      </label>
      <button className="btn" onClick={generate} disabled={busy}>{busy ? 'Generating…' : '+ Generate code'}</button>

      {codes.length > 0 && (
        <div className="grid" style={{ gap: 6 }}>
          {codes.map((c) => {
            const [label2, color] = status(c);
            const dead = c.revoked || new Date(c.expires_at) < new Date();
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8, fontSize: 13.5 }}>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: '0.04em' }}>{c.code}</span>
                {c.label && <span className="muted">· {c.label}</span>}
                <span style={{ color, fontSize: 12, fontFamily: 'var(--mono)' }}>{label2}{c.show_money ? ' · $' : ''}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {!dead && <button className="btn secondary" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => copy(c.code)}>{copied === c.code ? 'copied ✓' : 'copy link'}</button>}
                  {!c.revoked && <button className="btn secondary" style={{ padding: '3px 9px', fontSize: 12, color: 'var(--crit)' }} onClick={() => revoke(c.id)}>revoke</button>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
