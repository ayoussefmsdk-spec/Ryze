import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.APIFY_RETRY_WAIT_MS = '1'; // no real waiting in tests

// Fake Apify API: start run -> poll (RUNNING once, then done) -> dataset items.
function fakeApify({ failChunk = -1, poison = null } = {}) {
  const runs = new Map();
  let started = 0;
  let live = 0;
  let maxLive = 0;
  const fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/runs?')) {
      const input = JSON.parse(init.body);
      const idx = started++;
      // A run containing the poison link always fails (permanently bad input).
      if (idx === failChunk || (poison && input.postURLs.includes(poison))) {
        return new Response('{"error":{"type":"x","message":"boom"}}', { status: 400 });
      }
      const id = `run${idx}`;
      live++; maxLive = Math.max(maxLive, live);
      runs.set(id, { input, polls: 0 });
      return new Response(JSON.stringify({ data: { id, status: 'READY', defaultDatasetId: `ds_${id}` } }), { status: 201 });
    }
    if (u.includes('/actor-runs/')) {
      const id = u.match(/actor-runs\/([^?]+)/)[1];
      const r = runs.get(id);
      r.polls++;
      await new Promise((ok) => setTimeout(ok, 20));
      const done = r.polls >= 2;
      if (done && !r.done) { r.done = true; live--; }
      return new Response(JSON.stringify({ data: { id, status: done ? 'SUCCEEDED' : 'RUNNING', defaultDatasetId: `ds_${id}` } }), { status: 200 });
    }
    if (u.includes('/datasets/')) {
      const id = u.match(/datasets\/ds_([^/]+)\//)[1];
      const { input } = runs.get(id);
      return new Response(JSON.stringify(input.postURLs.map((p, i) => ({
        webVideoUrl: p, playCount: 1000 + i, diggCount: 10, commentCount: 1, authorMeta: { name: 'acc' },
      }))), { status: 200 });
    }
    throw new Error(`unexpected ${u}`);
  };
  return { fetch, stats: () => ({ started, maxLive }) };
}

const urls = Array.from({ length: 250 }, (_, i) => `https://www.tiktok.com/@acc/video/${7400000000000000000n + BigInt(i)}`);

test('TikTok batch: 250 links -> 3 async runs, polled to completion, all stats back', async () => {
  const { fetchTikTokStats } = await import('../lib/fetchers/apify.mjs');
  const fake = fakeApify();
  const real = globalThis.fetch;
  process.env.APIFY_TOKEN = 't';
  globalThis.fetch = fake.fetch;
  try {
    const out = await fetchTikTokStats(urls);
    assert.equal(out.size, 250);
    assert.equal(fake.stats().started, 3);
    assert.ok(fake.stats().maxLive <= 4, 'at most 4 runs at once');
  } finally { globalThis.fetch = real; }
});

test('TikTok batch: a transient failure is retried and recovers everything', async () => {
  const { fetchTikTokStats } = await import('../lib/fetchers/apify.mjs');
  const fake = fakeApify({ failChunk: 1 }); // 2nd start attempt fails once
  const real = globalThis.fetch;
  process.env.APIFY_TOKEN = 't';
  globalThis.fetch = fake.fetch;
  try {
    const out = await fetchTikTokStats(urls);
    assert.equal(out.size, 250, 'retry recovered the failed chunk');
    assert.equal(out.unfetched.size, 0);
  } finally { globalThis.fetch = real; }
});

test('TikTok batch: one permanently bad link is isolated — the rest still come back', async () => {
  const { fetchTikTokStats } = await import('../lib/fetchers/apify.mjs');
  const poison = urls[137];
  const fake = fakeApify({ poison });
  const real = globalThis.fetch;
  process.env.APIFY_TOKEN = 't';
  globalThis.fetch = fake.fetch;
  try {
    const out = await fetchTikTokStats(urls);
    assert.ok(out.size >= 240, `got ${out.size} of 250 — splitting isolated the bad link`);
    assert.ok(out.unfetched.size >= 1 && out.unfetched.size <= 10, `unfetched narrowed to ${out.unfetched.size} links`);
    const { parseClip } = await import('./platform.mjs');
    assert.ok(out.unfetched.has(parseClip(poison).key), 'the bad link is reported as unfetched, not missing');
    assert.equal(out.size + out.unfetched.size, 250, 'every link is either fetched or reported');
  } finally { globalThis.fetch = real; }
});

test('TikTok batch: an account-level error (usage limit) fails fast without retries', async () => {
  const { fetchTikTokStats } = await import('../lib/fetchers/apify.mjs');
  let starts = 0;
  const real = globalThis.fetch;
  process.env.APIFY_TOKEN = 't';
  globalThis.fetch = async () => { starts++; return new Response('{"error":{"type":"platform-feature-disabled","message":"Monthly usage hard limit exceeded"}}', { status: 403 }); };
  try {
    await assert.rejects(() => fetchTikTokStats(urls), /MONTHLY USAGE LIMIT/);
    assert.equal(starts, 3, 'one attempt per chunk, no retries, no splitting');
  } finally { globalThis.fetch = real; }
});
