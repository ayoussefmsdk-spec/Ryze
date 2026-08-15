import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillDailySeries, zeroFillDaily, dailyGains, minIso } from './series.mjs';

test('zeroFillDaily: missing days are 0, nothing carries forward', () => {
  const out = zeroFillDaily(
    [
      { label: '2026-08-02', value: 3 },
      { label: '2026-08-05', value: 1 },
    ],
    { from: '2026-08-01', to: '2026-08-06' },
  );
  assert.deepEqual(out.map((p) => p.value), [0, 3, 0, 0, 1, 0]);
});

test('zeroFillDaily: empty series with bounds -> all-zero calendar', () => {
  const out = zeroFillDaily([], { from: '2026-08-01', to: '2026-08-03' });
  assert.deepEqual(out.map((p) => p.value), [0, 0, 0]);
  assert.deepEqual(out.map((p) => p.label), ['2026-08-01', '2026-08-02', '2026-08-03']);
});

test('fills gap days by carrying the last total forward', () => {
  const out = fillDailySeries([
    { label: '2026-08-01', value: 100 },
    { label: '2026-08-04', value: 400 },
  ]);
  assert.deepEqual(out.map((p) => p.label), ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']);
  assert.deepEqual(out.map((p) => p.value), [100, 100, 100, 400]);
});

test('extends to the requested range; pre-data days are 0', () => {
  const out = fillDailySeries(
    [{ label: '2026-08-03', value: 50 }],
    { from: '2026-08-01', to: '2026-08-05' },
  );
  assert.deepEqual(out.map((p) => p.value), [0, 0, 50, 50, 50]);
  assert.equal(out[0].label, '2026-08-01');
  assert.equal(out[4].label, '2026-08-05');
});

test('explicit bounds clamp the axis — stray early points carry in, not stretch', () => {
  const out = fillDailySeries(
    [
      { label: '2026-08-01', value: 10 },
      { label: '2026-08-06', value: 60 },
    ],
    { from: '2026-08-03', to: '2026-08-04' },
  );
  // Window is exactly 03..04; the pre-window total (10) carries in as the base.
  assert.deepEqual(out, [
    { label: '2026-08-03', value: 10 },
    { label: '2026-08-04', value: 10 },
  ]);
});

test('zeroFillDaily clamps counts to explicit bounds', () => {
  const out = zeroFillDaily(
    [
      { label: '2026-05-30', value: 2 }, // posted before the cycle — outside
      { label: '2026-08-02', value: 3 },
    ],
    { from: '2026-08-01', to: '2026-08-03' },
  );
  assert.deepEqual(out, [
    { label: '2026-08-01', value: 0 },
    { label: '2026-08-02', value: 3 },
    { label: '2026-08-03', value: 0 },
  ]);
});

test('crosses month boundaries on real calendar dates', () => {
  const out = fillDailySeries([
    { label: '2026-08-30', value: 1 },
    { label: '2026-09-02', value: 4 },
  ]);
  assert.deepEqual(out.map((p) => p.label), ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']);
});

test('empty series -> empty result', () => {
  assert.deepEqual(fillDailySeries([]), []);
});

test('dailyGains converts totals to per-day views, never negative', () => {
  const gains = dailyGains([
    { label: 'd1', value: 100 },
    { label: 'd2', value: 100 },
    { label: 'd3', value: 250 },
    { label: 'd4', value: 240 }, // platform corrected downward
  ]);
  assert.deepEqual(gains.map((g) => g.value), [100, 0, 150, 0]);
});

test('minIso picks the earlier date', () => {
  assert.equal(minIso('2026-08-09', '2026-08-28'), '2026-08-09');
  assert.equal(minIso('2026-08-28', '2026-08-09'), '2026-08-09');
});
