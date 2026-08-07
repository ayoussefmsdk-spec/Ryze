import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  qualifies,
  distributePot,
  computePotProportional,
  computePotEqual,
  computePlacement,
  computeFlatPerClip,
  applyAdjustments,
} from './payout.mjs';

const sum = (map) => [...map.values()].reduce((a, b) => a + b, 0);

test('qualifies respects the minimum-views threshold', () => {
  assert.equal(qualifies(5000, 5000), true);
  assert.equal(qualifies(4999, 5000), false);
  assert.equal(qualifies(0, 0), false); // zero views never qualifies
  assert.equal(qualifies(10, 0), true);
});

test('distributePot splits to EXACTLY the pot (largest-remainder)', () => {
  // equal 3-way split of $100 -> parts sum to exactly 10000 cents
  const parts = distributePot(10000, [1, 1, 1]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 10000);
  assert.deepEqual([...parts].sort((a, b) => a - b), [3333, 3333, 3334]);
  // proportional weights also sum exactly
  const prop = distributePot(350000, [60000, 30000, 10000]);
  assert.equal(prop.reduce((a, b) => a + b, 0), 350000);
});

test('pot_proportional pays by view share and sums to the pot', () => {
  const entries = [
    { key: 'camy', views: 60000 },
    { key: 'ryze', views: 30000 },
    { key: 'zoe', views: 10000 },
  ];
  const out = computePotProportional({ potCents: 350000, entries, qualifyMinViews: 5000 });
  assert.equal(sum(out), 350000); // whole pot distributed
  assert.equal(out.get('camy'), 210000); // 60% of $3500
  assert.equal(out.get('ryze'), 105000); // 30%
  assert.equal(out.get('zoe'), 35000); // 10%
});

test('pot_proportional excludes clippers below the qualify threshold', () => {
  const entries = [
    { key: 'camy', views: 90000 },
    { key: 'tiny', views: 1000 }, // below 5000 -> excluded, gets $0
  ];
  const out = computePotProportional({ potCents: 100000, entries, qualifyMinViews: 5000 });
  assert.equal(out.get('tiny'), 0);
  assert.equal(out.get('camy'), 100000); // qualifier takes the whole pot
  assert.equal(sum(out), 100000);
});

test('pot_equal splits evenly among qualifiers only', () => {
  const entries = [
    { key: 'a', views: 20000 },
    { key: 'b', views: 20000 },
    { key: 'c', views: 100 }, // disqualified
  ];
  const out = computePotEqual({ potCents: 100000, entries, qualifyMinViews: 5000 });
  assert.equal(out.get('c'), 0);
  assert.equal(out.get('a') + out.get('b'), 100000);
  assert.equal(out.get('a'), 50000);
});

test('placement awards fixed prizes to the top ranks by views', () => {
  const entries = [
    { key: 'a', views: 50000 },
    { key: 'b', views: 80000 },
    { key: 'c', views: 20000 },
    { key: 'd', views: 500 }, // disqualified
  ];
  const out = computePlacement({ prizesCents: [100000, 50000, 25000], entries, qualifyMinViews: 1000 });
  assert.equal(out.get('b'), 100000); // 1st (most views)
  assert.equal(out.get('a'), 50000); // 2nd
  assert.equal(out.get('c'), 25000); // 3rd
  assert.equal(out.get('d'), 0); // didn't qualify
});

test('flat_per_clip pays a fixed amount per qualifying clip', () => {
  const clips = [
    { key: 'clip1', views: 3000 },
    { key: 'clip2', views: 800 }, // below floor
    { key: 'clip3', views: 5000 },
  ];
  const out = computeFlatPerClip({ amountCents: 500, entries: clips, qualifyMinViews: 1000 });
  assert.equal(out.get('clip1'), 500);
  assert.equal(out.get('clip2'), 0);
  assert.equal(out.get('clip3'), 500);
});

test('manual adjustments add bonuses / deductions and never go below $0', () => {
  const base = new Map([['camy', 21000], ['ryze', 500]]);
  const out = applyAdjustments(base, { camy: 5000, ryze: -900 });
  assert.equal(out.get('camy'), 26000); // +$50 bonus
  assert.equal(out.get('ryze'), 0); // -$9 deduction, floored at 0
});
