'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ClipActions from './ClipActions.jsx';
import FlagControls from './FlagControls.jsx';

const PLATFORM_ICON = { youtube: '▶', tiktok: '♪', instagram: '◎', facebook: 'ⓕ', twitter: '𝕏', other: '∙' };
const nf = (n) => Number(n || 0).toLocaleString('en-US');
const eng = (f) => (f == null ? '—' : `${(Number(f) * 100).toFixed(1)}%`);

/**
 * Pending-review queue with keyboard triage:
 * j/k move · a approve · r reject · o open the clip in a new tab.
 */
export default function TriageQueue({ clips, cycleId }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const rowRefs = useRef([]);

  const scanCount = clips.filter((c) => c.added_via === 'scan').length;

  async function deleteAll(scope) {
    if (busy) return;
    const n = scope === 'scan' ? scanCount : clips.length;
    const what = scope === 'scan' ? `all ${n} scan-found pending clips` : `ALL ${n} pending clips`;
    if (!window.confirm(
      `Delete ${what}?\n\nAlready-approved clips are untouched. Deleted ones are remembered — a re-scan won't bring them back (you can still re-add any by link).`,
    )) return;
    setBusy(true);
    await fetch(`/api/cycles/${cycleId}/pending`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope }),
    }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  const idx = Math.min(cursor, clips.length - 1);

  async function decide(clip, action) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/clips/${clip.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => {});
    setBusy(false);
    router.refresh(); // row leaves the queue on refresh; cursor clamps to the next one
  }

  useEffect(() => {
    function onKey(e) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const clip = clips[idx];
      if (!clip) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, clips.length - 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      else if (e.key === 'a') { e.preventDefault(); decide(clip, 'approve'); }
      else if (e.key === 'r') { e.preventDefault(); decide(clip, 'reject'); }
      else if (e.key === 'o') { e.preventDefault(); window.open(clip.url, '_blank', 'noopener'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clips, idx, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rowRefs.current[idx]?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  return (
    <div className="card grid" style={{ gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Pending review ({clips.length})</h2>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'var(--mono)' }}>
          <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>a</kbd> approve · <kbd>r</kbd> reject · <kbd>o</kbd> open
        </span>
      </div>
      {cycleId && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {scanCount > 0 && scanCount < clips.length && (
            <button className="btn secondary" disabled={busy} onClick={() => deleteAll('scan')}
              style={{ color: 'var(--crit)', fontSize: 12.5, padding: '4px 11px' }}
              title="Removes only the pending clips a scan brought in — hand-added and clipper-submitted ones stay.">
              🗑 Delete scan finds ({scanCount})
            </button>
          )}
          <button className="btn secondary" disabled={busy} onClick={() => deleteAll('all')}
            style={{ color: 'var(--crit)', fontSize: 12.5, padding: '4px 11px' }}
            title="Empties the whole pending queue. Approved clips are untouched; deleted ones are remembered so a re-scan won't re-add them.">
            🗑 Delete all pending ({clips.length})
          </button>
        </div>
      )}
      {clips.map((c, i) => (
        <div
          key={c.id}
          ref={(el) => { rowRefs.current[i] = el; }}
          onClick={() => setCursor(i)}
          style={{
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
            borderTop: '1px solid var(--line)', paddingTop: 10, paddingLeft: 8,
            borderLeft: i === idx ? '3px solid var(--honey)' : '3px solid transparent',
            background: i === idx ? 'color-mix(in srgb, var(--honey) 4%, transparent)' : 'none',
            borderRadius: i === idx ? 8 : 0,
            cursor: 'default',
            opacity: busy && i === idx ? 0.6 : 1,
          }}
        >
          {c.thumbnail_url && (
            <a href={c.url} target="_blank" rel="noreferrer" title="Open the clip" style={{ flexShrink: 0 }}>
              <img loading="lazy" src={c.thumbnail_url} alt="" style={{ width: 110, height: 147, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)', display: 'block' }} />
            </a>
          )}
          <div className="grid" style={{ gap: 3, flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <strong>{c.clipper_name}</strong>
              <span className="muted" style={{ fontSize: 13, textTransform: 'capitalize' }}>{PLATFORM_ICON[c.platform]} {c.platform}</span>
              {c.account_handle && <span className="muted" style={{ fontSize: 13 }}>@{c.account_handle}</span>}
              <FlagControls clip={c} />
            </div>
            <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, wordBreak: 'break-all' }}>{c.url}</a>
            <div className="muted" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              {nf(c.views)} views · {c.likes == null ? '—' : nf(c.likes)} likes · {c.comments == null ? '—' : nf(c.comments)} comments · {eng(c.engagement)}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {({ scan: '🔎 added by YOUR scan', submission: '📥 submitted by the clipper', manual: '✍️ added by you (by link)' })[c.added_via] || c.added_via}
              {' · '}{new Date(c.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <ClipActions clip={c} compact />
        </div>
      ))}
    </div>
  );
}
