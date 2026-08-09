import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeClipPayoutCents,
  computeClipperCycleTotalCents,
  computeEngagement,
  budgetStatus,
  formatCents,
  formatEngagement,
} from './payout.mjs';

test('basic payout: 10,300 views at $2 CPM = $20.60', () => {
  // cpm $2 => 200 cents per 1000 views
  assert.equal(computeClipPayoutCents({ views: 10300, cpmCents: 200 }), 2060);
});

test('payout rounds to the nearest cent', () => {
  // 1234 views * 150 / 1000 = 185.1 -> 185 cents
  assert.equal(computeClipPayoutCents({ views: 1234, cpmCents: 150 }), 185);
  // 1237 * 150 / 1000 = 185.55 -> 186 cents
  assert.equal(computeClipPayoutCents({ views: 1237, cpmCents: 150 }), 186);
});

test('min-view floor forces $0 below the threshold, pays at/above', () => {
  assert.equal(computeClipPayoutCents({ views: 900, cpmCents: 300, minViewFloor: 1000 }), 0);
  assert.equal(computeClipPayoutCents({ views: 1000, cpmCents: 300, minViewFloor: 1000 }), 300);
});

test('max-per-clip cap limits a viral clip', () => {
  // would be $100, capped at $25
  assert.equal(
    computeClipPayoutCents({ views: 500000, cpmCents: 200, maxPerClipCents: 2500 }),
    2500,
  );
});

test('clipper total sums rounded clips and applies per-clipper cap', () => {
  assert.equal(computeClipperCycleTotalCents([2060, 185, 300]), 2545);
  assert.equal(computeClipperCycleTotalCents([2060, 185, 300], 2000), 2000);
});

test('engagement = (likes + comments) / views, matches clipping.net example', () => {
  // 10,300 views, 62 likes, 2 comments -> 0.62% -> fraction 0.0062
  const e = computeEngagement({ views: 10300, likes: 62, comments: 2 });
  assert.equal(e, 0.0062);
  assert.equal(formatEngagement(e), '0.6%');
});

test('engagement is null when both likes and comments are unknown', () => {
  assert.equal(computeEngagement({ views: 10300, likes: null, comments: null }), null);
  assert.equal(formatEngagement(null), '—');
});

test('engagement uses only the known count when one is hidden', () => {
  // likes hidden (null), 2 comments -> 2/10300
  const e = computeEngagement({ views: 10300, likes: null, comments: 2 });
  assert.equal(e, Math.round((2 / 10300) * 10000) / 10000);
});

test('engagement is null when views are zero', () => {
  assert.equal(computeEngagement({ views: 0, likes: 5, comments: 5 }), null);
});

test('budget status bands: ok / warn / critical / over', () => {
  assert.equal(budgetStatus(0, 350000).band, 'ok');
  assert.equal(budgetStatus(280000, 350000).band, 'warn'); // 80%
  assert.equal(budgetStatus(320000, 350000).band, 'critical'); // ~91%
  const over = budgetStatus(360000, 350000);
  assert.equal(over.band, 'over');
  assert.equal(over.over, true);
  assert.equal(budgetStatus(175000, 350000).pct, 50);
});

test('formatCents renders money correctly', () => {
  assert.equal(formatCents(2060), '$20.60');
  assert.equal(formatCents(5), '$0.05');
  assert.equal(formatCents(0), '$0.00');
  assert.equal(formatCents(350000), '$3500.00');
});

test('maxPaidViews: pays only capped views, full views still reported', () => {
  // 1.2M views, $0.50 CPM, cap paid views at 700k -> pays 700k * 50 / 1000 = $350.00
  assert.equal(
    computeClipPayoutCents({ views: 1_200_000, cpmCents: 50, maxPaidViews: 700_000 }),
    35000,
  );
  // under the cap -> unchanged
  assert.equal(
    computeClipPayoutCents({ views: 500_000, cpmCents: 50, maxPaidViews: 700_000 }),
    25000,
  );
  // same views cap is fair across CPMs: cheap platform pays less money, same view ceiling
  assert.equal(
    computeClipPayoutCents({ views: 2_000_000, cpmCents: 20, maxPaidViews: 700_000 }),
    14000,
  );
  // money cap still applies after the views cap
  assert.equal(
    computeClipPayoutCents({ views: 1_200_000, cpmCents: 50, maxPaidViews: 700_000, maxPerClipCents: 10000 }),
    10000,
  );
});
