'use client';

import { useState } from 'react';

const PLAT = {
  tiktok: { label: 'TikTok', glyph: '♪', color: '#2ad4c8' },
  youtube: { label: 'YouTube', glyph: '▶', color: '#f6524f' },
  instagram: { label: 'Instagram', glyph: '◎', color: '#e1568f' },
  twitter: { label: 'X', glyph: '𝕏', color: '#9aa0aa' },
  other: { label: 'Other', glyph: '∙', color: '#9aa0aa' },
};
const nf = (n) => Number(n || 0).toLocaleString('en-US');
const nfc = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));
const money = (c) => `$${(Math.round(c) / 100).toFixed(2)}`;
const STATUS = {
  approved: { label: 'live', color: 'var(--good)' },
  pending: { label: 'in review', color: 'var(--honey)' },
  rejected: { label: 'not accepted', color: 'var(--text-3)' },
};

/** Clipper-facing: one summary card per platform; tap to expand its clips. */
export default function PortalPlatforms({ clips, byPlatform, showMoney = true }) {
  const [open, setOpen] = useState(null);

  // Group their clips by platform (all statuses, so pending shows too).
  const groups = new Map();
  for (const c of clips) {
    if (!groups.has(c.platform)) groups.set(c.platform, []);
    groups.get(c.platform).push(c);
  }
  const platforms = [...groups.entries()].map(([platform, list]) => {
    const live = list.filter((c) => c.status === 'approved');
    return {
      platform,
      list,
      live: live.length,
      pending: list.filter((c) => c.status === 'pending').length,
      views: live.reduce((a, c) => a + Number(c.views), 0),
      payoutCents: byPlatform[platform]?.payoutCents ?? 0,
    };
  }).sort((a, b) => b.views - a.views);

  if (!platforms.length) return null;

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {platforms.map((g) => {
          const p = PLAT[g.platform] || PLAT.other;
          const isOpen = open === g.platform;
          return (
            <button key={g.platform} onClick={() => setOpen(isOpen ? null : g.platform)} style={{
              background: isOpen ? 'color-mix(in srgb, ' + p.color + ' 7%, var(--surface-2))' : 'var(--surface-2)',
              border: `1px solid ${isOpen ? p.color : 'var(--line-2)'}`,
              borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
              color: 'inherit', font: 'inherit', transition: 'border-color 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 650 }}>
                <span style={{ color: p.color }}>{p.glyph}</span> {p.label}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>{isOpen ? '▲' : '▼'}</span>
              </div>
              <div style={{ fontSize: 19, fontWeight: 720, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>{nf(g.views)} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-2)' }}>views</span></div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {g.live} clip{g.live === 1 ? '' : 's'} live{g.pending ? ` · ${g.pending} in review` : ''}
              </div>
              {showMoney && g.payoutCents > 0 && (
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--honey)', marginTop: 3 }}>{money(g.payoutCents)}</div>
              )}
            </button>
          );
        })}
      </div>

      {open && groups.has(open) && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          {groups.get(open).map((c) => {
            const p = PLAT[c.platform] || PLAT.other;
            const st = STATUS[c.status] || STATUS.pending;
            return (
              <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'none', opacity: c.status === 'rejected' ? 0.5 : 1 }}>
                <div style={{ border: '1px solid var(--line)', borderRadius: 11, overflow: 'hidden', background: 'var(--surface)' }}>
                  <div style={{ position: 'relative' }}>
                    {c.thumbnail_url
                      ? <img loading="lazy" src={c.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
                      : <div style={{ width: '100%', aspectRatio: '3/4', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontSize: 28, color: p.color }}>{p.glyph}</div>}
                    <span style={{
                      position: 'absolute', top: 6, right: 6, fontFamily: 'var(--mono)', fontSize: 9.5,
                      color: st.color, background: 'rgba(10,8,6,0.85)', border: `1px solid ${st.color}`,
                      borderRadius: 999, padding: '1px 7px',
                    }}>{st.label}</span>
                  </div>
                  <div style={{ padding: '7px 9px', fontSize: 11.5 }} className="muted">
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>👁 {nfc(c.views)}</span>
                    {c.likes != null && <span style={{ marginLeft: 7 }}>♥ {nfc(c.likes)}</span>}
                    {c.engagement != null && <span style={{ marginLeft: 7, color: 'var(--honey)' }}>{(Number(c.engagement) * 100).toFixed(1)}%</span>}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
