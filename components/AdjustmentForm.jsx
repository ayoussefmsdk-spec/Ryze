'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Small +bonus / −deduction form for one clipper in one cycle. */
export default function AdjustmentForm({ cycleId, clipperId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(sign) {
    const dollars = Math.abs(Number(amount));
    if (!dollars) return;
    setBusy(true);
    setErr('');
    const res = await fetch('/api/adjustments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cycleId, clipperId, amountDollars: sign * dollars, reason }),
    });
    setBusy(false);
    if (res.ok) { setOpen(false); setAmount(''); setReason(''); router.refresh(); }
    else setErr((await res.json().catch(() => ({}))).error || 'Failed');
  }

  if (!open) {
    return (
      <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12.5 }} onClick={() => setOpen(true)}>
        ± adjust
      </button>
    );
  }
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input className="field" style={{ width: 90, padding: '4px 8px' }} inputMode="decimal" placeholder="$" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      <input className="field" style={{ width: 150, padding: '4px 8px' }} placeholder="reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn" style={{ padding: '4px 10px', fontSize: 12.5 }} disabled={busy} onClick={() => submit(1)}>+ bonus</button>
      <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12.5 }} disabled={busy} onClick={() => submit(-1)}>− deduct</button>
      <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12.5 }} onClick={() => setOpen(false)}>×</button>
      {err && <span style={{ color: 'var(--crit)', fontSize: 12 }}>{err}</span>}
    </span>
  );
}
