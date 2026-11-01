'use client';

import { useEffect, useRef, useState } from 'react';
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

  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef(null);

  const summarize = (d) =>
    `✓ ${d.checked} updated${d.failed ? ` · ${d.failed} flagged` : ''}${d.skipped ? ` · ${d.skipped} skipped${d.capInfo ? ` — daily paid-check cap hit (${d.capInfo.used}/${d.capInfo.cap} used today; stalest clips went first — raise the cap in System or wait for tomorrow)` : ''}` : ''}${d.dupesFlagged ? ` · ${d.dupesFlagged} duplicate${d.dupesFlagged > 1 ? 's' : ''} caught` : ''}${d.frozen ? ' · cycle froze (end date passed)' : ''}`;

  // Poll a background run until it finishes. Big cycles take minutes — far
  // longer than one web request may stay open — so the check runs on the
  // server and this only watches it. Safe to leave the page: it keeps going.
  function watch(run) {
    clearInterval(pollRef.current);
    setBusy(run.scope);
    const t0 = new Date(run.startedAt).getTime();
    setElapsed(Math.max(0, Math.round((Date.now() - t0) / 1000)));
    let misses = 0;
    pollRef.current = setInterval(async () => {
      setElapsed(Math.max(0, Math.round((Date.now() - t0) / 1000)));
      let d = null;
      try {
        const r = await fetch(`/api/cycles/${cycleId}/check?run=${run.id}`, { cache: 'no-store' });
        d = r.ok ? await r.json() : null;
      } catch { /* transient — keep watching */ }
      if (!d?.run) {
        if (++misses >= 20) { // ~1 minute without an answer
          clearInterval(pollRef.current);
          setBusy(null);
          setResult('… Lost contact with the server — the check is probably still running. Refresh in a few minutes.');
        }
        return;
      }
      misses = 0;
      const st = d.run.status;
      if (st === 'running') return;
      clearInterval(pollRef.current);
      setBusy(null);
      if (st === 'done') { setResult(summarize(d.run.result || {})); router.refresh(); }
      else if (st === 'failed') setResult(`✗ ${d.run.error || 'Check failed'}`);
      else setResult('✗ That check was interrupted (the server restarted). Press the button again.');
    }, 3000);
  }

  // Coming back to the page while a check is still running? Pick it back up.
  useEffect(() => {
    let alive = true;
    fetch(`/api/cycles/${cycleId}/check`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.run?.status === 'running') watch(d.run); })
      .catch(() => {});
    return () => { alive = false; clearInterval(pollRef.current); };
  }, [cycleId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function check(scope) {
    setBusy(scope);
    setResult('');
    let d = {};
    let ok = false;
    try {
      const res = await fetch(`/api/cycles/${cycleId}/check`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
      d = await res.json().catch(() => ({}));
      ok = res.ok && d.run;
    } catch { /* handled below */ }
    if (!ok) {
      setBusy(null);
      setResult(`✗ ${d.error || 'Could not start the check — try again in a moment.'}`);
      return;
    }
    if (d.alreadyRunning) setResult('A check is already running for this cycle — showing its progress.');
    watch(d.run);
  }

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

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
              {busy === 'all' ? `Checking… ${mmss}` : 'Check now — all platforms'}
            </button>
            {hasPaidPlatforms && (
              <button className="btn secondary" disabled={busy !== null} onClick={() => check('free')}>
                {busy === 'free' ? `Checking… ${mmss}` : 'YouTube only (free)'}
              </button>
            )}
            {hasFacebook && (
              <button className="btn secondary" disabled={busy !== null} onClick={() => check('facebook')}
                title="Checks ONLY the Facebook clips in this cycle — nothing else runs, nothing else spends.">
                {busy === 'facebook' ? `Checking Facebook… ${mmss}` : 'Facebook only'}
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
      {['all', 'free', 'facebook', 'paid'].includes(busy) && (
        <div className="muted" style={{ fontSize: 12.5 }}>
          Running on the server — big cycles take several minutes (TikTok/Instagram are the slow part).
          You can leave this page; it keeps going and shows the result when you come back.
        </div>
      )}
      {result && <div className="muted" style={{ fontSize: 13 }}>{result}</div>}
    </div>
  );
}
