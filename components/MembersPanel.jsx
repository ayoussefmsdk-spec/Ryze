'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function tokenStatus(revoked, expiresAt) {
  if (revoked) return { label: 'revoked', color: 'var(--crit)' };
  if (expiresAt) {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return { label: 'expired', color: 'var(--crit)' };
    const days = Math.ceil(ms / 86400000);
    return { label: days > 1 ? `expires in ${days}d` : 'expires today', color: 'var(--warn, #f6a64b)' };
  }
  return { label: 'active', color: 'var(--good)' };
}
const linkStatus = (m) => tokenStatus(m.token_revoked, m.token_expires_at);
const statsStatus = (m) => tokenStatus(m.stats_token_revoked, m.stats_token_expires_at);

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

  function copyStatsLink(m) {
    const url = `${window.location.origin}/stats/${m.stats_token}`;
    navigator.clipboard.writeText(
      `Hey ${m.name}! Your live stats for this cycle (view-only, don't share it): ${url}`,
    );
    setCopied(`stats-${m.clipper_id}`);
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
              Revoking or expiring this link locks the clipper out of submitting (and the submit page's stats) until you restore it or send a new link.
            </div>

            {/* Stats-only twin: see their cycle stats + clips, cannot submit */}
            <div className="grid" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13.5 }}>Stats-only link</strong>
                <span className="muted" style={{ fontSize: 12 }}>view-only — no submitting</span>
                {m.stats_token && (() => { const st2 = statsStatus(m); return (
                  <span style={{ fontSize: 11.5, fontFamily: 'var(--mono)', color: st2.color, border: `1px solid ${st2.color}`, borderRadius: 999, padding: '1px 9px' }}>{st2.label}</span>
                ); })()}
                {m.stats_token && (
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    opened {m.stats_token_uses ?? 0}×{m.stats_token_last_used_at ? ` · last ${new Date(m.stats_token_last_used_at).toLocaleDateString()}` : ''}
                  </span>
                )}
              </div>
              {!m.stats_token ? (
                <div>
                  <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12.5 }}
                    onClick={() => api({ clipperId: m.clipper_id, action: 'regenerate', kind: 'stats' })}>
                    + Create stats link
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12.5, color: 'var(--gold)' }} onClick={() => copyStatsLink(m)}>
                    {copied === `stats-${m.clipper_id}` ? 'copied ✓' : 'copy link'}
                  </button>
                  {m.stats_token_revoked
                    ? <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12.5, color: 'var(--good)' }} onClick={() => api({ clipperId: m.clipper_id, action: 'restore', kind: 'stats' })}>Turn back on</button>
                    : <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12.5, color: 'var(--crit)' }} onClick={() => api({ clipperId: m.clipper_id, action: 'revoke', kind: 'stats' })}>Revoke</button>}
                  <button className="btn secondary" style={{ padding: '5px 12px', fontSize: 12.5 }} onClick={() => api({ clipperId: m.clipper_id, action: 'regenerate', kind: 'stats' })}>↻ New link</button>
                  <span className="muted" style={{ fontSize: 12.5 }}>· Timer:</span>
                  {[['7', '7 days'], ['30', '30 days'], [null, 'never']].map(([d, label]) => (
                    <button key={label} className="btn secondary" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => api({ clipperId: m.clipper_id, action: 'expiry', kind: 'stats', expiresDays: d === null ? null : Number(d) })}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
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
