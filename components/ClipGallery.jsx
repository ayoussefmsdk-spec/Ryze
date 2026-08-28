'use client';

import { useEffect, useMemo, useState } from 'react';
import ClipActions from './ClipActions.jsx';
import FlagControls from './FlagControls.jsx';
import { parseClip } from '../core/platform.mjs';

/** When a pasted link matches nothing in THIS list, ask the server where that
 *  video actually lives — any cycle, any clipper, or its deletion record. */
function LocateAnswer({ q }) {
  const [data, setData] = useState(null);
  const key = q.includes('/') ? parseClip(q.trim()).key : null;

  useEffect(() => {
    setData(null);
    if (!key) return undefined;
    let dead = false;
    fetch(`/api/clips/locate?url=${encodeURIComponent(q.trim())}`)
      .then((r) => r.json())
      .then((d) => { if (!dead) setData(d); })
      .catch(() => {});
    return () => { dead = true; };
  }, [key, q]);

  if (!key || !data?.ok) return null;
  if (!data.copies.length && !data.tombstones.length) {
    return <div className="muted" style={{ fontSize: 13 }}>🔍 This video isn&apos;t anywhere in the app — no copy in any cycle, never deleted. It can be added.</div>;
  }
  return (
    <div className="grid" style={{ gap: 5, border: '1px solid var(--honey)', borderRadius: 10, padding: '10px 13px', fontSize: 13 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--honey)', letterSpacing: '0.06em' }}>🔍 FOUND — here&apos;s where this exact video lives</div>
      {data.copies.map((c) => (
        <div key={c.clipId}>
          In <b>{c.campaign} · <a href={`/cycle/${c.cycleId}`}>{c.cycle}</a></b> under <b>{c.clipper}</b>
          <span className="muted"> — {c.status} · {Number(c.views).toLocaleString('en-US')} views</span>
          {' '}<a href={c.url} target="_blank" rel="noreferrer">open ↗</a>
        </div>
      ))}
      {data.tombstones.map((t, i) => (
        <div key={i}>
          Was <b style={{ color: 'var(--crit)' }}>deleted</b> from <b>{t.campaign} · <a href={`/cycle/${t.cycleId}`}>{t.cycle}</a></b>
          <span className="muted"> on {new Date(t.deletedAt).toLocaleDateString()} — re-adding it needs the explicit confirm.</span>
        </div>
      ))}
    </div>
  );
}

const PLAT = {
  youtube: { label: 'YouTube', glyph: '▶', color: '#f6524f' },
  tiktok: { label: 'TikTok', glyph: '♪', color: '#2ad4c8' },
  instagram: { label: 'Instagram', glyph: '◎', color: '#e1568f' },
  facebook: { label: 'Facebook', glyph: 'ⓕ', color: '#4c8bf5' },
  twitter: { label: 'X', glyph: '𝕏', color: '#9aa0aa' },
  other: { label: 'Other', glyph: '∙', color: '#9aa0aa' },
};
const STATUS_META = {
  approved: { label: 'LIVE', color: 'var(--good)' },
  pending: { label: 'REVIEW', color: 'var(--honey)' },
  rejected: { label: 'REJECTED', color: 'var(--text-3)' },
};
const nf = (n) => Number(n || 0).toLocaleString('en-US');
const nfc = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));
const money = (c) => `$${(Math.round(c) / 100).toFixed(2)}`;
const eng = (f) => (f == null ? '—' : `${(Number(f) * 100).toFixed(1)}%`);
// Robust ISO day: posted_at can arrive as a Date OBJECT (pg → RSC props), and
// String(Date) is "Mon Aug 25 2026…" — slicing that gave weekday garbage that
// silently broke the "Newest post" sort and the date filters.
const postDay = (c) => {
  const raw = c.posted_at || c.created_at;
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};
/** Per-post engagement, computed live from likes+comments when the stored value is missing. */
const engOf = (c) => {
  if (c.engagement != null) return Number(c.engagement);
  if ((c.likes != null || c.comments != null) && Number(c.views) > 0) {
    return (Number(c.likes || 0) + Number(c.comments || 0)) / Number(c.views);
  }
  return null;
};

/* ---------------- per-clip analytics chart (client SVG) ---------------- */

const SERIES = [
  { key: 'views', label: 'Views', color: 'var(--honey)' },
  { key: 'likes', label: 'Likes', color: 'var(--good)' },
  { key: 'comments', label: 'Comments', color: 'var(--violet)' },
];

function ClipChart({ history }) {
  const [range, setRange] = useState('30');
  const [on, setOn] = useState({ views: true, likes: true, comments: true });

  const pts = useMemo(() => {
    if (!history) return [];
    const cut = range === 'all' ? 0 : Date.now() - Number(range) * 86400000;
    return history.filter((h) => new Date(h.t).getTime() >= cut);
  }, [history, range]);

  if (!history) return <div className="muted" style={{ fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Loading history…</div>;
  if (pts.length < 2) return <div className="muted" style={{ fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Not enough checks in this window yet — history builds up as views get checked.</div>;

  const W = 640; const H = 200; const PAD = 8;
  const t0 = new Date(pts[0].t).getTime();
  const t1 = new Date(pts[pts.length - 1].t).getTime();
  const tSpan = Math.max(1, t1 - t0);
  const max = Math.max(1, ...pts.flatMap((p) => SERIES.filter((s) => on[s.key]).map((s) => Number(p[s.key] || 0))));
  const x = (t) => PAD + ((new Date(t).getTime() - t0) / tSpan) * (W - PAD * 2);
  const y = (v) => H - PAD - (Number(v || 0) / max) * (H - PAD * 2);

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {SERIES.map((s) => (
          <button key={s.key} onClick={() => setOn((o) => ({ ...o, [s.key]: !o[s.key] }))}
            className="btn secondary" style={{ padding: '3px 10px', fontSize: 12, opacity: on[s.key] ? 1 : 0.4 }}>
            <span style={{ color: s.color }}>●</span> {s.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
          {[['7', '7D'], ['30', '30D'], ['all', 'All']].map(([v, l]) => (
            <button key={v} onClick={() => setRange(v)} className="btn secondary"
              style={{ padding: '3px 10px', fontSize: 12, borderColor: range === v ? 'var(--honey)' : 'var(--line-2)', color: range === v ? 'var(--honey)' : 'var(--text-2)' }}>
              {l}
            </button>
          ))}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="clip stats over time">
        {SERIES.filter((s) => on[s.key]).map((s) => {
          const line = pts.map((p) => `${x(p.t).toFixed(1)},${y(p[s.key]).toFixed(1)}`).join(' ');
          return (
            <g key={s.key}>
              {s.key === 'views' && <polygon points={`${PAD},${H - PAD} ${line} ${x(pts[pts.length - 1].t).toFixed(1)},${H - PAD}`} fill={s.color} opacity="0.1" />}
              <polyline points={line} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            </g>
          );
        })}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--line-2)" strokeWidth="1" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }} className="muted">
        <span>{String(pts[0].t).slice(0, 10)}</span>
        <span>
          {SERIES.filter((s) => on[s.key]).map((s) => (
            <span key={s.key} style={{ marginLeft: 12 }}>
              <span style={{ color: s.color }}>●</span> {nfc(pts[pts.length - 1][s.key] ?? 0)}
            </span>
          ))}
        </span>
        <span>{String(pts[pts.length - 1].t).slice(0, 10)}</span>
      </div>
    </div>
  );
}

/* ---------------- the details modal (Overview | Analytics) ---------------- */

function ClipModal({ clip, payoutCents, canModerate, onClose }) {
  const [tab, setTab] = useState('overview');
  const [history, setHistory] = useState(null);
  const p = PLAT[clip.platform] || PLAT.other;
  const st = STATUS_META[clip.status] || STATUS_META.pending;

  useEffect(() => {
    let dead = false;
    fetch(`/api/clips/${clip.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!dead) setHistory(j?.history || []); })
      .catch(() => { if (!dead) setHistory([]); });
    return () => { dead = true; };
  }, [clip.id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const tiles = [
    ['👁 Views', nf(clip.views)],
    ['♥ Likes', clip.likes == null ? '—' : nf(clip.likes)],
    ['💬 Comments', clip.comments == null ? '—' : nf(clip.comments)],
    ['Engagement', eng(engOf(clip)), true],
  ];

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,6,4,0.78)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card grid"
        style={{ width: 'min(880px, 100%)', maxHeight: '92vh', overflowY: 'auto', gap: 0, padding: 0 }}>
        {/* Header + tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px 0' }}>
          <strong style={{ fontSize: 16 }}>Clip details</strong>
          <button onClick={onClose} className="btn secondary" style={{ marginLeft: 'auto', padding: '3px 11px', fontSize: 13, borderRadius: 999 }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '10px 18px 0', borderBottom: '1px solid var(--line)' }}>
          {[['overview', 'Overview'], ['analytics', 'Analytics']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: 'none', border: 0, cursor: 'pointer', padding: '8px 14px', fontSize: 14, fontWeight: 620,
              color: tab === k ? 'var(--text)' : 'var(--text-3)',
              borderBottom: tab === k ? '2px solid var(--honey)' : '2px solid transparent', marginBottom: -1,
            }}>{l}</button>
          ))}
        </div>

        {tab === 'overview' ? (
          <div className="modal-cols" style={{ display: 'grid', gap: 18, padding: 18 }}>
            <div>
              {clip.thumbnail_url
                ? <img src={clip.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line)' }} />
                : <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 12, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 44, color: p.color }}>{p.glyph}</div>}
            </div>
            <div className="grid" style={{ gap: 12, alignContent: 'start', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: p.color, fontSize: 15 }}>{p.glyph}</span>
                <strong style={{ fontSize: 15 }}>{clip.account_handle ? `@${clip.account_handle}` : clip.clipper_name}</strong>
                <span className="muted" style={{ fontSize: 13 }}>· {clip.clipper_name}</span>
                <a href={clip.url} target="_blank" rel="noopener noreferrer" className="btn secondary" style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: 12.5 }}>Open ↗</a>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {tiles.map(([k, v, accent]) => (
                  <div key={k} style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--surface-2)' }}>
                    <div className="eyebrow" style={{ letterSpacing: '0.07em', fontSize: 10.5 }}>{k}</div>
                    <div style={{ fontSize: 20, fontWeight: 720, marginTop: 3, fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--honey)' : 'var(--text)' }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                <span style={{ color: st.color, fontFamily: 'var(--mono)', fontSize: 12, border: `1px solid ${st.color}`, borderRadius: 999, padding: '2px 10px' }}>{st.label}</span>
                {payoutCents != null && clip.status === 'approved' && <span style={{ color: 'var(--honey)', fontWeight: 700 }}>{money(payoutCents)}</span>}
                <FlagControls clip={clip} />
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                Posted {postDay(clip)}{clip.last_checked_at ? ` · last check ${new Date(clip.last_checked_at).toLocaleString()}` : ' · not checked yet'}
              </div>

              {canModerate && (
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  <ClipActions clip={clip} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: 18 }}>
            <ClipChart history={history} />
          </div>
        )}
      </div>
      <style>{`
        .modal-cols { grid-template-columns: 1fr; }
        @media (min-width: 680px) { .modal-cols { grid-template-columns: 280px 1fr; } }
      `}</style>
    </div>
  );
}

/* ---------------- the gallery: filter bar + card grid ---------------- */

export default function ClipGallery({ clips, clipPayouts = {}, isPot = false, canModerate = true }) {
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('all');
  const [flaggedOnly, setFlagged] = useState(false);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('views');
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const out = clips.filter((c) => {
      if (platform !== 'all' && c.platform !== platform) return false;
      if (status !== 'all' && c.status !== status) return false;
      if (flaggedOnly && !(c.flags?.length > 0)) return false;
      const day = postDay(c);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (q.trim()) {
        // Pasting a clip LINK finds its exact copy — same video, any URL form,
        // whoever it belongs to. Anything else stays a plain text search.
        const qKey = q.includes('/') ? parseClip(q.trim()).key : null;
        if (qKey) {
          if (parseClip(c.url).key !== qKey) return false;
        } else {
          const needle = q.trim().toLowerCase();
          const hay = `${c.clipper_name} ${c.account_handle || ''} ${c.url} ${c.caption || ''}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
      }
      return true;
    });
    out.sort((a, b) => {
      if (sort === 'views') return Number(b.views) - Number(a.views);
      if (sort === 'engagement') return (engOf(b) || 0) - (engOf(a) || 0);
      return postDay(b).localeCompare(postDay(a)); // newest
    });
    return out;
  }, [clips, platform, status, flaggedOnly, q, from, to, sort]);

  const platforms = [...new Set(clips.map((c) => c.platform))];
  const open = openId ? clips.find((c) => c.id === openId) : null;

  return (
    <div className="grid" style={{ gap: 12 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="field" style={{ flex: 1, minWidth: 160, maxWidth: 260 }} placeholder="Search — or paste a clip link to find its exact copy" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field" style={{ width: 128 }} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All platforms</option>
          {platforms.map((p) => <option key={p} value={p}>{PLAT[p]?.label || p}</option>)}
        </select>
        <select className="field" style={{ width: 118 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="approved">Live</option>
          <option value="pending">In review</option>
          <option value="rejected">Rejected</option>
        </select>
        <input className="field" type="date" style={{ width: 140 }} title="posted from" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>→</span>
        <input className="field" type="date" style={{ width: 140 }} title="posted to" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="field" style={{ width: 140 }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="views">Most views</option>
          <option value="newest">Newest post</option>
          <option value="engagement">Best engagement</option>
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlagged(e.target.checked)} /> ⚑ flagged
        </label>
        <span className="muted" style={{ fontSize: 12.5, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
          {filtered.length}/{clips.length} clips
        </span>
      </div>

      {filtered.length === 0 && <div className="muted" style={{ fontSize: 14, padding: '10px 0' }}>No clips match these filters.</div>}
      {filtered.length === 0 && <LocateAnswer q={q} />}

      {/* Card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 12 }}>
        {filtered.map((c) => {
          const p = PLAT[c.platform] || PLAT.other;
          const st = STATUS_META[c.status] || STATUS_META.pending;
          return (
            <button key={c.id} onClick={() => setOpenId(c.id)} style={{
              background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left',
              color: 'inherit', font: 'inherit',
            }}>
              <div className="card clipcard" style={{ padding: 0, overflow: 'hidden', opacity: c.status === 'rejected' ? 0.5 : 1 }}>
                <div style={{ position: 'relative' }}>
                  {c.thumbnail_url
                    ? <img loading="lazy" src={c.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', aspectRatio: '3/4', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 34, color: p.color }}>{p.glyph}</div>}
                  <span style={{
                    position: 'absolute', top: 8, right: 8, fontFamily: 'var(--mono)', fontSize: 10,
                    letterSpacing: '0.08em', color: st.color, background: 'rgba(10,8,6,0.82)',
                    border: `1px solid ${st.color}`, borderRadius: 999, padding: '2px 8px',
                  }}>{st.label}</span>
                  {c.flags?.length > 0 && (
                    <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 11, background: 'rgba(10,8,6,0.82)', border: '1px solid var(--crit)', color: 'var(--crit)', borderRadius: 999, padding: '2px 7px' }}>
                      ⚑ {c.flags.length}
                    </span>
                  )}
                </div>
                <div style={{ padding: '9px 11px' }} className="grid">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 620, minWidth: 0 }}>
                    <span style={{ color: p.color, flexShrink: 0 }}>{p.glyph}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.account_handle ? `@${c.account_handle}` : c.clipper_name}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    <span>👁 {nfc(c.views)}</span>
                    {c.likes != null && <span>♥ {nfc(c.likes)}</span>}
                    {c.comments != null && <span>💬 {nfc(c.comments)}</span>}
                    <span style={{ color: engOf(c) != null ? 'var(--honey)' : 'var(--text-3)' }}>{eng(engOf(c))}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{postDay(c)}</div>
                  {!isPot && clipPayouts[c.id] != null && c.status === 'approved' && (
                    <div style={{ fontSize: 12.5, color: 'var(--honey)', fontWeight: 650 }}>{money(clipPayouts[c.id])}</div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <ClipModal
          clip={open}
          payoutCents={clipPayouts[open.id]}
          canModerate={canModerate}
          onClose={() => setOpenId(null)}
        />
      )}

      <style>{`
        .clipcard { transition: transform 0.14s, border-color 0.14s; }
        .clipcard:hover { transform: translateY(-2px); border-color: var(--honey-deep); }
      `}</style>
    </div>
  );
}
