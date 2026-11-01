import { test } from 'node:test';
import assert from 'node:assert/strict';

// Fake Apify API: start run -> poll (RUNNING once, then done) -> dataset items.
function fakeApify({ failChunk = -1 } = {}) {
  const runs = new Map();
  let started = 0;
  let live = 0;
  let maxLive = 0;
  const fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/runs?')) {
      const input = JSON.parse(init.body);
      const idx = started++;
      if (idx === failChunk) return new Response('{"error":{"type":"x","message":"boom"}}', { status: 400 });
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

test('TikTok batch: one failing chunk does not sink the others', async () => {
  const { fetchTikTokStats } = await import('../lib/fetchers/apify.mjs');
  const fake = fakeApify({ failChunk: 1 });
  const real = globalThis.fetch;
  process.env.APIFY_TOKEN = 't';
  globalThis.fetch = fake.fetch;
  try {
    const out = await fetchTikTokStats(urls);
    assert.equal(out.size, 150, 'the two healthy chunks (100 + 50) still come back');
  } finally { globalThis.fetch = real; }
});
