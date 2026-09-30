'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** The ✕ next to "N flagged clips" — one click reviews-away every flag in the
 *  cycle (sticky, like dismissing them clip by clip, minus the clicking). */
export default function ClearAllFlags({ cycleId, count }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function clearAll() {
    if (busy) return;
    if (!window.confirm(
      `Dismiss ALL flags on ${count} clip${count > 1 ? 's' : ''}?\n\nSame as clicking ✕ on each one: the flags are remembered as dismissed, so checks won't re-raise them on these clips. The clips themselves are untouched.`,
    )) return;
    setBusy(true);
    await fetch(`/api/cycles/${cycleId}/flags`, { method: 'DELETE' }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={clearAll}
      disabled={busy}
      title="Dismiss every flag in this cycle (sticky — they won't come back on the next check)"
      style={{
        background: 'none', border: '1px solid var(--line-2)', borderRadius: 999,
        color: 'var(--text-3)', fontSize: 11.5, padding: '1px 9px', cursor: 'pointer',
        marginLeft: 2,
      }}
    >
      {busy ? '…' : '✕ clear all'}
    </button>
  );
}
