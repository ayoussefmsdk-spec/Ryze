'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ScheduleEditor from './ScheduleEditor.jsx';

const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'twitter', 'other'];

/** Mid-cycle settings editor — every change recalculates live + is change-logged. */
export default function CycleSettings({ cycle, cpm }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const [name, setName] = useState(cycle.name);
  const [startsOn, setStarts] = useState(String(cycle.starts_on));
  const [endsOn, setEnds] = useState(String(cycle.ends_on));
  const [budget, setBudget] = useState(String(Number(cycle.budget_cap_cents) / 100));
  const [minOn, setMinOn] = useState(cycle.min_view_enabled);
  const [minFloor, setMinFloor] = useState(String(cycle.min_view_floor));
  const [hashtagMode, setHM] = useState(cycle.hashtag_mode);
  const [tags, setTags] = useState((cycle.required_hashtags || []).join(', '));
  const [window_, setWindow] = useState(cycle.enforce_post_window);
  const [rates, setRates] = useState(Object.fromEntries(
    PLATFORMS.map((p) => [p, cpm[p] != null ? String(cpm[p] / 100) : '']),
  ));
  const cfg = cycle.payout_config || {};
  const [maxClip, setMaxClip] = useState(cfg.maxPerClipCents ? String(cfg.maxPerClipCents / 100) : '');
  const [maxClipper, setMaxClipper] = useState(cfg.maxPerClipperCents ? String(cfg.maxPerClipperCents / 100) : '');
  const [maxPaidViews, setMaxPaidViews] = useState(cfg.maxPaidViewsPerClip ? String(cfg.maxPaidViewsPerClip) : '');
  const [checkSchedule, setCheckSchedule] = useState(cycle.check_schedule || {
    free: { mode: 'daily', atLocal: ['06:00', '12:00', '18:00', '23:00'] },
    paid: { mode: 'daily', atLocal: ['06:00'] },
  });

  async function save() {
    setBusy(true);
    setMsg('');
    const optCents = (v) => { const n = Number(v); return v !== '' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined; };
    const newCfg = { ...cfg };
    delete newCfg.maxPerClipCents; delete newCfg.maxPerClipperCents; delete newCfg.maxPaidViewsPerClip;
    if (optCents(maxClip)) newCfg.maxPerClipCents = optCents(maxClip);
    if (optCents(maxClipper)) newCfg.maxPerClipperCents = optCents(maxClipper);
    const mpv = Math.trunc(Number(maxPaidViews));
    if (maxPaidViews !== '' && Number.isFinite(mpv) && mpv > 0) newCfg.maxPaidViewsPerClip = mpv;
    if (['pot_proportional', 'pot_equal'].includes(cycle.payout_model)) {
      newCfg.potCents = Math.round(Number(budget || 0) * 100);
    }

    const res = await fetch(`/api/cycles/${cycle.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name, startsOn, endsOn, budgetDollars: budget,
        minViewEnabled: minOn, minViewFloor: minFloor,
        hashtagMode, requiredHashtags: tags, enforcePostWindow: window_,
        payoutConfig: newCfg,
        checkSchedule,
      }),
    });
    // CPM rates go through their own action (one change-log line per platform).
    if (cycle.payout_model === 'cpm') {
      for (const p of PLATFORMS) {
        if (rates[p] !== '' && rates[p] != null) {
          await fetch(`/api/cycles/${cycle.id}`, {
            method: 'PATCH', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'setCpm', platform: p, dollars: rates[p] }),
          });
        }
      }
    }
    setBusy(false);
    if (res.ok) { setMsg('✓ Saved — everything recalculated.'); router.refresh(); }
    else setMsg((await res.json().catch(() => ({}))).error || 'Save failed');
  }

  if (!open) return <button className="btn secondary" onClick={() => setOpen(true)}>⚙ Cycle settings</button>;

  return (
    <div className="card grid" style={{ gap: 12, maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0 }}>Cycle settings</h2>
        <span className="muted" style={{ marginLeft: 10, fontSize: 12.5 }}>every edit recalculates live &amp; is logged</span>
        <button className="btn secondary" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12.5 }} onClick={() => setOpen(false)}>Close</button>
      </div>

      <label className="grid" style={{ gap: 5 }}>
        <span className="muted" style={{ fontSize: 13 }}>Name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <label className="grid" style={{ gap: 5 }}><span className="muted" style={{ fontSize: 13 }}>Starts</span>
          <input className="field" type="date" value={startsOn} onChange={(e) => setStarts(e.target.value)} /></label>
        <label className="grid" style={{ gap: 5 }}><span className="muted" style={{ fontSize: 13 }}>Ends</span>
          <input className="field" type="date" value={endsOn} onChange={(e) => setEnds(e.target.value)} /></label>
        <label className="grid" style={{ gap: 5 }}><span className="muted" style={{ fontSize: 13 }}>{['pot_proportional', 'pot_equal'].includes(cycle.payout_model) ? 'Pot ($)' : 'Budget ($)'}</span>
          <input className="field" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
      </div>

      {cycle.payout_model === 'cpm' && (
        <div className="grid" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>CPM per platform ($ / 1,000 views)</span>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
            {PLATFORMS.map((p) => (
              <label key={p} className="grid" style={{ gap: 3 }}>
                <span className="muted" style={{ fontSize: 11.5, textTransform: 'capitalize' }}>{p}</span>
                <input className="field" inputMode="decimal" value={rates[p]} onChange={(e) => setRates({ ...rates, [p]: e.target.value })} />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label className="grid" style={{ gap: 5 }}><span className="muted" style={{ fontSize: 13 }}>Max per clip ($, blank = none)</span>
          <input className="field" inputMode="decimal" value={maxClip} onChange={(e) => setMaxClip(e.target.value)} /></label>
        <label className="grid" style={{ gap: 5 }}><span className="muted" style={{ fontSize: 13 }}>Max per clipper ($, blank = none)</span>
          <input className="field" inputMode="decimal" value={maxClipper} onChange={(e) => setMaxClipper(e.target.value)} /></label>
      </div>
      <label className="grid" style={{ gap: 5 }}>
        <span className="muted" style={{ fontSize: 13 }}>
          Max PAID views per clip (blank = none) — pays only up to this many views at each platform's CPM;
          extra views still count in stats, they just don't add money. Fair across platforms.
        </span>
        <input className="field" inputMode="numeric" placeholder="e.g. 700000" value={maxPaidViews} onChange={(e) => setMaxPaidViews(e.target.value)} style={{ maxWidth: 220 }} />
      </label>

      <div className="grid" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 13 }}>Automatic view checks — how many per day, and when (cycle timezone)</span>
        <ScheduleEditor value={checkSchedule} onChange={setCheckSchedule} />
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={minOn} onChange={(e) => setMinOn(e.target.checked)} /> Min views
        </label>
        {minOn && <input className="field" style={{ width: 110 }} inputMode="numeric" value={minFloor} onChange={(e) => setMinFloor(e.target.value)} />}
        <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={window_} onChange={(e) => setWindow(e.target.checked)} /> Flag posts outside dates
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="field" style={{ maxWidth: 230 }} value={hashtagMode} onChange={(e) => setHM(e.target.value)}>
          <option value="off">Hashtag: off</option>
          <option value="flag">Hashtag: flag missing</option>
          <option value="auto_reject">Hashtag: auto-reject missing</option>
        </select>
        {hashtagMode !== 'off' && (
          <input className="field" style={{ flex: 1, minWidth: 160 }} placeholder="#camy, #ryze" value={tags} onChange={(e) => setTags(e.target.value)} />
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('✓') ? 'var(--good)' : 'var(--crit)' }}>{msg}</span>}
      </div>
    </div>
  );
}
