import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeScrape } from '../lib/scraperTest.mjs';

test('scraper self-test verdicts', () => {
  assert.equal(judgeScrape({ storedViews: 500, fresh: null }).verdict, 'fail');
  assert.equal(judgeScrape({ storedViews: 500, fresh: { views: 0 } }).verdict, 'warn');
  assert.equal(judgeScrape({ storedViews: 10000, fresh: { views: 5000 } }).verdict, 'warn');
  assert.equal(judgeScrape({ storedViews: 10000, fresh: { views: 9800 } }).verdict, 'ok');
  assert.equal(judgeScrape({ storedViews: 500, fresh: { views: 650 } }).verdict, 'ok');
});

test('Apify monthly hard limit becomes a plain instruction', async () => {
  const { friendlyApifyError } = await import('../lib/fetchers/apify-errors.mjs');
  const msg = friendlyApifyError('apify~facebook-posts-scraper', 403,
    '{"error":{"type":"platform-feature-disabled","message":"Monthly usage hard limit exceeded"}}');
  assert.match(msg, /MONTHLY USAGE LIMIT/);
  assert.match(msg, /Billing → Limits/);
});

test('facebook light read with likes but no plays counts as working', () => {
  const r = judgeScrape({ storedViews: 169, fresh: { views: 0, likes: 12, comments: 1 }, platform: 'facebook' });
  assert.equal(r.verdict, 'ok');
  // ...but a TikTok/IG 0-view read is still suspicious.
  assert.equal(judgeScrape({ storedViews: 169, fresh: { views: 0, likes: 12 }, platform: 'tiktok' }).verdict, 'warn');
});

test('known backup-only Facebook account goes straight to the posts scraper', async () => {
  const { scanFacebookPage } = await import('../lib/fetchers/facebook.mjs');
  const realFetch = globalThis.fetch;
  process.env.APIFY_TOKEN = 'test-token';
  const actors = [];
  globalThis.fetch = async (url) => {
    const actor = String(url).match(/acts\/([^/]+)\//)[1];
    actors.push(actor);
    if (actor.includes('reels')) return new Response(JSON.stringify([{ error: 'no_items', errorDescription: 'Empty or private data for provided input' }]), { status: 200 });
    return new Response(JSON.stringify([{ url: 'https://www.facebook.com/reel/4677240789261441', viewsCount: 169 }]), { status: 200 });
  };
  try {
    const remembered = await scanFacebookPage('61595456373129', 20, { preferPosts: true });
    assert.ok(actors[0].includes('posts'), 'first run is the posts scraper');
    assert.ok(!actors.some((a) => a.includes('reels')), 'no wasted reels attempts');
    assert.equal(remembered.via, 'posts');
    actors.length = 0;
    const fresh = await scanFacebookPage('61595456373129', 20);
    assert.equal(actors.filter((a) => a.includes('reels')).length, 4, 'without memory: 4 reels tries first');
    assert.equal(fresh.via, 'posts', 'reports which scraper worked so it can be remembered');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('views never go down on their own; real gaps are flagged, tiny wobbles are not', async () => {
  const { resolveViews } = await import('./normalize.mjs');
  assert.deepEqual(resolveViews({ fetched: 51000, floor: 50000 }), { views: 51000, lowRead: false, glitch: false });
  assert.deepEqual(resolveViews({ fetched: 20000, floor: 50000 }), { views: 50000, lowRead: true, glitch: true });
  assert.deepEqual(resolveViews({ fetched: 0, floor: 300 }), { views: 300, lowRead: true, glitch: true });
  assert.deepEqual(resolveViews({ fetched: 49990, floor: 50000 }), { views: 50000, lowRead: true, glitch: false }); // wobble
  assert.deepEqual(resolveViews({ fetched: 120, floor: 0 }), { views: 120, lowRead: false, glitch: false });       // first read
});
