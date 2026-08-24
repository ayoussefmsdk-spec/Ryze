'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddClipForm({ cycleId, members }) {
  const router = useRouter();
  const [clipperId, setClipperId] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {kind, text}

  async function submit(e, confirmDuplicate = false) {
    e?.preventDefault();
    if (!clipperId || !url.trim()) return;
    setBusy(true);
    if (!confirmDuplicate) setMsg(null);
    const res = await fetch(`/api/cycles/${cycleId}/clips`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clipperId, url, confirmDuplicate }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setUrl('');
      setMsg({ kind: 'ok', text: '✓ Clip added to Pending.' });
      router.refresh();
    } else if (d.code === 'duplicate') {
      const st = d.existing?.status ? ` — status: ${d.existing.status}` : '';
      setMsg({
        kind: 'dup',
        link: d.existing?.url || null,
        text: d.existing?.sameClipper
          ? `This clipper already submitted this clip${st}. Add anyway?`
          : `⚠️ Already submitted by ${d.existing?.clipperName || 'another clipper'}${st}. Add anyway (it will be flagged)?`,
      });
    } else if (d.code === 'deleted_before') {
      setMsg({
        kind: 'dup',
        text: '⚠️ You deleted this exact clip from this cycle before. Add it back (it will be flagged)?',
      });
    } else {
      setMsg({ kind: 'err', text: d.error || 'Could not add the clip.' });
    }
  }

  return (
    <form className="grid" style={{ gap: 8 }} onSubmit={submit}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="field" style={{ maxWidth: 200 }} value={clipperId} onChange={(e) => setClipperId(e.target.value)}>
          <option value="">Clipper…</option>
          {members.map((m) => <option key={m.clipper_id} value={m.clipper_id}>{m.name}</option>)}
        </select>
        <input className="field" style={{ flex: 1, minWidth: 220 }} placeholder="Paste a clip link (platform auto-detected)" value={url} onChange={(e) => { setUrl(e.target.value); setMsg(null); }} />
        <button className="btn" type="submit" disabled={busy || !clipperId || !url.trim()}>
          {busy ? 'Adding…' : '+ Add clip'}
        </button>
      </div>
      {msg && (
        <div style={{ fontSize: 13.5, color: msg.kind === 'ok' ? 'var(--good)' : msg.kind === 'err' ? 'var(--crit)' : 'var(--text)' }}>
          {msg.text}
          {msg.kind === 'dup' && msg.link && (
            <a href={msg.link} target="_blank" rel="noreferrer" style={{ marginLeft: 8, fontSize: 12.5 }}>see the existing one ↗</a>
          )}
          {msg.kind === 'dup' && (
            <span style={{ marginLeft: 10, display: 'inline-flex', gap: 8 }}>
              <button className="btn secondary" style={{ padding: '4px 10px' }} type="button" onClick={(e) => submit(e, true)}>Yes, add flagged</button>
              <button className="btn secondary" style={{ padding: '4px 10px' }} type="button" onClick={() => setMsg(null)}>Cancel</button>
            </span>
          )}
        </div>
      )}
    </form>
  );
}
