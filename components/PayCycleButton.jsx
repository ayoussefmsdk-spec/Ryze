'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Cycle mode (no clipperId): one button that settles every remaining balance.
 * Clipper mode: "Mark paid" for the full remaining, plus a partial-amount
 * input — type 200 to pay $200 of a $500 balance; the rest stays owed.
 */
export default function PayCycleButton({ cycleId, clipperId = null, label, amount, remainingCents = null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [partial, setPartial] = useState('');

  async function pay(amountCents = null) {
    const what = clipperId
      ? amountCents != null
        ? `Pay ${label} $${(amountCents / 100).toFixed(2)} of the ${amount} they're owed?`
        : `Mark ${label} fully paid (${amount})?`
      : `Mark the WHOLE cycle as paid (${amount})? This settles every remaining balance.`;
    if (!window.confirm(what)) return;
    setBusy(true);
    setErr('');
    const res = await fetch('/api/payouts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        clipperId
          ? { cycleId, action: 'payClipper', clipperId, ...(amountCents != null ? { amountCents } : {}) }
          : { cycleId, action: 'payCycle' },
      ),
    });
    setBusy(false);
    if (!res.ok) setErr((await res.json().catch(() => ({}))).error || 'Failed');
    else setPartial('');
    router.refresh();
  }

  function payPartial() {
    const dollars = Number(partial);
    if (!Number.isFinite(dollars) || dollars <= 0) { setErr('Enter an amount'); return; }
    pay(Math.round(dollars * 100));
  }

  if (!clipperId) {
    return (
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <button className="btn" disabled={busy} onClick={() => pay()}>
          {busy ? 'Recording…' : `Mark cycle paid — ${amount}`}
        </button>
        {err && <span style={{ color: 'var(--crit)', fontSize: 12.5 }}>{err}</span>}
      </span>
    );
  }

  const maxDollars = remainingCents != null ? (remainingCents / 100).toFixed(2) : '';

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span className="muted" style={{ fontSize: 12.5 }}>$</span>
        <input
          className="field"
          style={{ width: 76, padding: '4px 8px', fontSize: 12.5 }}
          inputMode="decimal"
          placeholder={maxDollars}
          title={`Partial amount — up to $${maxDollars}`}
          value={partial}
          onChange={(e) => { setPartial(e.target.value); setErr(''); }}
        />
        <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12.5 }} disabled={busy || !partial} onClick={payPartial}>
          Pay part
        </button>
      </span>
      <button className="btn secondary" style={{ padding: '4px 10px', fontSize: 12.5, color: 'var(--good)' }} disabled={busy} onClick={() => pay()}>
        {busy ? '…' : `Pay rest (${amount})`}
      </button>
      {err && <span style={{ color: 'var(--crit)', fontSize: 12.5 }}>{err}</span>}
    </span>
  );
}
