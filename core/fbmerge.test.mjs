// The exact scenario from production: the direct posts actor returns a reel
// with likes/comments but NO play count, then the page reels feed returns the
// same reel with plays but no likes. The two reads must merge into one
// complete stat line — the plays must never be discarded because the key
// "already exists".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeStats, fbItemUrl } from '../lib/fetchers/facebook.mjs';
import { normalizeFacebook } from './normalize.mjs';

test('facebook normalizer digs the thumbnail out of nested attachments', () => {
  // Real reels-feed items have NO flat thumbnail field — the image lives in
  // attachments[0] (media/image/uri style nesting varies per actor version).
  const img = 'https://scontent.xx.fbcdn.net/v/t15.5256-10/abc_123.jpg?stp=dst-jpg&_nc_cat=1';
  const nested = normalizeFacebook({
    shareable_url: 'https://www.facebook.com/reel/2347015899384936',
    playCountRounded: 63000,
    attachments: [{ media: { image: { uri: img }, video_url: 'https://video.fbcdn.net/v/x.mp4' } }],
  });
  assert.equal(nested.thumbnailUrl, img);
  assert.equal(nested.views, 63000);
  // A video file URL must never be picked as the "image".
  const videoOnly = normalizeFacebook({ attachments: [{ media: { video_url: 'https://video.fbcdn.net/v/x.mp4' } }] });
  assert.equal(videoOnly.thumbnailUrl, null);
  // full_picture (classic posts shape) works as a flat fallback.
  assert.equal(normalizeFacebook({ full_picture: img }).thumbnailUrl, img);
});

test('mergeStats combines a likes-only direct read with a plays-only feed read', (t) => {
  const direct = { views: 0, likes: 6203, comments: 37, postedAt: '2026-08-22T10:00:00.000Z', accountHandle: null };
  const feed = { views: 63000, likes: null, comments: null, postedAt: null, accountHandle: '61590459089254' };
  for (const merged of [mergeStats(direct, feed), mergeStats(feed, direct)]) {
    assert.equal(merged.views, 63000);
    assert.equal(merged.likes, 6203);
    assert.equal(merged.comments, 37);
    assert.equal(merged.postedAt, '2026-08-22T10:00:00.000Z');
    assert.equal(merged.accountHandle, '61590459089254');
  }
});

test('mergeStats keeps the higher view count from repeated reads', () => {
  const a = { views: 63000, likes: 100 };
  const b = { views: 65000, likes: null };
  assert.equal(mergeStats(a, b).views, 65000);
  assert.equal(mergeStats(a, b).likes, 100);
});

test('fbItemUrl prefers the real post URL over the profile inputUrl', () => {
  // Reels-feed items report the PROFILE url as inputUrl — that must lose.
  assert.equal(
    fbItemUrl({
      inputUrl: 'https://www.facebook.com/profile.php?id=61590459089254',
      shareable_url: 'https://www.facebook.com/reel/3170672053141859',
    }),
    'https://www.facebook.com/reel/3170672053141859',
  );
  assert.equal(
    fbItemUrl({ inputUrl: 'https://www.facebook.com/profile.php?id=1', topLevelReelUrl: 'https://facebook.com/reel/2347015899384936/' }),
    'https://facebook.com/reel/2347015899384936/',
  );
  // Direct-post items: construct from facebookId when no shareable_url.
  assert.equal(
    fbItemUrl({ facebookId: '3170672053141859', facebookUrl: 'https://www.facebook.com/reel/3170672053141859' }),
    'https://www.facebook.com/reel/3170672053141859',
  );
});

test('share-link clips get the actor answer via inputUrl, with the real URL attached', async () => {
  const { fetchFacebookStats } = await import('../lib/fetchers/facebook.mjs');
  const realFetch = globalThis.fetch;
  process.env.APIFY_TOKEN = 'test-token';
  globalThis.fetch = async () => new Response(JSON.stringify([{
    inputUrl: 'https://www.facebook.com/share/r/1EzjhaEV4t/',
    facebookUrl: 'https://www.facebook.com/reel/1234567890123',
    facebookId: '1234567890123',
    playCountRounded: 4200, likes: 310, total_comment_count: 12,
  }]), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const out = await fetchFacebookStats([{ url: 'https://www.facebook.com/share/r/1EzjhaEV4t', handle: null }]);
    const s = out.get('facebook:share:1ezjhaev4t');
    assert.ok(s, 'share key must be answered');
    assert.equal(s.views, 4200);
    assert.equal(s.likes, 310);
    assert.equal(s.resolvedUrl, 'https://www.facebook.com/reel/1234567890123');
    assert.ok(out.get('facebook:1234567890123'), 'real key present too');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('resolveFbShareUrl follows redirects (incl. login-wall ?next=) to the real reel', async () => {
  const { resolveFbShareUrl } = await import('../lib/fetchers/facebook.mjs');
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'https://www.facebook.com/reel/987654321012/?mibextid=abc' } });
    assert.equal(await resolveFbShareUrl('https://www.facebook.com/share/r/XyZ123'), 'https://www.facebook.com/reel/987654321012');

    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'https://www.facebook.com/login/?next=https%3A%2F%2Fwww.facebook.com%2Freel%2F555666777888%2F' } });
    assert.equal(await resolveFbShareUrl('https://www.facebook.com/share/r/XyZ123'), 'https://www.facebook.com/reel/555666777888');

    globalThis.fetch = async () => { throw new Error('network down'); };
    assert.equal(await resolveFbShareUrl('https://www.facebook.com/share/r/XyZ123'), null);
    // Non-share URLs are never touched.
    assert.equal(await resolveFbShareUrl('https://www.facebook.com/reel/111222333444'), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('facebook page/profile links are NOT clips; real post forms are', async () => {
  const { parseClip } = await import('./platform.mjs');
  for (const u of [
    'https://www.facebook.com/profile.php?id=61595456373129&sk=reels_tab',
    'https://www.facebook.com/profile.php?id=61594161490965',
    'https://www.facebook.com/az-clipz/reels/',
    'https://www.facebook.com/people/Az-Clipz/61590459089254/',
  ]) {
    const p = parseClip(u);
    assert.equal(p.valid, false, u);
    assert.equal(p.notAPost, true, u);
  }
  assert.equal(parseClip('https://www.facebook.com/reel/3170672053141859').key, 'facebook:3170672053141859');
  assert.equal(parseClip('https://www.facebook.com/videos/123456789012/').key, 'facebook:123456789012');
  assert.equal(parseClip('https://www.facebook.com/somepage/posts/pfbid02AbCdEf123').key, 'facebook:post:pfbid02abcdef123');
  assert.equal(parseClip('https://www.facebook.com/permalink.php?story_fbid=9876543210&id=61590459089254').key, 'facebook:post:9876543210');
  assert.equal(parseClip('https://www.facebook.com/photo/?fbid=1122334455').key, 'facebook:post:1122334455');
});

test('page scan skips error/placeholder items and reports what Facebook said', async () => {
  const { scanFacebookPage } = await import('../lib/fetchers/facebook.mjs');
  const realFetch = globalThis.fetch;
  process.env.APIFY_TOKEN = 'test-token';
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify([{
      url: 'https://www.facebook.com/profile.php?id=61595456373129&sk=reels_tab',
      inputUrl: 'https://www.facebook.com/profile.php?id=61595456373129&sk=reels_tab',
      error: 'not_available',
      errorDescription: "This content isn't available right now",
    }]), { status: 200 });
  };
  try {
    const posts = await scanFacebookPage('61595456373129', 20);
    assert.equal(posts.length, 0, 'the profile URL must never pass as a post');
    assert.ok(calls > 1, 'must fall through to the other input shapes');
    assert.match(posts.warning, /isn't available/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('page scan: a feed item whose facebookUrl is the PROFILE still keys by its reel', async () => {
  const { fbItemUrl } = await import('../lib/fetchers/facebook.mjs');
  assert.equal(
    fbItemUrl({ facebookUrl: 'https://www.facebook.com/profile.php?id=1&sk=reels_tab', url: 'https://www.facebook.com/reel/5550001112223' }),
    'https://www.facebook.com/reel/5550001112223',
  );
  assert.equal(fbItemUrl({ facebookUrl: 'https://www.facebook.com/profile.php?id=1', inputUrl: 'https://www.facebook.com/profile.php?id=1' }), null);
});
