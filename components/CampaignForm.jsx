'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zoneChoices } from '../lib/tz.mjs';

export default function CampaignForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [streamerHandle, setStreamer] = useState('');
  const [avatar, setAvatar] = useState('');
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
      body: JSON.stringify({ name, streamerHandle, timezone, avatar }),
    });
    setBusy(false);
    if (res.ok) {
      setName(''); setStreamer(''); setAvatar('');
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
        <span className="muted" style={{ fontSize: 13 }}>Icon — an emoji, or paste an image URL (optional)</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="field" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="🎮  or  https://…/logo.png" />
          {avatar && (
            /^https?:\/\//i.test(avatar)
              ? <img src={avatar} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', border: '1px solid var(--line-2)' }} />
              : <span style={{ fontSize: 24 }}>{avatar}</span>
          )}
        </div>
      </label>
      <label className="grid" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 13 }}>Timezone</span>
        <select className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {zoneChoices().map(([tz, label]) => <option key={tz} value={tz}>{label}</option>)}
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
