'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ApifyCapEditor({ current }) {
  const router = useRouter();
  const [cap, setCap] = useState(String(current));
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function save() {
    setBusy(true); setOk(false);
    const res = await fetch('/api/settings', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apifyDailyCap: Number(cap) }),
    });
    setBusy(false);
    if (res.ok) { setOk(true); router.refresh(); setTimeout(() => setOk(false), 1500); }
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <input className="field" style={{ width: 100, padding: '5px 9px' }} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} />
      <button className="btn secondary" style={{ padding: '5px 11px', fontSize: 13 }} disabled={busy} onClick={save}>{busy ? '…' : 'Save cap'}</button>
      {ok && <span style={{ color: 'var(--good)', fontSize: 13 }}>✓</span>}
    </span>
  );
}
