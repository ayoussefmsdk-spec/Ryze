'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CycleActions({ cycleId, status, hasPaidPlatforms, hasFacebook, endsOn }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null); // 'free' | 'all' | 'toggle' | 'revive'
  const [result, setResult] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const ended = endsOn && String(endsOn) < today;
  // Sensible default for revival: keep the date if it's still ahead, else one more week.
  const [reviveEnds, setReviveEnds] = useState(
    ended ? new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) : String(endsOn || ''),
  );

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
        `✓ ${d.checked} updated${d.failed ? ` · ${d.failed} flagged` : ''}${d.skipped ? ` · ${d.skipped} skipped${d.capInfo ? ` — daily paid-check cap hit (${d.capInfo.used}/${d.capInfo.cap} used today; stalest clips went first — raise the cap in System or wait for tomorrow)` : ''}` : ''}${d.dupesFlagged ? ` · ${d.dupesFlagged} duplicate${d.dupesFlagged > 1 ? 's' : ''} caught` : ''}${d.frozen ? ' · cycle froze (end date passed)' : ''}`,
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
      body: JSON.stringify({ action: 'stopTracking' }),
    });
    setBusy(null);
    router.refresh();
  }

  async function revive() {
    setBusy('revive');
    setResult('');
    const res = await fetch(`/api/cycles/${cycleId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'revive', endsOn: reviveEnds }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) { setResult('✓ Cycle is live again — tracking resumed.'); router.refresh(); }
    else setResult(`✗ ${d.error || 'Revive failed'}`);
  }

  const frozen = status === 'frozen';

  return (
    <div className="grid" style={{ gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!frozen && (
          <>
            <button className="btn" disabled={busy !== null} onClick={() => check('all')}
              title="YouTube + TikTok + Instagram. Facebook is never included — it has its own button.">
              {busy === 'all' ? 'Checking… (TikTok/IG can take a minute)' : 'Check now — all platforms'}
            </button>
            {hasPaidPlatforms && (
              <button className="btn secondary" disabled={busy !== null} onClick={() => check('free')}>
                {busy === 'free' ? 'Checking…' : 'YouTube only (free)'}
              </button>
            )}
            {hasFacebook && (
              <button className="btn secondary" disabled={busy !== null} onClick={() => check('facebook')}
                title="Checks ONLY the Facebook clips in this cycle — nothing else runs, nothing else spends.">
                {busy === 'facebook' ? 'Checking Facebook…' : 'Facebook only'}
              </button>
            )}
          </>
        )}
        {!frozen && (
          <button className="btn secondary" disabled={busy !== null} onClick={toggleTracking}>
            Stop tracking
          </button>
        )}
        {frozen && (
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 13 }}>{ended ? 'Ended — revive until:' : 'Track again until:'}</span>
            <input className="field" type="date" style={{ padding: '6px 9px' }} value={reviveEnds} onChange={(e) => setReviveEnds(e.target.value)} />
            <button className="btn" disabled={busy !== null} onClick={revive}
              title="Reopen this cycle: tracking, checks and submissions run again until the chosen end date">
              {busy === 'revive' ? 'Reviving…' : '🔄 Revive cycle'}
            </button>
          </span>
        )}
      </div>
      {result && <div className="muted" style={{ fontSize: 13 }}>{result}</div>}
    </div>
  );
}
