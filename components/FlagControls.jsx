'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FLAG_LABELS = {
  duplicate: ['duplicate', 'var(--warn, #f6a64b)'],
  repeat_from_past_cycle: ['recycled from a past cycle', 'var(--warn, #f6a64b)'],
  unknown_account: ['unknown account', 'var(--crit)'],
  outside_dates: ['posted outside cycle', 'var(--crit)'],
  missing_hashtag: ['missing hashtag', 'var(--crit)'],
  ig_suspect: ['IG views suspect — verify', 'var(--crit)'],
  removed: ['video removed?', 'var(--crit)'],
  view_drop: ['big view drop', 'var(--crit)'],
  fetch_failed: ['check failed', 'var(--text-3)'],
  engagement_suspect: ['engagement too low — bought views?', 'var(--crit)'],
  velocity_suspect: ['unnatural view spike', 'var(--crit)'],
  api_glitch: ['stats glitch — kept last good numbers (likely Apify, not the video)', 'var(--warn, #f6a64b)'],
  previously_deleted: ['was deleted from this cycle before — re-added', 'var(--crit)'],
};

/**
 * Interactive flag chips: ✕ dismisses a flag for good (it never auto-returns),
 * and outside_dates gets an extra "count as in-cycle" fix that moves the post
 * date to the nearest cycle edge.
 */
export default function FlagControls({ clip }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');

  if (!clip.flags?.length) return null;

  async function act(body, key) {
    setBusy(key);
    await fetch(`/api/clips/${clip.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
    setBusy('');
    router.refresh();
  }

  return (
    <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      {clip.flags.map((f) => {
        const [label, color] = FLAG_LABELS[f] || [f, 'var(--text-3)'];
        return (
          <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'var(--mono)', color, border: `1px solid ${color}`, borderRadius: 999, padding: '1px 4px 1px 8px', opacity: busy === f ? 0.5 : 0.95 }}>
            ⚑ {label}
            {f === 'unknown_account' && (
              <button
                title={`Link ${clip.account_handle ? '@' + clip.account_handle : 'this account'} to this clipper — future clips from it are trusted`}
                disabled={!!busy}
                onClick={async () => {
                  setBusy(f);
                  const res = await fetch(`/api/clips/${clip.id}`, {
                    method: 'PATCH', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ action: 'trustAccount' }),
                  }).catch(() => null);
                  if (res && !res.ok) alert((await res.json().catch(() => ({}))).error || 'Could not link the account');
                  setBusy('');
                  router.refresh();
                }}
                style={{ background: 'var(--surface-2)', border: `1px solid ${color}`, borderRadius: 999, color: 'var(--text)', cursor: 'pointer', fontSize: 10, padding: '0 7px', fontFamily: 'var(--mono)' }}>
                🔗 link account
              </button>
            )}
            {f === 'outside_dates' && (
              <button
                title="Count it as in-cycle — moves the post date to the nearest cycle edge; the flag stays gone"
                disabled={!!busy}
                onClick={() => act({ action: 'markInWindow' }, f)}
                style={{ background: 'var(--surface-2)', border: `1px solid ${color}`, borderRadius: 999, color: 'var(--text)', cursor: 'pointer', fontSize: 10, padding: '0 7px', fontFamily: 'var(--mono)' }}>
                📅 count it
              </button>
            )}
            <button
              title={f === 'api_glitch'
                ? 'Dismiss — the drop is real; future checks will trust fetched numbers again'
                : 'Dismiss this flag — it will NOT come back on future checks'}
              disabled={!!busy}
              onClick={() => act({ action: 'clearFlag', flag: f }, f)}
              style={{ background: 'none', border: 0, color, cursor: 'pointer', fontSize: 12, padding: '0 3px', lineHeight: 1 }}>
              ✕
            </button>
          </span>
        );
      })}
    </span>
  );
}
