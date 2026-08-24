'use client';

import { useMemo, useState } from 'react';
import ClipActions from './ClipActions.jsx';
import FlagBadges from './FlagBadges.jsx';
import { parseClip } from '../core/platform.mjs';

const PLATFORM_ICON = { youtube: '▶', tiktok: '♪', instagram: '◎', twitter: '𝕏', other: '∙' };
const nf = (n) => Number(n || 0).toLocaleString('en-US');
const eng = (f) => (f == null ? '—' : `${(Number(f) * 100).toFixed(1)}%`);
const money = (c) => `$${(Math.round(c) / 100).toFixed(2)}`;

/** Filterable, searchable clip list — grouped by clipper → platform. */
export default function ClipExplorer({ clips, clipPayouts = {}, isPot = false }) {
  const [platform, setPlatform] = useState('all');
  const [status, setStatus] = useState('all');
  const [flaggedOnly, setFlagged] = useState(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => clips.filter((c) => {
    if (platform !== 'all' && c.platform !== platform) return false;
    if (status !== 'all' && c.status !== status) return false;
    if (flaggedOnly && !(c.flags?.length > 0)) return false;
    if (q.trim()) {
      // A pasted clip link matches its exact copy (same video id, any URL form).
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
  }), [clips, platform, status, flaggedOnly, q]);

  const byClipper = useMemo(() => {
    const m = new Map();
    for (const c of filtered) {
      if (!m.has(c.clipper_id)) m.set(c.clipper_id, { name: c.clipper_name, platforms: new Map() });
      const g = m.get(c.clipper_id).platforms;
      if (!g.has(c.platform)) g.set(c.platform, []);
      g.get(c.platform).push(c);
    }
    return m;
  }, [filtered]);

  const platforms = [...new Set(clips.map((c) => c.platform))];

  return (
    <div className="grid" style={{ gap: 10 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="field" style={{ flex: 1, minWidth: 180, maxWidth: 300 }} placeholder="Search clipper, @handle, link…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field" style={{ width: 130 }} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All platforms</option>
          {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="field" style={{ width: 130 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13.5, whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlagged(e.target.checked)} /> ⚑ flagged only
        </label>
        <span className="muted" style={{ fontSize: 12.5, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
          {filtered.length}/{clips.length} clips
        </span>
      </div>

      {filtered.length === 0 && <div className="muted" style={{ fontSize: 14, padding: '8px 0' }}>No clips match these filters.</div>}

      {[...byClipper.entries()].map(([clipperId, g]) => (
        <details key={clipperId} open>
          <summary style={{ cursor: 'pointer', padding: '8px 0', fontWeight: 650, listStyle: 'none' }}>
            {g.name} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {[...g.platforms.values()].flat().length} clips</span>
          </summary>
          <div className="grid" style={{ gap: 6, paddingLeft: 10 }}>
            {[...g.platforms.entries()].map(([plat, platClips]) => (
              <details key={plat} open>
                <summary style={{ cursor: 'pointer', padding: '4px 0', fontSize: 14, color: 'var(--text-2)', listStyle: 'none', textTransform: 'capitalize' }}>
                  {PLATFORM_ICON[plat]} {plat} ({platClips.length})
                </summary>
                <div className="grid" style={{ gap: 10, padding: '4px 0 10px 14px' }}>
                  {platClips.map((c) => (
                    <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', opacity: c.status === 'rejected' ? 0.45 : 1 }}>
                      {c.thumbnail_url && <img loading="lazy" src={c.thumbnail_url} alt="" style={{ width: 40, height: 54, objectFit: 'cover', borderRadius: 6 }} />}
                      <div className="grid" style={{ gap: 2, flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 13.5 }}>
                          <a href={c.url} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
                            {c.account_handle ? `@${c.account_handle}` : c.url.slice(0, 46)}
                          </a>
                          <span className="muted" style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>{c.status}</span>
                          {c.manual_override && <span className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)', border: '1px solid var(--line-2)', borderRadius: 999, padding: '0 6px' }}>manual</span>}
                          <FlagBadges flags={c.flags} />
                        </div>
                        <div className="muted" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                          {nf(c.views)} views · {c.likes == null ? '—' : nf(c.likes)} likes · {c.comments == null ? '—' : nf(c.comments)} comments · {eng(c.engagement)}
                          {clipPayouts[c.id] != null && c.status === 'approved' && !isPot && (
                            <span style={{ color: 'var(--honey)' }}> · {money(clipPayouts[c.id])}</span>
                          )}
                          {c.last_checked_at && <span> · checked {new Date(c.last_checked_at).toLocaleString()}</span>}
                        </div>
                      </div>
                      <ClipActions clip={c} />
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
