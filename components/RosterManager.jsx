'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'twitter', 'other'];

export function AddClipperForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [paymentHandle, setPay] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await fetch('/api/clippers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, paymentHandle, notes }),
    });
    setBusy(false);
    if (res.ok) { setName(''); setPay(''); setNotes(''); setOpen(false); router.refresh(); }
    else setError((await res.json().catch(() => ({}))).error || 'Failed');
  }

  if (!open) return <button className="btn" onClick={() => setOpen(true)}>+ Add clipper</button>;
  return (
    <form className="card grid" style={{ gap: 10, maxWidth: 420 }} onSubmit={submit}>
      <h2>New clipper</h2>
      <input className="field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input className="field" placeholder="Payment handle (PayPal…) — optional" value={paymentHandle} onChange={(e) => setPay(e.target.value)} />
      <input className="field" placeholder="Notes — optional" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <div style={{ color: 'var(--crit)', fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" disabled={busy} type="submit">{busy ? 'Adding…' : 'Add'}</button>
        <button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function AccountsEditor({ clipperId, accounts }) {
  const router = useRouter();
  const [platform, setPlatform] = useState('tiktok');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState('');

  async function add(e) {
    e.preventDefault();
    setError('');
    const res = await fetch(`/api/clippers/${clipperId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'addAccount', platform, handle }),
    });
    if (res.ok) { setHandle(''); router.refresh(); }
    else setError((await res.json().catch(() => ({}))).error || 'Failed');
  }

  async function remove(accountId) {
    await fetch(`/api/clippers/${clipperId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'removeAccount', accountId }),
    });
    router.refresh();
  }

  return (
    <div className="grid" style={{ gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {accounts.map((a) => (
          <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'var(--surface-2)', border: '1px solid var(--line-2)', borderRadius: 999, padding: '3px 10px' }}>
            <span className="muted" style={{ textTransform: 'capitalize' }}>{a.platform}</span>
            @{a.handle}
            <button onClick={() => remove(a.id)} title="Unlink" style={{ background: 'none', border: 0, color: 'var(--text-3)', cursor: 'pointer', padding: 0 }}>×</button>
          </span>
        ))}
        {accounts.length === 0 && <span className="muted" style={{ fontSize: 13 }}>No linked accounts yet — clips from unknown accounts get flagged.</span>}
      </div>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="field" style={{ width: 130 }} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input className="field" style={{ flex: 1, minWidth: 160 }} placeholder="@handle or channel name" value={handle} onChange={(e) => setHandle(e.target.value)} />
        <button className="btn secondary" type="submit">Link account</button>
      </form>
      {error && <div style={{ color: 'var(--crit)', fontSize: 13 }}>{error}</div>}
    </div>
  );
}
