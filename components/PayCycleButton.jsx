'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PayCycleButton({ cycleId, clipperId = null, label, amount }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pay() {
    const what = clipperId ? `Mark ${label} as paid (${amount})?` : `Mark the WHOLE cycle as paid (${amount})? This settles every unpaid clipper.`;
    if (!window.confirm(what)) return;
    setBusy(true);
    setErr('');
    const res = await fetch('/api/payouts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(clipperId ? { cycleId, action: 'payClipper', clipperId } : { cycleId, action: 'payCycle' }),
    });
    setBusy(false);
    if (!res.ok) setErr((await res.json().catch(() => ({}))).error || 'Failed');
    router.refresh();
  }

  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button className={clipperId ? 'btn secondary' : 'btn'} style={clipperId ? { padding: '4px 10px', fontSize: 12.5 } : {}} disabled={busy} onClick={pay}>
        {busy ? 'Recording…' : clipperId ? 'Mark paid' : `Mark cycle paid — ${amount}`}
      </button>
      {err && <span style={{ color: 'var(--crit)', fontSize: 12.5 }}>{err}</span>}
    </span>
  );
}
