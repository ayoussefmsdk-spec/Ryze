'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const PLAT_GLYPH = { youtube: '▶', tiktok: '♪', instagram: '◎', facebook: 'ⓕ', twitter: '𝕏', other: '∙' };
const SCANNABLE = new Set(['youtube', 'tiktok', 'instagram', 'facebook']);

export default function ScanPanel({ cycleId, members, accountsByClipper = {} }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clipperId, setClipperId] = useState('');
  const [perAccount, setPer] = useState('20');
  const [autoApprove, setAuto] = useState(false);
  const [hashtagMode, setHashtagMode] = useState('cycle'); // cycle | none | custom
  const [hashtags, setHashtags] = useState('');
  const [picked, setPicked] = useState(null); // null = all accounts; Set = manual selection
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const accounts = useMemo(
    () => (accountsByClipper[clipperId] || []).map((a) => ({ ...a, key: `${a.platform}:${a.handle}`, scannable: SCANNABLE.has(a.platform) })),
    [accountsByClipper, clipperId],
  );

  function pickClipper(id) {
    setClipperId(id);
    setPicked(null); // default back to "all accounts" for the new clipper
    setResult(null);
  }

  function toggleAccount(key) {
    const base = picked ?? new Set(accounts.filter((a) => a.scannable).map((a) => a.key));
    const next = new Set(base);
    if (next.has(key)) next.delete(key); else next.add(key);
    setPicked(next);
  }

  const selectedKeys = picked ?? new Set(accounts.filter((a) => a.scannable).map((a) => a.key));
  const n = Math.min(100, Math.max(1, Math.trunc(Number(perAccount)) || 20));

  async function scan() {
    if (!clipperId || selectedKeys.size === 0) return;
    setBusy(true);
    setResult(null);
    const allScannable = accounts.filter((a) => a.scannable).map((a) => a.key);
    const body = {
      clipperId,
      perAccount: n,
      autoApprove,
      hashtagMode,
      ...(hashtagMode === 'custom' ? { hashtags } : {}),
      // Only send the filter when it's an actual subset — "all" stays default.
      ...(selectedKeys.size < allScannable.length ? { onlyAccounts: [...selectedKeys] } : {}),
    };
    try {
      const r = await fetch(`/api/cycles/${cycleId}/scan`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      setResult(d);
      if (r.ok) router.refresh();
    } catch {
      // The request died in the browser (timeout / lost connection) but the
      // scan usually FINISHES on the server anyway — clips land in Pending.
      // Without this message the user re-scans and meets confusing
      // "already in" skips for posts "they never scanned".
      setResult({
        error: 'Lost the connection while scanning — but the scan most likely FINISHED on the server. '
          + 'Wait a minute, refresh the page and check Pending review before scanning again. '
          + '(Re-scanning is always safe: nothing is ever added twice — already-known posts just get a free stats refresh.)',
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) return <button className="btn secondary" onClick={() => setOpen(true)}>📡 Scan accounts</button>;

  const rej = result?.rejected || {};
  const rejParts = [
    rej.missing_hashtag ? `${rej.missing_hashtag} missing hashtag` : null,
    rej.outside_dates ? `${rej.outside_dates} outside dates` : null,
    rej.duplicate ? `${rej.duplicate} already in` : null,
    rej.deleted_before ? `${rej.deleted_before} deleted before` : null,
    rej.in_other_campaign ? `${rej.in_other_campaign} in another campaign` : null,
    rej.invalid ? `${rej.invalid} unreadable links` : null,
  ].filter(Boolean).join(' · ');
  // Accounts that filled their whole quota — older posts exist beyond the horizon.
  const atLimit = result?.ok && result.pulled
    ? Object.entries(result.pulled).filter(([, count]) => count >= (result.perAccount || 0)).map(([k]) => k)
    : [];

  return (
    <div className="card grid" style={{ gap: 12, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Scan a clipper's accounts</h2>
        <button className="btn secondary" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12.5 }} onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Pulls recent posts from the accounts you pick, keeps only the ones matching this cycle's
        hashtag &amp; dates, and refreshes the stats of clips already in — so a re-scan is also a free stats
        update. YouTube is free; TikTok/IG/Facebook cost fractions of a cent per post. Facebook is scan-only:
        its numbers update ONLY when you scan (e.g. once at month-end).
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="field" style={{ flex: 1, minWidth: 170 }} value={clipperId} onChange={(e) => pickClipper(e.target.value)}>
          <option value="">Pick a clipper…</option>
          {members.map((m) => <option key={m.clipper_id} value={m.clipper_id}>{m.name}</option>)}
        </select>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>last</span>
          <input className="field" style={{ width: 74, padding: '8px 10px' }} inputMode="numeric"
            value={perAccount} onChange={(e) => setPer(e.target.value)} title="posts per account (1–100)" />
          <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>posts</span>
        </span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {[10, 20, 50].map((v) => (
            <button key={v} className="btn secondary" onClick={() => setPer(String(v))}
              style={{ padding: '4px 9px', fontSize: 12, borderColor: n === v ? 'var(--honey)' : 'var(--line-2)', color: n === v ? 'var(--honey)' : 'var(--text-2)' }}>
              {v}
            </button>
          ))}
        </span>
      </div>

      {/* Per-account picker */}
      {clipperId && (
        accounts.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>This clipper has no linked accounts — add their @handles on the Clippers page first.</div>
        ) : (
          <div className="grid" style={{ gap: 6 }}>
            <div className="eyebrow" style={{ letterSpacing: '0.08em' }}>Which accounts to scan</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {accounts.map((a) => (
                <label key={a.key} title={a.scannable ? `${a.platform} — scannable` : `${a.platform} — manual only, can't be scanned`}
                  style={{
                    display: 'inline-flex', gap: 7, alignItems: 'center', fontSize: 13,
                    border: `1px solid ${selectedKeys.has(a.key) ? 'var(--honey)' : 'var(--line-2)'}`,
                    borderRadius: 999, padding: '5px 12px', cursor: a.scannable ? 'pointer' : 'not-allowed',
                    opacity: a.scannable ? 1 : 0.45,
                    background: selectedKeys.has(a.key) ? 'var(--honey-soft)' : 'transparent',
                  }}>
                  <input type="checkbox" style={{ display: 'none' }} disabled={!a.scannable}
                    checked={selectedKeys.has(a.key)} onChange={() => toggleAccount(a.key)} />
                  <span>{PLAT_GLYPH[a.platform]}</span>
                  <span>@{a.handle}</span>
                  {selectedKeys.has(a.key) && <span style={{ color: 'var(--honey)' }}>✓</span>}
                </label>
              ))}
            </div>
            {selectedKeys.size === 0 && <div style={{ color: 'var(--crit)', fontSize: 12.5 }}>Pick at least one account.</div>}
          </div>
        )
      )}

      {/* Scan-only hashtag rule — doesn't change the cycle's setting */}
      <div className="grid" style={{ gap: 6 }}>
        <div className="eyebrow" style={{ letterSpacing: '0.08em' }}>Hashtag rule for this scan</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="field" style={{ width: 230, padding: '7px 10px', fontSize: 13 }} value={hashtagMode} onChange={(e) => setHashtagMode(e.target.value)}>
            <option value="cycle">Use the cycle's hashtag rule</option>
            <option value="none">No hashtag needed — take everything</option>
            <option value="custom">Custom hashtag for this scan…</option>
          </select>
          {hashtagMode === 'custom' && (
            <input className="field" style={{ flex: 1, minWidth: 160, padding: '7px 10px', fontSize: 13 }}
              placeholder="#camy (several: comma-separated)" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
          )}
        </div>
      </div>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
        <input type="checkbox" checked={autoApprove} onChange={(e) => setAuto(e.target.checked)} />
        Auto-approve matches (they already passed hashtag + date + own-account checks)
      </label>
      <button className="btn" onClick={scan} disabled={busy || !clipperId || selectedKeys.size === 0}>
        {busy ? 'Scanning… (can take up to a minute)' : `Scan ${selectedKeys.size || ''} account${selectedKeys.size === 1 ? '' : 's'} · last ${n} posts`}
      </button>
      {result && (
        <div style={{ fontSize: 13.5, color: result.ok ? 'var(--text)' : 'var(--crit)' }}>
          {result.ok
            ? <>✓ Scanned {result.scanned} posts → <b style={{ color: 'var(--honey)' }}>{result.accepted} added</b>{result.refreshed ? <> · <b style={{ color: 'var(--good)' }}>{result.refreshed} stats refreshed</b></> : ''}{rejParts ? ` (skipped: ${rejParts})` : ''} · scan cost ≈ ${(result.costCents / 100).toFixed(2)}</>
            : `✗ ${result.error}`}
        </div>
      )}

      {/* Per-account problems — a missed clip should never be a mystery */}
      {result?.ok && result.issues?.length > 0 && (
        <div className="grid" style={{ gap: 4, border: '1px solid var(--warn, #f6a64b)', borderRadius: 10, padding: '9px 12px' }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--warn, #f6a64b)', letterSpacing: '0.06em' }}>⚠ NOT FULLY SCANNED</div>
          {result.issues.map((it, i) => (
            <div key={i} style={{ fontSize: 12.5 }}>
              <span style={{ fontFamily: 'var(--mono)' }}>{it.account}</span>
              <span className="muted"> — {it.note}</span>
            </div>
          ))}
        </div>
      )}
      {atLimit.length > 0 && (
        <div className="muted" style={{ fontSize: 12 }}>
          ℹ {atLimit.map((k) => k.split(':')[1] && `@${k.split(':')[1]}`).filter(Boolean).join(', ')} filled the whole
          “last {result.perAccount}” quota — an older clip could sit beyond that. If one is missing, raise the post
          count and rescan, or add it by link.
        </div>
      )}

      {/* Skipped posts — rescue any of them individually */}
      {result?.ok && result.skippedTotal > (result.skipped?.length || 0) && (
        <div className="muted" style={{ fontSize: 12 }}>
          ℹ Showing the first {result.skipped.length} of {result.skippedTotal} skipped posts — the “+ all”
          buttons cover only what's listed. Rescue these, then re-scan to get the next batch.
        </div>
      )}
      {result?.ok && result.skipped?.length > 0 && (
        <SkippedList
          skipped={result.skipped}
          skippedTotal={result.skippedTotal}
          cycleId={cycleId}
          clipperId={clipperId}
          autoApprove={autoApprove}
          onAdded={() => router.refresh()}
        />
      )}
    </div>
  );
}

const REASON_META = {
  duplicate: { label: 'already in', color: 'var(--warn, #f6a64b)' },
  outside_dates: { label: 'outside dates', color: 'var(--crit)' },
  missing_hashtag: { label: 'missing hashtag', color: 'var(--crit)' },
  deleted_before: { label: 'you deleted this', color: '#64b5f6' },
  in_other_campaign: { label: 'other campaign', color: 'var(--violet, #a78bfa)' },
};
const nfc = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));

function SkippedList({ skipped, skippedTotal, cycleId, clipperId, autoApprove, onAdded }) {
  const [added, setAdded] = useState({});   // url -> 'busy' | 'done' | 'error'
  const [batchErr, setBatchErr] = useState('');

  async function addOne(c) {
    setAdded((m) => ({ ...m, [c.url]: 'busy' }));
    const r = await fetch(`/api/cycles/${cycleId}/scan`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'addSkipped', clipperId, candidate: c, autoApprove }),
    });
    setAdded((m) => ({ ...m, [c.url]: r.ok ? 'done' : 'error' }));
    if (r.ok) onAdded();
  }

  // Bulk rescue in ONE request — a wide scan can skip hundreds; per-clip
  // requests took forever and made the browser the bottleneck.
  async function addAll(reason) {
    const todo = skipped.filter((c) => c.reason === reason && !added[c.url]);
    if (!todo.length) return;
    setBatchErr('');
    setAdded((m) => ({ ...m, ...Object.fromEntries(todo.map((c) => [c.url, 'busy'])) }));
    let d = null;
    try {
      const r = await fetch(`/api/cycles/${cycleId}/scan`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'addSkippedBatch', clipperId, candidates: todo, autoApprove }),
      });
      if (r.ok) d = await r.json();
    } catch { /* transport failure — handled below as unknown outcome */ }
    if (!d || !d.ok || !Array.isArray(d.failed)) {
      // UNKNOWN outcome (timeout, dropped connection, bad response). Never
      // invent per-clip results from transport state: clear the rows back to
      // retryable and say so. Retrying is safe — the server skips posts that
      // are already in instead of duplicating them.
      setAdded((m) => {
        const next = { ...m };
        for (const c of todo) delete next[c.url];
        return next;
      });
      setBatchErr('Lost the connection mid-add — some may have made it in anyway. Clicking again is SAFE: posts already in the cycle are skipped, never duplicated.');
      onAdded();
      return;
    }
    const failedSet = new Set(d.failed);
    setAdded((m) => ({
      ...m,
      ...Object.fromEntries(todo.map((c) => [c.url, failedSet.has(c.url) ? 'error' : 'done'])),
    }));
    if (failedSet.size) setBatchErr(`${failedSet.size} of ${todo.length} couldn't be added — their rows show "failed".`);
    onAdded();
  }

  // Posts already tracked under ANOTHER client's campaign, and posts the
  // manager DELETED from this cycle before, each get their own section —
  // neither is a "new find", and mixing them with real already-ins is how
  // "wait, where did my clips go" confusion starts.
  const elsewhere = skipped.filter((c) => c.reason === 'in_other_campaign');
  const deletedBefore = skipped.filter((c) => c.reason === 'deleted_before');
  const regular = skipped.filter((c) => c.reason !== 'in_other_campaign' && c.reason !== 'deleted_before');
  const reasons = [...new Set(regular.map((c) => c.reason))];

  const row = (c, i) => {
    const meta = REASON_META[c.reason] || { label: c.reason, color: 'var(--text-3)' };
    const state = added[c.url];
    return (
      <div key={c.url} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '7px 2px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 13, flexWrap: 'wrap' }}>
        {c.thumbnailUrl && <img loading="lazy" src={c.thumbnailUrl} alt="" style={{ width: 34, height: 45, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: meta.color, border: `1px solid ${meta.color}`, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' }}>{meta.label}</span>
        <a href={c.url} target="_blank" rel="noreferrer" style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.accountHandle ? `@${c.accountHandle}` : c.url.replace(/^https?:\/\/(www\.)?/, '')}
        </a>
        {c.elsewhere && <span style={{ fontSize: 12, color: 'var(--violet, #a78bfa)' }}>in {c.elsewhere}</span>}
        {c.postedAt && <span className="muted" style={{ fontSize: 12 }}>{String(c.postedAt).slice(0, 10)}</span>}
        <span className="muted" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>👁 {nfc(c.views)}</span>
        <span style={{ marginLeft: 'auto' }}>
          {state === 'done'
            ? <span style={{ color: 'var(--good)', fontSize: 12.5 }}>added ✓</span>
            : state === 'error'
              ? <span style={{ color: 'var(--crit)', fontSize: 12.5 }}>failed</span>
              : <button className="btn secondary" style={{ padding: '3px 11px', fontSize: 12 }} disabled={state === 'busy'} onClick={() => addOne(c)}>
                  {state === 'busy' ? '…' : '+ Add'}
                </button>}
        </span>
      </div>
    );
  };

  return (
    <div className="grid" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      {regular.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ letterSpacing: '0.08em' }}>Skipped — add any of them anyway</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
              {reasons.map((r) => (
                <button key={r} className="btn secondary" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => addAll(r)}>
                  + all {REASON_META[r]?.label || r}
                </button>
              ))}
            </span>
          </div>
          <div className="grid" style={{ gap: 2, maxHeight: 340, overflowY: 'auto' }}>
            {regular.map(row)}
          </div>
        </>
      )}
      {deletedBefore.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: regular.length ? 6 : 0 }}>
            <span className="eyebrow" style={{ letterSpacing: '0.08em', color: '#64b5f6' }}>
              Deleted from this cycle before ({deletedBefore.length}) — bring any back
            </span>
            <button className="btn secondary" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 12 }} onClick={() => addAll('deleted_before')}>
              + bring ALL back
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            These are posts YOU removed from this cycle (e.g. with “Delete all pending”). Re-scans remember
            the deletion and never re-add them on their own — bring back the ones you actually want.
          </div>
          <div className="grid" style={{ gap: 2, maxHeight: 240, overflowY: 'auto' }}>
            {deletedBefore.map(row)}
          </div>
        </>
      )}
      {elsewhere.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: regular.length ? 6 : 0 }}>
            <span className="eyebrow" style={{ letterSpacing: '0.08em', color: 'var(--violet, #a78bfa)' }}>
              Already tracked for another client ({elsewhere.length})
            </span>
            <button className="btn secondary" style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: 12 }} onClick={() => addAll('in_other_campaign')}>
              + all anyway
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            These posts already live in a different campaign — the same clipper reusing work across clients.
            They were NOT added here. Add one only if it genuinely counts for both.
          </div>
          <div className="grid" style={{ gap: 2, maxHeight: 240, overflowY: 'auto' }}>
            {elsewhere.map(row)}
          </div>
        </>
      )}
      {batchErr && <div style={{ fontSize: 12.5, color: 'var(--warn, #f6a64b)' }}>⚠ {batchErr}</div>}
      <div className="muted" style={{ fontSize: 11.5 }}>
        Added clips keep their skip reason as a flag so you remember why they were held. No extra API cost — the scan's numbers are reused.
      </div>
    </div>
  );
}
