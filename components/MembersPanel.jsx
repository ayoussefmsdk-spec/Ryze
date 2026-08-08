'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MembersPanel({ cycleId, members, roster }) {
  const router = useRouter();
  const [adding, setAdding] = useState('');
  const [copied, setCopied] = useState('');

  const enrolled = new Set(members.map((m) => m.clipper_id));
  const available = roster.filter((r) => !enrolled.has(r.id));

  async function add() {
    if (!adding) return;
    await fetch(`/api/cycles/${cycleId}/clippers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clipperId: adding }),
    });
    setAdding('');
    router.refresh();
  }

  async function remove(clipperId) {
    await fetch(`/api/cycles/${cycleId}/clippers?clipperId=${clipperId}`, { method: 'DELETE' });
    router.refresh();
  }

  async function regenerate(clipperId) {
    await fetch(`/api/cycles/${cycleId}/clippers`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clipperId }),
    });
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
        {members.map((m) => (
          <span key={m.clipper_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 999, padding: '4px 12px' }}>
            {m.name}
            <button onClick={() => copyLink(m)} title="Copy their private submission link + message" style={{ background: 'none', border: 0, color: 'var(--gold)', cursor: 'pointer', padding: 0, fontSize: 12 }}>
              {copied === m.clipper_id ? 'copied ✓' : 'copy link'}
            </button>
            <button onClick={() => regenerate(m.clipper_id)} title="Revoke old link, make a new one" style={{ background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer', padding: 0, fontSize: 12 }}>
              ↻
            </button>
            <button onClick={() => remove(m.clipper_id)} title="Remove from cycle" style={{ background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer', padding: 0 }}>
              ×
            </button>
          </span>
        ))}
        {members.length === 0 && <span className="muted" style={{ fontSize: 13 }}>No clippers enrolled yet.</span>}
      </div>

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
