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
