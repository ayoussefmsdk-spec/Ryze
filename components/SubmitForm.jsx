'use client';

import { useState } from 'react';

export default function SubmitForm({ token }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {kind:'ok'|'err'|'dup', text}
  const [sent, setSent] = useState([]);

  async function submit(e) {
    e?.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/submit/${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);

    if (res.ok) {
      setSent((s) => [url, ...s].slice(0, 8));
      setUrl('');
      setMsg({ kind: 'ok', text: '✓ Submitted — it’s in review.' });
    } else if (d.code === 'duplicate') {
      setMsg({
        kind: 'err',
        text: d.sameClipper
          ? 'You already submitted this exact clip — it only counts once.'
          : 'This clip is already in this cycle — each video only counts once.',
      });
    } else {
      setMsg({ kind: 'err', text: d.error || 'Something went wrong — check the link and try again.' });
    }
  }

  return (
    <form className="grid" style={{ gap: 10 }} onSubmit={submit}>
      <input
        className="field"
        placeholder="Paste your clip link…"
        value={url}
        onChange={(e) => { setUrl(e.target.value); setMsg(null); }}
        autoFocus
      />
      <button className="btn" type="submit" disabled={busy || !url.trim()}>
        {busy ? 'Submitting…' : 'Submit clip'}
      </button>

      {msg && (
        <div style={{ fontSize: 14, color: msg.kind === 'ok' ? 'var(--good)' : 'var(--crit)' }}>
          {msg.text}
        </div>
      )}

      {sent.length > 0 && (
        <div className="muted" style={{ fontSize: 12.5 }}>
          Sent this session:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {sent.map((u, i) => <li key={i} style={{ wordBreak: 'break-all' }}>{u}</li>)}
          </ul>
        </div>
      )}
    </form>
  );
}
