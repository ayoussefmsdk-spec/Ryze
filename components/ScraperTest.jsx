'use client';

import { useState } from 'react';

const LABEL = { tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook' };
const COLOR = { ok: 'var(--good)', warn: 'var(--warn, #f6a64b)', fail: 'var(--crit)', skip: 'var(--text-3)' };
const WORD = { ok: 'working', warn: 'suspicious', fail: 'NOT working', skip: 'not tested' };
const nf = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US'));

/** "Test scrapers now" — live, read-only re-fetch of one known-good clip per
 *  paid platform, so "is Apify broken or is it just this post?" has an answer. */
export default function ScraperTest() {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true); setError(''); setData(null);
    try {
      const r = await fetch('/api/system/scraper-test', { method: 'POST' });
      const d = await r.json();
      if (!r.ok || !d.ok) setError(d.error || `Test failed (${r.status})`);
      else setData(d);
    } catch {
      setError('Lost the connection while testing — try again (each test can take up to a few minutes).');
    }
    setBusy(false);
  }

  return (
    <div className="card grid" style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Scraper self-test</h2>
        <button className="btn" style={{ marginLeft: 'auto' }} disabled={busy} onClick={run}>
          {busy ? 'Testing… (up to a few minutes)' : 'Test scrapers now'}
        </button>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Re-fetches ONE recent clip per platform (TikTok, Instagram, Facebook) live through the same scrapers your
        checks use — all three at the same time — and compares the fresh numbers with what's stored. Read-only:
        nothing in your data changes. Costs a few cents; usually done in under a minute.
      </p>
      {error && <div style={{ color: 'var(--crit)', fontSize: 13 }}>✗ {error}</div>}
      {data && !data.tokenSet && <div style={{ color: 'var(--crit)', fontSize: 13 }}>✗ APIFY_TOKEN is not set on the server — no paid scraper can work.</div>}
      {data?.results?.map((r) => (
        <div key={r.platform} className="grid" style={{ gap: 3, borderTop: '1px solid var(--line)', paddingTop: 9 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: COLOR[r.verdict] }} />
            <strong>{LABEL[r.platform]}</strong>
            <span style={{ color: COLOR[r.verdict], fontFamily: 'var(--mono)', fontSize: 13 }}>{WORD[r.verdict]}</span>
            {r.ms != null && <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{(r.ms / 1000).toFixed(1)}s</span>}
          </div>
          <div style={{ fontSize: 13, color: r.verdict === 'fail' ? 'var(--crit)' : 'var(--text-2)' }}>{r.why}</div>
          {r.clip && (
            <div className="muted" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
              <a href={r.clip.url} target="_blank" rel="noreferrer">{r.clip.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}</a>
              {' · '}stored {nf(r.clip.storedViews)} views
              {r.fresh && <> → fresh <b style={{ color: 'var(--text)' }}>{nf(r.fresh.views)}</b> views · {nf(r.fresh.likes)} likes · {nf(r.fresh.comments)} comments</>}
            </div>
          )}
        </div>
      ))}
      {data && <div className="muted" style={{ fontSize: 11.5 }}>Ran {new Date(data.ranAt).toLocaleString()}</div>}
    </div>
  );
}
