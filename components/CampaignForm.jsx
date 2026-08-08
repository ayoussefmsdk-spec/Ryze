'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Common IANA zones; the manager can pick per campaign (overridable per cycle later).
const ZONES = [
  'Africa/Casablanca',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
];

export default function CampaignForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [streamerHandle, setStreamer] = useState('');
  const [timezone, setTimezone] = useState('Africa/Casablanca');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, streamerHandle, timezone }),
    });
    setBusy(false);
    if (res.ok) {
      setName('');
      setStreamer('');
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not create the campaign.');
    }
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>+ New campaign</button>
    );
  }

  return (
    <form className="card grid" style={{ gap: 12, maxWidth: 460 }} onSubmit={submit}>
      <h2>New campaign</h2>
      <label className="grid" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 13 }}>Campaign name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Camy's Campaign" autoFocus />
      </label>
      <label className="grid" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 13 }}>Streamer handle (optional)</span>
        <input className="field" value={streamerHandle} onChange={(e) => setStreamer(e.target.value)} placeholder="@camy" />
      </label>
      <label className="grid" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 13 }}>Timezone</span>
        <select className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </label>
      {error && <div style={{ color: 'var(--crit)', fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create campaign'}</button>
        <button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
