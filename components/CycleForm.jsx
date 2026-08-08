'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MODEL_LABELS = {
  cpm: 'CPM — pay per 1,000 views',
  pot_proportional: 'Pot — split by view share',
  pot_equal: 'Pot — split equally among qualifiers',
  placement: 'Placement — prizes for top ranks',
  flat_per_clip: 'Flat — fixed $ per clip',
};

const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'twitter', 'other'];

import { zoneChoices, gmtLabel } from '../lib/tz.mjs';

export default function CycleForm({ campaignId, campaignTimezone }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [timezone, setTimezone] = useState('');
  const [payoutModel, setPayoutModel] = useState('cpm');
  const [budgetDollars, setBudget] = useState('3500');
  const [cpm, setCpm] = useState({ youtube: '2', tiktok: '2', instagram: '2', twitter: '2', other: '2' });
  const [prizes, setPrizes] = useState('1000, 500, 250');
  const [flatAmountDollars, setFlat] = useState('5');
  const [maxPerClipDollars, setMaxClip] = useState('');
  const [maxPerClipperDollars, setMaxClipper] = useState('');
  const [allowedPlatforms, setAllowed] = useState([...PLATFORMS]);
  const [minViewEnabled, setMinEnabled] = useState(false);
  const [minViewFloor, setMinFloor] = useState('1000');
  const [enforcePostWindow, setEnforceWindow] = useState(true);
  const [hashtagMode, setHashtagMode] = useState('off');
  const [requiredHashtags, setTags] = useState('');

  function togglePlatform(p) {
    setAllowed((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch(`/api/campaigns/${campaignId}/cycles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name, startsOn, endsOn, timezone, payoutModel, budgetDollars, cpm,
        prizesDollars: prizes.split(',').map((s) => s.trim()).filter(Boolean),
        flatAmountDollars, maxPerClipDollars, maxPerClipperDollars,
        allowedPlatforms, minViewEnabled, minViewFloor,
        enforcePostWindow, hashtagMode, requiredHashtags,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Could not create the cycle.');
    }
  }

  if (!open) return <button className="btn" onClick={() => setOpen(true)}>+ New cycle</button>;

  const isPot = payoutModel === 'pot_proportional' || payoutModel === 'pot_equal';

  return (
    <form className="card grid" style={{ gap: 14, maxWidth: 560 }} onSubmit={submit}>
      <h2>New cycle</h2>

      <label className="grid" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 13 }}>Cycle name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="August cycle" autoFocus />
      </label>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label className="grid" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>Starts</span>
          <input className="field" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </label>
        <label className="grid" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>Ends</span>
          <input className="field" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </label>
      </div>

      <label className="grid" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 13 }}>Timezone</span>
        <select className="field" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          <option value="">Campaign default ({gmtLabel(campaignTimezone)})</option>
          {zoneChoices().map(([tz, label]) => <option key={tz} value={tz}>{label}</option>)}
        </select>
      </label>

      <label className="grid" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 13 }}>Payout style</span>
        <select className="field" value={payoutModel} onChange={(e) => setPayoutModel(e.target.value)}>
          {Object.entries(MODEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>

      {payoutModel === 'cpm' && (
        <div className="grid" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>CPM per platform ($ per 1,000 views)</span>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {allowedPlatforms.map((p) => (
              <label key={p} className="grid" style={{ gap: 4 }}>
                <span className="muted" style={{ fontSize: 12, textTransform: 'capitalize' }}>{p}</span>
                <input className="field" inputMode="decimal" value={cpm[p] ?? ''} onChange={(e) => setCpm({ ...cpm, [p]: e.target.value })} />
              </label>
            ))}
          </div>
        </div>
      )}

      {(payoutModel === 'cpm' || isPot) && (
        <label className="grid" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>{isPot ? 'Pot size ($) — the amount split among qualifiers' : 'Budget cap ($)'}</span>
          <input className="field" inputMode="decimal" value={budgetDollars} onChange={(e) => setBudget(e.target.value)} />
        </label>
      )}

      {(payoutModel === 'cpm' || payoutModel === 'pot_proportional') && (
        <div className="grid" style={{ gridTemplateColumns: payoutModel === 'cpm' ? '1fr 1fr' : '1fr', gap: 10 }}>
          {payoutModel === 'cpm' && (
            <label className="grid" style={{ gap: 6 }}>
              <span className="muted" style={{ fontSize: 13 }}>Max payout per clip ($, blank = none)</span>
              <input className="field" inputMode="decimal" placeholder="e.g. 100" value={maxPerClipDollars} onChange={(e) => setMaxClip(e.target.value)} />
            </label>
          )}
          <label className="grid" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>Max payout per clipper ($, blank = none)</span>
            <input className="field" inputMode="decimal" placeholder="e.g. 500" value={maxPerClipperDollars} onChange={(e) => setMaxClipper(e.target.value)} />
          </label>
        </div>
      )}

      {payoutModel === 'placement' && (
        <label className="grid" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>Prizes ($, comma-separated: 1st, 2nd, 3rd…)</span>
          <input className="field" value={prizes} onChange={(e) => setPrizes(e.target.value)} placeholder="1000, 500, 250" />
        </label>
      )}

      {payoutModel === 'flat_per_clip' && (
        <label className="grid" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>Amount per qualifying clip ($)</span>
          <input className="field" inputMode="decimal" value={flatAmountDollars} onChange={(e) => setFlat(e.target.value)} />
        </label>
      )}

      <div className="grid" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 13 }}>Allowed platforms</span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PLATFORMS.map((p) => (
            <label key={p} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
              <input type="checkbox" checked={allowedPlatforms.includes(p)} onChange={() => togglePlatform(p)} />
              <span style={{ textTransform: 'capitalize' }}>{p}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid" style={{ gap: 8 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={minViewEnabled} onChange={(e) => setMinEnabled(e.target.checked)} />
          Minimum views {payoutModel === 'cpm' ? 'for a clip to pay' : 'to qualify'}
        </label>
        {minViewEnabled && (
          <input className="field" style={{ maxWidth: 200 }} inputMode="numeric" value={minViewFloor} onChange={(e) => setMinFloor(e.target.value)} />
        )}
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
        <input type="checkbox" checked={enforcePostWindow} onChange={(e) => setEnforceWindow(e.target.checked)} />
        Flag clips posted outside the cycle dates
      </label>

      <div className="grid" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 13 }}>Required hashtag</span>
        <select className="field" style={{ maxWidth: 260 }} value={hashtagMode} onChange={(e) => setHashtagMode(e.target.value)}>
          <option value="off">Off — no hashtag requirement</option>
          <option value="flag">Flag clips missing it (I decide)</option>
          <option value="auto_reject">Auto-reject clips missing it</option>
        </select>
        {hashtagMode !== 'off' && (
          <input className="field" value={requiredHashtags} onChange={(e) => setTags(e.target.value)} placeholder="#camy (separate several with commas)" />
        )}
      </div>

      {error && <div style={{ color: 'var(--crit)', fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create cycle'}</button>
        <button className="btn secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
