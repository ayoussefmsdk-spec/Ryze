'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Edits the calibratable Apify cost rate: dollars per 1,000 paid checks,
 * stored as cents in app_settings.apify_cents_per_1k. */
export default function ApifyRateEditor({ currentCents }) {
  const router = useRouter();
  const [rate, setRate] = useState((currentCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function save() {
    setBusy(true); setOk(false);
    const res = await fetch('/api/settings', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ apifyCentsPer1k: Math.round(Number(rate) * 100) }),
    });
    setBusy(false);
    if (res.ok) { setOk(true); router.refresh(); setTimeout(() => setOk(false), 1500); }
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <span className="muted" style={{ fontSize: 13 }}>$</span>
      <input className="field" style={{ width: 80, padding: '5px 9px' }} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
      <span className="muted" style={{ fontSize: 13 }}>per 1,000</span>
      <button className="btn secondary" style={{ padding: '5px 11px', fontSize: 13 }} disabled={busy} onClick={save}>{busy ? '…' : 'Save rate'}</button>
      {ok && <span style={{ color: 'var(--good)', fontSize: 13 }}>✓</span>}
    </span>
  );
}
