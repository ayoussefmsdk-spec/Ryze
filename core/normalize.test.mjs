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

test('normalizeYouTube prefers the real @handle over the display name', () => {
  const item = { id: 'x', snippet: { title: 't', channelTitle: 'The Investigator', channelId: 'UC1' }, statistics: { viewCount: '5' } };
  assert.equal(normalizeYouTube(item).accountHandle, 'the investigator'); // fallback: display name
  assert.equal(normalizeYouTube(item, '@TheInvestigator00').accountHandle, 'theinvestigator00');
  assert.equal(normalizeYouTube(item, 'theinvestigator00').accountHandle, 'theinvestigator00');
});

test('account matching ignores @, case and spaces', () => {
  const cycle = { enforcePostWindow: false, startsOn: '2026-08-01', endsOn: '2026-08-31', hashtagMode: 'off', requiredHashtags: [] };
  // display-name-with-spaces vs linked handle — matches once handle resolution works
  const f1 = evaluateFlags({ stats: { accountHandle: 'theinvestigator00', views: 10 }, cycle, clipperAccounts: ['@TheInvestigator00'], previousViews: null });
  assert.ok(!f1.includes('unknown_account'));
  const f2 = evaluateFlags({ stats: { accountHandle: 'the investigator00', views: 10 }, cycle, clipperAccounts: ['theinvestigator00'], previousViews: null });
  assert.ok(!f2.includes('unknown_account'));
  // genuinely different account still flags
  const f3 = evaluateFlags({ stats: { accountHandle: 'someoneelse', views: 10 }, cycle, clipperAccounts: ['theinvestigator00'], previousViews: null });
  assert.ok(f3.includes('unknown_account'));
});

// ---- classifyStatsAnomaly (Apify glitch shield) -----------------------------
import { classifyStatsAnomaly } from './normalize.mjs';

test('anomaly: sudden zero on an established post is a zero_glitch', () => {
  assert.equal(classifyStatsAnomaly({ prevViews: 5000, newViews: 0 }), 'zero_glitch');
  assert.equal(classifyStatsAnomaly({ prevViews: 100, newViews: 0 }), 'zero_glitch');
});

test('anomaly: >30% one-check drop on an established post is a big_drop', () => {
  assert.equal(classifyStatsAnomaly({ prevViews: 10000, newViews: 6000 }), 'big_drop');
  assert.equal(classifyStatsAnomaly({ prevViews: 1000, newViews: 500 }), 'big_drop');
});

test('anomaly: small posts and small dips pass through untouched', () => {
  assert.equal(classifyStatsAnomaly({ prevViews: 50, newViews: 0 }), null);      // tiny post, zero plausible
  assert.equal(classifyStatsAnomaly({ prevViews: 10000, newViews: 8000 }), null); // 20% dip = correction
  assert.equal(classifyStatsAnomaly({ prevViews: 500, newViews: 200 }), null);   // below big_drop floor
  assert.equal(classifyStatsAnomaly({ prevViews: 1000, newViews: 1500 }), null); // growth is never a glitch
});

test('anomaly: bad inputs are never flagged', () => {
  assert.equal(classifyStatsAnomaly({ prevViews: null, newViews: 0 }), null);
  assert.equal(classifyStatsAnomaly({ prevViews: 1000, newViews: undefined }), null);
});

test('IG views take the LARGEST metric — plays absent must not collapse to tiny views', () => {
  const s = normalizeInstagram({ type: 'Video', videoPlayCount: null, videoViewCount: 600, igPlayCount: 300000, likesCount: 9000 });
  assert.equal(s.views, 300000);
  assert.deepEqual(s.addedFlags, []);
  const s2 = normalizeInstagram({ type: 'Video', videoPlayCount: 287000, videoViewCount: 600 });
  assert.equal(s2.views, 287000);
});

test('IG under-reported views (likes > views) raise ig_suspect', () => {
  const s = normalizeInstagram({ type: 'Video', videoViewCount: 600, likesCount: 9000 });
  assert.equal(s.views, 600);
  assert.ok(s.addedFlags.includes('ig_suspect'));
  // and the flag is not duplicated when zero-views already flagged
  const z = normalizeInstagram({ type: 'Video', likesCount: 10 });
  assert.deepEqual(z.addedFlags, ['ig_suspect']);
});

test('IG wide-net metric reader catches renamed plays fields', () => {
  const s = normalizeInstagram({ type: 'Video', videoViewCount: 637, likesCount: 5, ig_play_count: 300000 });
  assert.equal(s.views, 300000);
  const s2 = normalizeInstagram({ type: 'Video', videoViewCount: 637, playCount: 287000 });
  assert.equal(s2.views, 287000);
  // duration-like or string fields never leak into views
  const s3 = normalizeInstagram({ type: 'Video', videoViewCount: 637, videoUrl: 'https://x/999999.mp4', viewerNote: 'abc' });
  assert.equal(s3.views, 637);
});

// ---- normalizeFacebook ------------------------------------------------------
import { normalizeFacebook } from './normalize.mjs';

test('facebook normalizer maps defensively across actor shapes', () => {
  const s = normalizeFacebook({
    playCount: 5000, viewsCount: 120000, likesCount: 900, commentsCount: 40,
    text: 'Camy nuked them #camy #cod', pageUsername: 'Az Clips', timestamp: '2026-08-20T10:00:00Z',
  });
  assert.equal(s.views, 120000); // largest view-ish field wins
  assert.equal(s.likes, 900);
  assert.equal(s.comments, 40);
  assert.deepEqual(s.hashtags, ['camy', 'cod']);
  assert.equal(s.accountHandle, 'azclips');
  const alt = normalizeFacebook({ viewCount: 777, reactions: 12, comments: 3, title: 'clip' });
  assert.equal(alt.views, 777);
  assert.equal(alt.likes, 12);
  assert.equal(alt.comments, 3);
});

import { sanitizeCheckSchedule } from './normalize.mjs';

test('check schedule: facebook group defaults to manual, keeps chosen times', () => {
  const def = sanitizeCheckSchedule({});
  assert.deepEqual(def.fb, { mode: 'manual' });
  const set = sanitizeCheckSchedule({ fb: { mode: 'daily', atLocal: ['09:00', '21:00'] } });
  assert.deepEqual(set.fb, { mode: 'daily', atLocal: ['09:00', '21:00'] });
});

test('facebook normalizer handles REAL actor payloads (verified fields)', () => {
  // reels-feed item shape (page route) — plays in playCountRounded
  const reel = normalizeFacebook({
    topLevelReelUrl: 'https://facebook.com/reel/2347015899384936/',
    shareable_url: 'https://www.facebook.com/reel/2347015899384936',
    time: '2026-08-26T22:50:40.000Z',
    playCountRounded: 63000,
    play_count_reduced: '63K',
  });
  assert.equal(reel.views, 63000);
  assert.equal(reel.postedAt, '2026-08-26T22:50:40.000Z');
  // direct-post item shape — likes/comments but NO plays
  const direct = normalizeFacebook({
    facebookUrl: 'https://www.facebook.com/reel/3170672053141859',
    likes: 6203, comments: 37, total_comment_count: 37,
    creation_time: 1787368846, facebookId: '3170672053141859', pageName: '61590459089254',
  });
  assert.equal(direct.views, 0);
  assert.equal(direct.likes, 6203);
  assert.equal(direct.comments, 37);
  assert.ok(direct.postedAt?.startsWith('2026-'));
  assert.equal(direct.accountHandle, '61590459089254');
});
