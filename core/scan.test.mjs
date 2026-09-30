import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectScanCandidates, estimateScanCostCents } from './scan.mjs';

const base = {
  requiredHashtags: ['camy'],
  startsOn: '2026-08-01',
  endsOn: '2026-08-31',
  enforceWindow: true,
  existingKeys: new Set(['tiktok:already1']),
};

test('accepts a tagged, in-window, new post', () => {
  const { accept } = selectScanCandidates({
    ...base,
    candidates: [{ key: 'tiktok:new1', hashtags: ['camy', 'fyp'], postedAt: '2026-08-10T00:00:00Z' }],
  });
  assert.equal(accept.length, 1);
  assert.equal(accept[0].key, 'tiktok:new1');
});

test('skips already-ingested posts', () => {
  const { accept, reject } = selectScanCandidates({
    ...base,
    candidates: [{ key: 'tiktok:already1', hashtags: ['camy'], postedAt: '2026-08-10T00:00:00Z' }],
  });
  assert.equal(accept.length, 0);
  assert.equal(reject[0].reason, 'duplicate');
});

test('drops posts missing the required hashtag', () => {
  const { accept, reject } = selectScanCandidates({
    ...base,
    candidates: [{ key: 'tiktok:new2', hashtags: ['fyp'], postedAt: '2026-08-10T00:00:00Z' }],
  });
  assert.equal(accept.length, 0);
  assert.equal(reject[0].reason, 'missing_hashtag');
});

test('drops posts outside the cycle window', () => {
  const { accept, reject } = selectScanCandidates({
    ...base,
    candidates: [{ key: 'tiktok:new3', hashtags: ['camy'], postedAt: '2026-07-15T00:00:00Z' }],
  });
  assert.equal(accept.length, 0);
  assert.equal(reject[0].reason, 'outside_dates');
});

test('dedupes within the same scan batch', () => {
  const { accept } = selectScanCandidates({
    ...base,
    candidates: [
      { key: 'tiktok:dup', hashtags: ['camy'], postedAt: '2026-08-05T00:00:00Z' },
      { key: 'tiktok:dup', hashtags: ['camy'], postedAt: '2026-08-05T00:00:00Z' },
    ],
  });
  assert.equal(accept.length, 1);
});

test('no hashtag requirement accepts untagged posts', () => {
  const { accept } = selectScanCandidates({
    candidates: [{ key: 'yt:x', hashtags: [], postedAt: '2026-08-05T00:00:00Z' }],
    requiredHashtags: [], enforceWindow: false, existingKeys: new Set(),
  });
  assert.equal(accept.length, 1);
});

test('cost estimate: 30 paid posts ≈ 5 cents', () => {
  assert.equal(estimateScanCostCents({ paidPosts: 30 }), 5); // 30*160/1000 = 4.8 -> 5
});

test('posts tracked in another campaign are separated with their location', () => {
  const { accept, reject } = selectScanCandidates({
    candidates: [
      { key: 'tiktok:reused', url: 'u1', hashtags: [], postedAt: '2026-09-05T00:00:00Z' },
      { key: 'tiktok:fresh', url: 'u2', hashtags: [], postedAt: '2026-09-05T00:00:00Z' },
      { key: 'tiktok:mine', url: 'u3', hashtags: [], postedAt: '2026-09-05T00:00:00Z' },
    ],
    requiredHashtags: [], enforceWindow: false,
    existingKeys: new Set(['tiktok:mine']), // this cycle wins over "elsewhere"
    otherCycleKeys: new Map([['tiktok:reused', 'ClientB · September'], ['tiktok:mine', 'ClientB · September']]),
  });
  assert.deepEqual(accept.map((c) => c.key), ['tiktok:fresh']);
  const reused = reject.find((r) => r.key === 'tiktok:reused');
  assert.equal(reused.reason, 'in_other_campaign');
  assert.equal(reused.elsewhere, 'ClientB · September');
  assert.equal(reject.find((r) => r.key === 'tiktok:mine').reason, 'duplicate');
});

test('deleted-before posts are separated from real already-ins', () => {
  const { accept, reject } = selectScanCandidates({
    candidates: [
      { key: 'yt:live', url: 'u1', hashtags: [], postedAt: '2026-09-05T00:00:00Z' },
      { key: 'yt:tombstone', url: 'u2', hashtags: [], postedAt: '2026-09-05T00:00:00Z' },
      { key: 'yt:fresh', url: 'u3', hashtags: [], postedAt: '2026-09-05T00:00:00Z' },
      { key: 'yt:both', url: 'u4', hashtags: [], postedAt: '2026-09-05T00:00:00Z' },
    ],
    requiredHashtags: [], enforceWindow: false,
    existingKeys: new Set(['yt:live', 'yt:both']),      // actually in the cycle
    deletedKeys: new Set(['yt:tombstone']),             // removed by the manager
  });
  assert.deepEqual(accept.map((c) => c.key), ['yt:fresh']);
  assert.equal(reject.find((r) => r.key === 'yt:live').reason, 'duplicate');
  assert.equal(reject.find((r) => r.key === 'yt:both').reason, 'duplicate'); // in-cycle wins
  assert.equal(reject.find((r) => r.key === 'yt:tombstone').reason, 'deleted_before');
});

test('a repeated tombstoned key gets ONE deleted_before row, never a fake "already in"', () => {
  const { accept, reject } = selectScanCandidates({
    candidates: [
      { key: 'yt:gone', url: 'u1', hashtags: [], postedAt: '2026-09-05T00:00:00Z' },
      { key: 'yt:gone', url: 'u1', hashtags: [], postedAt: '2026-09-05T00:00:00Z' }, // same channel linked twice
    ],
    requiredHashtags: [], enforceWindow: false,
    existingKeys: new Set(),
    deletedKeys: new Set(['yt:gone']),
  });
  assert.equal(accept.length, 0);
  assert.deepEqual(reject.map((r) => r.reason), ['deleted_before']); // exactly one row, honest reason
});

test('cross-campaign warning outranks this cycle\'s tombstone', () => {
  const { reject } = selectScanCandidates({
    candidates: [{ key: 'tt:v', url: 'u', hashtags: [], postedAt: '2026-09-05T00:00:00Z' }],
    requiredHashtags: [], enforceWindow: false,
    existingKeys: new Set(),
    deletedKeys: new Set(['tt:v']),
    otherCycleKeys: new Map([['tt:v', 'ClientB · September']]),
  });
  assert.equal(reject[0].reason, 'in_other_campaign');
  assert.equal(reject[0].elsewhere, 'ClientB · September');
});
