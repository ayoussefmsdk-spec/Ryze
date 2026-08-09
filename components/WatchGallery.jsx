'use client';

import { useMemo, useState } from 'react';

// Read-only clip gallery for the streamer room: filters + thumbnails, no
// actions anywhere. Cards open the actual post in a new tab.
const PLAT = {
  youtube: { label: 'YouTube', glyph: '▶', color: '#f6524f' },
  tiktok: { label: 'TikTok', glyph: '♪', color: '#2ad4c8' },
  instagram: { label: 'Instagram', glyph: '◎', color: '#e1568f' },
  twitter: { label: 'X', glyph: '𝕏', color: '#9aa0aa' },
  other: { label: 'Other', glyph: '∙', color: '#9aa0aa' },
};
const nfc = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));
const eng = (c) => {
  if (c.engagement != null) return `${(Number(c.engagement) * 100).toFixed(1)}%`;
  if ((c.likes != null || c.comments != null) && Number(c.views) > 0) {
    return `${(((Number(c.likes || 0) + Number(c.comments || 0)) / Number(c.views)) * 100).toFixed(1)}%`;
  }
  return null;
};
const postDay = (c) => String(c.posted_at || c.created_at || '').slice(0, 10);

export default function WatchGallery({ clips }) {
  const [platform, setPlatform] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('views');

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
      if (sort === 'engagement') {
        const ea = c => { const e = eng(c); return e ? parseFloat(e) : -1; };
        return ea(b) - ea(a);
      }
      return postDay(b).localeCompare(postDay(a));
    });
    return out;
  }, [clips, platform, q, sort]);

  const platforms = [...new Set(clips.map((c) => c.platform))];

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
        {filtered.map((c, i) => {
          const p = PLAT[c.platform] || PLAT.other;
          const e = eng(c);
          return (
            <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="card watchcard" style={{ padding: 0, overflow: 'hidden', color: 'inherit', display: 'block' }}>
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
                  {e && <span style={{ color: 'var(--honey)' }}>{e}</span>}
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <style>{`
        .watchcard { transition: transform 0.14s, border-color 0.14s; }
        .watchcard:hover { transform: translateY(-2px); border-color: var(--honey-deep); text-decoration: none; }
      `}</style>
    </div>
  );
}
