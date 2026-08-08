'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CycleActions({ cycleId, status, hasPaidPlatforms }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null); // 'free' | 'all' | 'toggle'
  const [result, setResult] = useState('');

  async function check(scope) {
    setBusy(scope);
    setResult('');
    const res = await fetch(`/api/cycles/${cycleId}/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      setResult(
        `✓ ${d.checked} updated${d.failed ? ` · ${d.failed} flagged` : ''}${d.skipped ? ` · ${d.skipped} skipped` : ''}${d.frozen ? ' · cycle froze (end date passed)' : ''}`,
      );
      router.refresh();
    } else {
      setResult(`✗ ${d.error || 'Check failed'}`);
    }
  }

  async function toggleTracking() {
    setBusy('toggle');
    await fetch(`/api/cycles/${cycleId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: status === 'active' ? 'stopTracking' : 'resumeTracking' }),
    });
    setBusy(null);
    router.refresh();
  }

  const frozen = status === 'frozen';

  return (
    <div className="grid" style={{ gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!frozen && (
          <>
            <button className="btn" disabled={busy !== null} onClick={() => check('all')}>
              {busy === 'all' ? 'Checking… (TikTok/IG can take a minute)' : 'Check now — all platforms'}
            </button>
            {hasPaidPlatforms && (
              <button className="btn secondary" disabled={busy !== null} onClick={() => check('free')}>
                {busy === 'free' ? 'Checking…' : 'YouTube only (free)'}
              </button>
            )}
          </>
        )}
        <button className="btn secondary" disabled={busy !== null} onClick={toggleTracking}>
          {frozen ? 'Resume tracking' : 'Stop tracking'}
        </button>
      </div>
      {result && <div className="muted" style={{ fontSize: 13 }}>{result}</div>}
    </div>
  );
}
