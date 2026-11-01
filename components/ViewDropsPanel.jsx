'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const nf = (n) => Number(n || 0).toLocaleString('en-US');

/** Clips sitting below their own recent view peak — usually a bad scrape that
 *  got saved. One click puts them back (each restored clip is flagged). */
export default function ViewDropsPanel({ cycleId, drops }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!drops?.clips?.length) return null;

  async function restore(ids = null) {
    const n = ids ? ids.length : drops.clips.length;
    const views = ids ? drops.clips.filter((c) => ids.includes(c.id)).reduce((a, c) => a + c.lost, 0) : drops.totalLost;
    if (!window.confirm(`Restore ${n} clip${n > 1 ? 's' : ''} to their recent peak (+${nf(views)} views)? Each is flagged "stats glitch — kept last good numbers" so you can see it.`)) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`/api/cycles/${cycleId}/drops`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(ids ? { ids } : {}),
      });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? `✓ Restored ${d.restored} clip${d.restored === 1 ? '' : 's'} (+${nf(d.views)} views).` : `✗ ${d.error || 'Restore failed'}`);
      if (r.ok) router.refresh();
    } catch {
      setMsg('✗ Lost the connection — refresh and try again.');
    }
    setBusy(false);
  }

  return (
    <div className="card grid" style={{ gap: 8, borderColor: 'var(--warn, #f6a64b)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--warn, #f6a64b)', fontWeight: 650 }}>
          ⚠ {drops.clips.length} clip{drops.clips.length > 1 ? 's' : ''} fell below their recent peak — {nf(drops.totalLost)} views lost
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
          <button className="btn secondary" style={{ padding: '4px 11px', fontSize: 12.5 }} onClick={() => setOpen(!open)}>
            {open ? 'Hide list' : 'Show clips'}
          </button>
          <button className="btn" style={{ padding: '4px 12px', fontSize: 12.5 }} disabled={busy} onClick={() => restore()}>
            {busy ? 'Restoring…' : 'Restore all'}
          </button>
        </span>
      </div>
      <div className="muted" style={{ fontSize: 12.5 }}>
        Real views almost never go down — this is usually a scraper glitch that got saved. Restore puts each clip
        back to its highest number from the last 14 days. If a drop is genuine (e.g. the platform removed fake views),
        leave that clip as is.
      </div>
      {msg && <div style={{ fontSize: 13, color: msg.startsWith('✓') ? 'var(--good)' : 'var(--crit)' }}>{msg}</div>}
      {open && (
        <div className="grid" style={{ gap: 2, maxHeight: 320, overflowY: 'auto' }}>
          {drops.clips.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '6px 2px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ minWidth: 70 }}>{c.clipper}</span>
              <span className="muted" style={{ textTransform: 'capitalize', minWidth: 70 }}>{c.platform}</span>
              <a href={c.url} target="_blank" rel="noreferrer" style={{ maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.url.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
              <span className="muted">{nf(c.peak)} → {nf(c.views)}</span>
              <span style={{ color: 'var(--crit)' }}>−{nf(c.lost)}</span>
              <button className="btn secondary" style={{ marginLeft: 'auto', padding: '2px 10px', fontSize: 12 }} disabled={busy} onClick={() => restore([c.id])}>
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
