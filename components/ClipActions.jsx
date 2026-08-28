'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClipActions({ clip, compact = false }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editingViews, setEditingViews] = useState(false);
  const [views, setViews] = useState(String(clip.views ?? 0));
  const [likes, setLikes] = useState(clip.likes == null ? '' : String(clip.likes));
  const [comments, setComments] = useState(clip.comments == null ? '' : String(clip.comments));
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  async function act(body) {
    setBusy(true);
    setErr('');
    setNote('');
    const res = await fetch(`/api/clips/${clip.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setErr(d.error || 'Failed');
    else if (body.action === 'recheck' && d.clip) {
      // A recheck must never be silent — and never claim the source "answered"
      // when the fetch actually FAILED (fetch_failed / removed flag came back).
      const nv = Number(d.clip.views);
      const ov = Number(clip.views);
      const failedFlag = (d.clip.flags || []).find((f) => f === 'fetch_failed' || f === 'removed');
      if (failedFlag && nv === ov) {
        setErr(failedFlag === 'removed'
          ? '✗ the source says this post doesn’t exist (anymore) — check the link.'
          : '✗ check FAILED — the source didn’t return this post. Numbers are unchanged, not confirmed.');
      } else {
        setNote(nv === ov
          ? `✓ checked — the source reported ${nv.toLocaleString('en-US')} views again (no change). If the real number is higher, the fetch source is under-reporting this post.`
          : `✓ updated: ${ov.toLocaleString('en-US')} → ${nv.toLocaleString('en-US')} views`);
      }
    }
    router.refresh();
  }

  async function del() {
    if (!window.confirm('Delete this clip entirely?')) return;
    setBusy(true);
    await fetch(`/api/clips/${clip.id}`, { method: 'DELETE' });
    setBusy(false);
    router.refresh();
  }

  const btn = { padding: '4px 10px', fontSize: 12.5 };

  return (
    <div className="grid" style={{ gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {clip.status === 'pending' && (
          <>
            <button className="btn" style={btn} disabled={busy} onClick={() => act({ action: 'approve' })}>Approve</button>
            <button className="btn secondary" style={btn} disabled={busy} onClick={() => act({ action: 'reject' })}>Reject</button>
          </>
        )}
        {clip.status === 'approved' && !compact && (
          <button className="btn secondary" style={btn} disabled={busy} onClick={() => act({ action: 'reject' })}>Un-approve</button>
        )}
        {clip.status === 'rejected' && (
          <button className="btn secondary" style={btn} disabled={busy} onClick={() => act({ action: 'approve' })}>Approve after all</button>
        )}
        {['tiktok', 'instagram', 'facebook', 'youtube'].includes(clip.platform) && (
          <button className="btn secondary" style={btn} disabled={busy} onClick={() => act({ action: 'recheck' })}>
            {busy ? '…' : 'Recheck'}
          </button>
        )}
        {clip.flags?.includes('unknown_account') && clip.account_handle && (
          <button className="btn secondary" style={{ ...btn, color: 'var(--good)' }} disabled={busy}
            title={`Link @${clip.account_handle} to this clipper and clear the flag`}
            onClick={() => act({ action: 'trustAccount' })}>
            ✓ Trust @{clip.account_handle}
          </button>
        )}
        {editingViews ? (
          <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="field" style={{ width: 96, padding: '4px 8px' }} inputMode="numeric" placeholder="views" title="views" value={views} onChange={(e) => setViews(e.target.value)} />
            <input className="field" style={{ width: 76, padding: '4px 8px' }} inputMode="numeric" placeholder="likes" title="likes (optional)" value={likes} onChange={(e) => setLikes(e.target.value)} />
            <input className="field" style={{ width: 86, padding: '4px 8px' }} inputMode="numeric" placeholder="comments" title="comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />
            <button className="btn" style={btn} disabled={busy} onClick={() => { act({ action: 'setViews', views: Number(views), likes, comments }); setEditingViews(false); }}>Save</button>
            <button className="btn secondary" style={btn} onClick={() => setEditingViews(false)}>×</button>
          </span>
        ) : (
          <button className="btn secondary" style={btn} onClick={() => setEditingViews(true)}>Set stats</button>
        )}
        <button className="btn secondary" style={{ ...btn, color: 'var(--crit)' }} disabled={busy} onClick={del}>Delete</button>
      </div>
      {err && <div style={{ color: 'var(--crit)', fontSize: 12.5 }}>{err}</div>}
      {note && <div style={{ color: 'var(--good)', fontSize: 12.5 }}>{note}</div>}
    </div>
  );
}
