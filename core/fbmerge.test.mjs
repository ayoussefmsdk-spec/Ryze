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
