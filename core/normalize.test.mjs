import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHashtags,
  normalizeYouTube,
  normalizeTikTok,
  normalizeInstagram,
  evaluateFlags,
} from './normalize.mjs';

test('parseHashtags extracts unique lowercased tags', () => {
  assert.deepEqual(parseHashtags('love this #Camy #camy #ClipOfTheDay!!'), ['camy', 'clipoftheday']);
  assert.deepEqual(parseHashtags(''), []);
  assert.deepEqual(parseHashtags(null), []);
});

test('normalizeYouTube maps fields and parses hashtags from title/description', () => {
  const item = {
    statistics: { viewCount: '10300', likeCount: '62', commentCount: '2' },
    snippet: {
      title: 'crazy moment #Camy',
      description: 'follow the stream #highlights',
      channelId: 'UC123',
      channelTitle: 'The Investigator',
      publishedAt: '2026-08-03T12:00:00Z',
      thumbnails: { high: { url: 'https://i.ytimg.com/x.jpg' } },
    },
  };
  const s = normalizeYouTube(item);
  assert.equal(s.views, 10300);
  assert.equal(s.likes, 62);
  assert.equal(s.comments, 2);
  assert.equal(s.accountHandle, 'the investigator');
  assert.equal(s.postedAt, '2026-08-03T12:00:00Z');
  assert.deepEqual(s.hashtags, ['camy', 'highlights']);
  assert.equal(s.thumbnailUrl, 'https://i.ytimg.com/x.jpg');
});

test('normalizeYouTube treats hidden likes / disabled comments as null (not 0)', () => {
  const s = normalizeYouTube({ statistics: { viewCount: '5000' }, snippet: { title: 't', description: '' } });
  assert.equal(s.views, 5000);
  assert.equal(s.likes, null);
  assert.equal(s.comments, null);
});

test('normalizeTikTok maps clockworks fields', () => {
  const item = {
    playCount: 32000,
    diggCount: 400,
    commentCount: 12,
    shareCount: 5,
    createTimeISO: '2026-08-04T09:00:00.000Z',
    authorMeta: { name: 'Camy', id: 'a1' },
    text: 'wild #camy',
    hashtags: [{ name: 'Camy' }, { name: 'fyp' }],
    videoMeta: { coverUrl: 'https://p.tiktokcdn.com/c.jpg' },
  };
  const s = normalizeTikTok(item);
  assert.equal(s.views, 32000);
  assert.equal(s.likes, 400);
  assert.equal(s.comments, 12);
  assert.equal(s.shares, 5);
  assert.equal(s.accountHandle, 'camy');
  assert.deepEqual(s.hashtags, ['camy', 'fyp']);
  assert.equal(s.thumbnailUrl, 'https://p.tiktokcdn.com/c.jpg');
});

test('normalizeInstagram flags suspect views on a reel with 0/null plays', () => {
  const zero = normalizeInstagram({ type: 'Video', productType: 'clips', videoPlayCount: 0, likesCount: 20, commentsCount: 3, ownerUsername: 'Camy' });
  assert.equal(zero.views, 0);
  assert.ok(zero.addedFlags.includes('ig_suspect'));

  const nullViews = normalizeInstagram({ productType: 'clips', videoPlayCount: null, videoViewCount: null, likesCount: 20, ownerUsername: 'camy' });
  assert.ok(nullViews.addedFlags.includes('ig_suspect'));
});

test('normalizeInstagram trusts a healthy reel and hides -1 likes', () => {
  const s = normalizeInstagram({ type: 'Video', productType: 'clips', videoPlayCount: 8000, likesCount: -1, commentsCount: 4, ownerUsername: 'Camy', displayUrl: 'https://scontent.cdninstagram.com/x.jpg' });
  assert.equal(s.views, 8000);
  assert.equal(s.likes, null); // -1 => hidden
  assert.equal(s.comments, 4);
  assert.equal(s.accountHandle, 'camy');
  assert.deepEqual(s.addedFlags, []);
});

test('normalizeInstagram falls back to videoViewCount when playCount missing', () => {
  const s = normalizeInstagram({ type: 'Video', videoViewCount: 4500, likesCount: 10, ownerUsername: 'camy' });
  assert.equal(s.views, 4500);
  assert.equal(s.addedFlags.includes('ig_suspect'), false);
});

test('evaluateFlags: unknown account when handle not in clipper set', () => {
  const flags = evaluateFlags({
    stats: { accountHandle: 'randomdude', hashtags: [], views: 100 },
    cycle: {},
    clipperAccounts: ['camy', 'camy.clips'],
  });
  assert.ok(flags.includes('unknown_account'));
});

test('evaluateFlags: outside_dates when posted before the cycle', () => {
  const flags = evaluateFlags({
    stats: { accountHandle: 'camy', postedAt: '2026-07-15T00:00:00Z', hashtags: [], views: 100 },
    cycle: { enforcePostWindow: true, startsOn: '2026-08-01', endsOn: '2026-08-14' },
    clipperAccounts: ['camy'],
  });
  assert.ok(flags.includes('outside_dates'));
});

test('evaluateFlags: missing_hashtag when required tag absent', () => {
  const flags = evaluateFlags({
    stats: { accountHandle: 'camy', hashtags: ['fyp'], views: 100 },
    cycle: { hashtagMode: 'flag', requiredHashtags: ['camy'] },
    clipperAccounts: ['camy'],
  });
  assert.ok(flags.includes('missing_hashtag'));
});

test('evaluateFlags: view_drop when views collapse vs last check', () => {
  const flags = evaluateFlags({
    stats: { accountHandle: 'camy', hashtags: [], views: 400 },
    cycle: {},
    clipperAccounts: ['camy'],
    previousViews: 1000,
  });
  assert.ok(flags.includes('view_drop'));
});

test('evaluateFlags: clean clip has no flags', () => {
  const flags = evaluateFlags({
    stats: { accountHandle: 'camy', postedAt: '2026-08-05T00:00:00Z', hashtags: ['camy'], views: 1200 },
    cycle: { enforcePostWindow: true, startsOn: '2026-08-01', endsOn: '2026-08-14', hashtagMode: 'flag', requiredHashtags: ['camy'] },
    clipperAccounts: ['camy'],
    previousViews: 1100,
  });
  assert.deepEqual(flags, []);
});
