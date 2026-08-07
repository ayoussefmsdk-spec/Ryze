import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform, extractYouTubeId, parseClip, normalizedKey, isSameClip } from './platform.mjs';

test('detectPlatform covers each platform + invalid', () => {
  assert.equal(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectPlatform('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectPlatform('https://www.tiktok.com/@camy/video/7300000000000000000'), 'tiktok');
  assert.equal(detectPlatform('https://vm.tiktok.com/ZMabc123/'), 'tiktok');
  assert.equal(detectPlatform('https://www.instagram.com/reel/Cabc123DEF/'), 'instagram');
  assert.equal(detectPlatform('https://x.com/user/status/123'), 'twitter');
  assert.equal(detectPlatform('https://twitter.com/user/status/123'), 'twitter');
  assert.equal(detectPlatform('https://vimeo.com/12345'), 'other');
  assert.equal(detectPlatform('tiktok.com/@x/video/1'), 'tiktok'); // no scheme tolerated
  assert.equal(detectPlatform('not a url at all'), null); // spaces in host => unparseable
});

test('detectPlatform returns null on truly unparseable input', () => {
  assert.equal(detectPlatform(''), null);
  assert.equal(detectPlatform(null), null);
  assert.equal(detectPlatform('   '), null);
});

test('extractYouTubeId handles every URL shape + params', () => {
  const id = 'dQw4w9WgXcQ';
  assert.equal(extractYouTubeId(`https://www.youtube.com/watch?v=${id}`), id);
  assert.equal(extractYouTubeId(`https://youtu.be/${id}`), id);
  assert.equal(extractYouTubeId(`https://youtu.be/${id}?si=abcd&t=30`), id);
  assert.equal(extractYouTubeId(`https://www.youtube.com/shorts/${id}`), id);
  assert.equal(extractYouTubeId(`https://www.youtube.com/embed/${id}`), id);
  assert.equal(extractYouTubeId(`https://www.youtube.com/watch?v=${id}&list=PLxxxx&index=2`), id);
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?list=PLxxxx'), null); // playlist, no video
  assert.equal(extractYouTubeId('https://vimeo.com/12345'), null);
});

test('different YouTube URL shapes collapse to the SAME duplicate key', () => {
  const id = 'dQw4w9WgXcQ';
  const a = `https://www.youtube.com/watch?v=${id}`;
  const b = `https://youtu.be/${id}?si=xyz`;
  const c = `https://www.youtube.com/shorts/${id}`;
  assert.equal(normalizedKey(a), `youtube:${id}`);
  assert.ok(isSameClip(a, b));
  assert.ok(isSameClip(a, c));
});

test('parseClip pulls handle + id from TikTok', () => {
  const r = parseClip('https://www.tiktok.com/@camy.clips/video/7300000000000000001?_r=1&is_from_webapp=1');
  assert.equal(r.valid, true);
  assert.equal(r.platform, 'tiktok');
  assert.equal(r.handle, 'camy.clips');
  assert.equal(r.id, '7300000000000000001');
  assert.equal(r.key, 'tiktok:7300000000000000001');
});

test('TikTok tracking params do not change the duplicate key', () => {
  const clean = 'https://www.tiktok.com/@camy/video/7300000000000000002';
  const dirty = 'https://www.tiktok.com/@camy/video/7300000000000000002?_r=1&_t=abc&is_from_webapp=1';
  assert.ok(isSameClip(clean, dirty));
});

test('parseClip handles Instagram reel + post shortcodes', () => {
  assert.equal(parseClip('https://www.instagram.com/reel/CxAbc123DEF/').key, 'instagram:CxAbc123DEF');
  assert.equal(parseClip('https://www.instagram.com/p/CxAbc123DEF/?igsh=xxxx').key, 'instagram:CxAbc123DEF');
});

test('parseClip handles Twitter/X status', () => {
  const r = parseClip('https://x.com/CamyStream/status/1790000000000000000');
  assert.equal(r.platform, 'twitter');
  assert.equal(r.handle, 'camystream');
  assert.equal(r.key, 'twitter:1790000000000000000');
});

test('two clippers posting the same video are detected as duplicate', () => {
  const clipperA = 'https://www.tiktok.com/@a/video/7300000000000000009';
  const clipperB = 'https://www.tiktok.com/@a/video/7300000000000000009?_t=zzz';
  assert.ok(isSameClip(clipperA, clipperB));
});
