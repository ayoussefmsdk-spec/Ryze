'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** "Clone last cycle" — copies every setting + roster; you set name and dates. */
export default function CloneCycleForm({ campaignId, sourceCycleId, sourceName }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const res = await fetch(`/api/campaigns/${campaignId}/cycles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cloneFromCycleId: sourceCycleId, name, startsOn, endsOn }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setOpen(false); router.push(`/cycle/${d.cycleId}`); router.refresh(); }
    else setErr(d.error || 'Clone failed');
  }

  if (!open) {
    return <button className="btn secondary" onClick={() => setOpen(true)}>⧉ Clone “{sourceName}”</button>;
  }
  return (
    <form className="card grid" style={{ gap: 10, maxWidth: 440 }} onSubmit={submit}>
      <div className="muted" style={{ fontSize: 13 }}>
        Copies all settings, CPM rates and the roster from “{sourceName}”. Clippers get fresh submission links.
      </div>
      <input className="field" placeholder="New cycle name (e.g. September cycle)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input className="field" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        <input className="field" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
      </div>
      {err && <div style={{ color: 'var(--crit)', fontSize: 13 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" disabled={busy} type="submit">{busy ? 'Cloning…' : 'Clone cycle'}</button>
        <button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
