'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function linkStatus(m) {
  if (m.token_revoked) return { label: 'revoked', color: 'var(--crit)' };
  if (m.token_expires_at) {
    const ms = new Date(m.token_expires_at).getTime() - Date.now();
    if (ms <= 0) return { label: 'expired', color: 'var(--crit)' };
    const days = Math.ceil(ms / 86400000);
    return { label: days > 1 ? `expires in ${days}d` : 'expires today', color: 'var(--warn, #f6a64b)' };
  }
  return { label: 'active', color: 'var(--good)' };
}

export default function MembersPanel({ cycleId, members, roster }) {
  const router = useRouter();
  const [adding, setAdding] = useState('');
  const [copied, setCopied] = useState('');
  const [openId, setOpenId] = useState(null); // which member's link controls are open

  const enrolled = new Set(members.map((m) => m.clipper_id));
  const available = roster.filter((r) => !enrolled.has(r.id));

  async function api(body) {
    await fetch(`/api/cycles/${cycleId}/clippers`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  async function add() {
    if (!adding) return;
    await fetch(`/api/cycles/${cycleId}/clippers`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clipperId: adding }),
    });
    setAdding('');
    router.refresh();
  }

  async function remove(clipperId) {
    await fetch(`/api/cycles/${cycleId}/clippers?clipperId=${clipperId}`, { method: 'DELETE' });
    router.refresh();
  }

  function copyLink(m) {
    const url = `${window.location.origin}/submit/${m.submission_token}`;
    navigator.clipboard.writeText(
      `Hey ${m.name}! Submit your clips for this cycle here (your personal link, don't share it): ${url}`,
    );
    setCopied(m.clipper_id);
    setTimeout(() => setCopied(''), 1500);
  }

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {members.map((m) => {
          const st = linkStatus(m);
          const isOpen = openId === m.clipper_id;
          return (
            <span key={m.clipper_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, background: 'var(--surface-2)', border: `1px solid ${isOpen ? 'var(--honey)' : 'var(--line-2)'}`, borderRadius: 999, padding: '4px 12px' }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: st.color }} title={`link ${st.label}`} />
              {m.name}
              <button onClick={() => copyLink(m)} title="Copy their private submission link + message" style={{ background: 'none', border: 0, color: 'var(--gold)', cursor: 'pointer', padding: 0, fontSize: 12 }}>
                {copied === m.clipper_id ? 'copied ✓' : 'copy link'}
              </button>
              <button onClick={() => setOpenId(isOpen ? null : m.clipper_id)} title="Manage this link (revoke / timer / new link)" style={{ background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer', padding: 0, fontSize: 12 }}>
                ⚙
              </button>
              <button onClick={() => remove(m.clipper_id)} title="Remove from cycle" style={{ background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer', padding: 0 }}>
                ×
              </button>
            </span>
          );
        })}
        {members.length === 0 && <span className="muted" style={{ fontSize: 13 }}>No clippers enrolled yet.</span>}
      </div>

      {/* Link controls for the selected member */}
      {openId && (() => {
        const m = members.find((x) => x.clipper_id === openId);
        if (!m) return null;
        const st = linkStatus(m);
        return (
          <div className="card grid" style={{ gap: 10, maxWidth: 560, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 14 }}>{m.name}'s link</strong>
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: st.color, border: `1px solid ${st.color}`, borderRadius: 999, padding: '1px 9px' }}>{st.label}</span>
              {m.token_expires_at && !m.token_revoked && (
                <span className="muted" style={{ fontSize: 12 }}>until {new Date(m.token_expires_at).toLocaleString()}</span>
              )}
              <button className="btn secondary" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 12 }} onClick={() => setOpenId(null)}>Close</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {m.token_revoked
                ? <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12.5, color: 'var(--good)' }} onClick={() => api({ clipperId: m.clipper_id, action: 'restore' })}>Turn link back on</button>
                : <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12.5, color: 'var(--crit)' }} onClick={() => api({ clipperId: m.clipper_id, action: 'revoke' })}>Revoke now</button>}
              <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={() => api({ clipperId: m.clipper_id, action: 'regenerate' })}
                title="Old link dies instantly; copy and send the new one">
                ↻ New link
              </button>
              <span className="muted" style={{ fontSize: 12.5 }}>·</span>
              <span className="muted" style={{ fontSize: 12.5 }}>Timer:</span>
              {[['1', '24h'], ['3', '3 days'], ['7', '7 days'], ['30', '30 days'], [null, 'never']].map(([d, label]) => (
                <button key={label} className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => api({ clipperId: m.clipper_id, action: 'expiry', expiresDays: d === null ? null : Number(d) })}>
                  {label}
                </button>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              Revoking or expiring a link locks the clipper out of submitting AND their stats page until you restore it or send a new link.
            </div>
          </div>
        );
      })()}

      {available.length > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="field" style={{ maxWidth: 240 }} value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Add a clipper from the roster…</option>
            {available.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button className="btn secondary" onClick={add} disabled={!adding}>Add</button>
        </div>
      )}
    </div>
  );
}
