'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zoneChoices } from '../lib/tz.mjs';

/** Full campaign editor: identity, icon, timezone, notes, archive, delete. */
export default function CampaignSettings({ campaign }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(campaign.name);
  const [streamer, setStreamer] = useState(campaign.streamer_handle || '');
  const [avatar, setAvatar] = useState(campaign.avatar_url || '');
  const [timezone, setTimezone] = useState(campaign.timezone || 'UTC');
  const [notes, setNotes] = useState(campaign.notes || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setBusy(true); setMsg('');
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, streamerHandle: streamer, avatar, timezone, notes }),
    });
    setBusy(false);
    if (res.ok) { setMsg('Saved ✓'); router.refresh(); setTimeout(() => setMsg(''), 1800); }
    else setMsg((await res.json().catch(() => ({}))).error || 'Failed to save');
  }

  async function toggleArchive() {
    setBusy(true);
    await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archived: !campaign.archived }),
    });
    setBusy(false);
    if (!campaign.archived) router.push('/campaigns');
    else router.refresh();
  }

  async function destroy() {
    setDeleting(true);
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmName: confirmDelete }),
    });
    setDeleting(false);
    if (res.ok) router.push('/campaigns');
    else setMsg((await res.json().catch(() => ({}))).error || 'Delete failed');
  }

  if (!open) {
    return <button className="btn secondary" style={{ padding: '8px 13px', fontSize: 13.5 }} onClick={() => setOpen(true)}>⚙ Edit campaign</button>;
  }

  return (
    <div className="card grid" style={{ gap: 14, width: '100%', maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0 }}>Campaign settings</h2>
        <button className="btn secondary" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12.5 }} onClick={() => setOpen(false)}>Close</button>
      </div>

      <label className="grid" style={{ gap: 5 }}>
        <span className="muted" style={{ fontSize: 13 }}>Campaign name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label className="grid" style={{ gap: 5 }}>
          <span className="muted" style={{ fontSize: 13 }}>Streamer handle</span>
          <input className="field" value={streamer} onChange={(e) => setStreamer(e.target.value)} placeholder="@streamer" />
        </label>
        <label className="grid" style={{ gap: 5 }}>
          <span className="muted" style={{ fontSize: 13 }}>Timezone</span>
          <select className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {zoneChoices().map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <label className="grid" style={{ gap: 5 }}>
        <span className="muted" style={{ fontSize: 13 }}>Icon — an emoji, or paste an image URL</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input className="field" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="🎮  or  https://…/logo.png" />
          {avatar && (
            /^https?:\/\//i.test(avatar)
              ? <img src={avatar} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', border: '1px solid var(--line-2)', flexShrink: 0 }} />
              : <span style={{ fontSize: 26, flexShrink: 0 }}>{avatar}</span>
          )}
        </div>
      </label>

      <label className="grid" style={{ gap: 5 }}>
        <span className="muted" style={{ fontSize: 13 }}>Notes (private)</span>
        <textarea className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Deal terms, contacts, anything." />
      </label>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
        {msg && <span style={{ fontSize: 13.5, color: msg.startsWith('Saved') ? 'var(--good)' : 'var(--crit)' }}>{msg}</span>}
      </div>

      <div className="grid" style={{ gap: 10, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <div className="eyebrow" style={{ color: 'var(--crit)' }}>Danger zone</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn secondary" disabled={busy} onClick={toggleArchive}>
            {campaign.archived ? 'Unarchive campaign' : 'Archive campaign'}
          </button>
          <span className="muted" style={{ fontSize: 12.5 }}>Archiving hides it everywhere but keeps every number. Reversible.</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="field" style={{ maxWidth: 220 }}
            placeholder={`Type "${campaign.name}" to enable`}
            value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)}
          />
          <button
            className="btn secondary" style={{ color: 'var(--crit)', borderColor: confirmDelete === campaign.name ? 'var(--crit)' : 'var(--line-2)' }}
            disabled={deleting || confirmDelete !== campaign.name}
            onClick={destroy}
          >
            {deleting ? 'Deleting…' : 'Delete forever'}
          </button>
          <span className="muted" style={{ fontSize: 12.5 }}>Erases all its cycles, clips and payout history. No undo.</span>
        </div>
      </div>
    </div>
  );
}
