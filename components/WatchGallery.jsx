'use client';

import { useEffect, useMemo, useState } from 'react';

// Read-only clip gallery for the streamer room: filters + thumbnails, no
// actions. Tapping a card opens a stats modal (Overview | Analytics).
const PLAT = {
  youtube: { label: 'YouTube', glyph: '▶', color: '#f6524f' },
  tiktok: { label: 'TikTok', glyph: '♪', color: '#2ad4c8' },
  instagram: { label: 'Instagram', glyph: '◎', color: '#e1568f' },
  twitter: { label: 'X', glyph: '𝕏', color: '#9aa0aa' },
  other: { label: 'Other', glyph: '∙', color: '#9aa0aa' },
};
const nf = (n) => Number(n || 0).toLocaleString('en-US');
const nfc = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));
const engOf = (c) => {
  if (c.engagement != null) return Number(c.engagement);
  if ((c.likes != null || c.comments != null) && Number(c.views) > 0) {
    return (Number(c.likes || 0) + Number(c.comments || 0)) / Number(c.views);
  }
  return null;
};
const engFmt = (c) => { const e = engOf(c); return e == null ? '—' : `${(e * 100).toFixed(1)}%`; };
const postDay = (c) => String(c.posted_at || c.created_at || '').slice(0, 10);

/* ---- analytics chart (same look as the manager's) ---- */
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
  if (pts.length < 2) return <div className="muted" style={{ fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Not enough checks in this window yet.</div>;

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

/* ---- read-only clip modal ---- */
function WatchModal({ clip, code, onClose }) {
  const [tab, setTab] = useState('overview');
  const [history, setHistory] = useState(null);
  const p = PLAT[clip.platform] || PLAT.other;

  useEffect(() => {
    let dead = false;
    fetch(`/api/watch/${code}/clip/${clip.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!dead) setHistory(j?.history || []); })
      .catch(() => { if (!dead) setHistory([]); });
    return () => { dead = true; };
  }, [clip.id, code]);

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
    ['Engagement', engFmt(clip), true],
  ];

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8,6,4,0.78)', backdropFilter: 'blur(4px)',
      display: 'grid', placeItems: 'center', padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="card grid"
        style={{ width: 'min(860px, 100%)', maxHeight: '92vh', overflowY: 'auto', gap: 0, padding: 0 }}>
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
          <div className="wmodal-cols" style={{ display: 'grid', gap: 18, padding: 18 }}>
            <div>
              {clip.thumbnail_url
                ? <img src={clip.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line)' }} />
                : <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 12, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 44, color: p.color }}>{p.glyph}</div>}
            </div>
            <div className="grid" style={{ gap: 12, alignContent: 'start', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: p.color, fontSize: 15 }}>{p.glyph}</span>
                <strong style={{ fontSize: 15 }}>{clip.account_handle ? `@${clip.account_handle}` : clip.clipper_name}</strong>
                <a href={clip.url} target="_blank" rel="noopener noreferrer" className="btn secondary" style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: 12.5 }}>Watch ↗</a>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {tiles.map(([k, v, accent]) => (
                  <div key={k} style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--surface-2)' }}>
                    <div className="eyebrow" style={{ letterSpacing: '0.07em', fontSize: 10.5 }}>{k}</div>
                    <div style={{ fontSize: 20, fontWeight: 720, marginTop: 3, fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--honey)' : 'var(--text)' }}>{v}</div>
                  </div>
                ))}
              </div>
              {clip.caption && <div className="muted" style={{ fontSize: 12.5 }}>{clip.caption}</div>}
              <div className="muted" style={{ fontSize: 12.5 }}>Posted {postDay(clip)}</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 18 }}>
            <ClipChart history={history} />
          </div>
        )}
      </div>
      <style>{`
        .wmodal-cols { grid-template-columns: 1fr; }
        @media (min-width: 680px) { .wmodal-cols { grid-template-columns: 280px 1fr; } }
      `}</style>
    </div>
  );
}

/* ---- gallery ---- */
export default function WatchGallery({ clips, code }) {
  const [platform, setPlatform] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('views');
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const out = clips.filter((c) => {
      if (platform !== 'all' && c.platform !== platform) return false;
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        const hay = `${c.account_handle || ''} ${c.clipper_name || ''} ${c.caption || ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      if (sort === 'views') return Number(b.views) - Number(a.views);
      if (sort === 'engagement') return (engOf(b) ?? -1) - (engOf(a) ?? -1);
      return postDay(b).localeCompare(postDay(a));
    });
    return out;
  }, [clips, platform, q, sort]);

  const platforms = [...new Set(clips.map((c) => c.platform))];
  const open = openId ? clips.find((c) => c.id === openId) : null;

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>The clips</h2>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field" style={{ width: 190, padding: '7px 11px', fontSize: 13.5 }} placeholder="Search @account…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="field" style={{ width: 130, padding: '7px 11px', fontSize: 13.5 }} value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="all">All platforms</option>
            {platforms.map((p) => <option key={p} value={p}>{PLAT[p]?.label || p}</option>)}
          </select>
          <select className="field" style={{ width: 150, padding: '7px 11px', fontSize: 13.5 }} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="views">Most views</option>
            <option value="newest">Newest</option>
            <option value="engagement">Best engagement</option>
          </select>
          <span className="muted" style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{filtered.length}/{clips.length}</span>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))', gap: 12 }}>
        {filtered.map((c) => {
          const p = PLAT[c.platform] || PLAT.other;
          return (
            <button key={c.id} onClick={() => setOpenId(c.id)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit' }}>
              <div className="card watchcard" style={{ padding: 0, overflow: 'hidden' }}>
                {c.thumbnail_url
                  ? <img loading="lazy" src={c.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', aspectRatio: '3/4', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 34, color: p.color }}>{p.glyph}</div>}
                <div style={{ padding: '9px 11px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 620, display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                    <span style={{ color: p.color, flexShrink: 0 }}>{p.glyph}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.account_handle ? `@${c.account_handle}` : c.clipper_name}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                    <span>👁 {nfc(c.views)}</span>
                    {c.likes != null && <span>♥ {nfc(c.likes)}</span>}
                    {engOf(c) != null && <span style={{ color: 'var(--honey)' }}>{engFmt(c)}</span>}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {open && <WatchModal clip={open} code={code} onClose={() => setOpenId(null)} />}

      <style>{`
        .watchcard { transition: transform 0.14s, border-color 0.14s; }
        .watchcard:hover { transform: translateY(-2px); border-color: var(--honey-deep); }
      `}</style>
    </div>
  );
}
