import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clipMoneyState,
  roiProof, writeRecap, paceInfo,
} from './intel.mjs';


// ---- money states ----
test('money-state pipeline maps correctly', () => {
  assert.equal(clipMoneyState({ status: 'approved', flags: [], cycleStatus: 'active' }), 'estimating');
  assert.equal(clipMoneyState({ status: 'approved', flags: [], cycleStatus: 'frozen' }), 'locked');
  assert.equal(clipMoneyState({ status: 'approved', flags: ['ig_suspect'], cycleStatus: 'active' }), 'pending');
  assert.equal(clipMoneyState({ status: 'pending', flags: [], cycleStatus: 'active' }), 'pending');
  assert.equal(clipMoneyState({ status: 'rejected', flags: [], cycleStatus: 'active' }), 'out');
  assert.equal(clipMoneyState({ status: 'approved', flags: [], cycleStatus: 'frozen', paid: true }), 'paid');
});

// ---- ROI proof ----
test('ROI proof: 1M TikTok views for $840 ≈ $10,000 in ads (11.9x)', () => {
  const r = roiProof({ viewsByPlatform: { tiktok: 1_000_000 }, paidCents: 84000 });
  assert.equal(r.adEquivalentCents, 1_000_000 / 1000 * 1000); // $10,000.00
  assert.equal(r.multiple, 11.9);
  assert.equal(r.costPer1kCents, 84); // $0.84 per 1k views
});

test('ROI proof: zero paid gives null multiple', () => {
  const r = roiProof({ viewsByPlatform: { youtube: 5000 }, paidCents: 0 });
  assert.equal(r.multiple, null);
});

// ---- recap ----
test('recap tells the full story when data is rich', () => {
  const text = writeRecap({
    campaignName: "Camy's Campaign", cycleName: 'August',
    totalViews: 4_200_000, clipCount: 31, clipperCount: 7,
    topPlatform: 'tiktok', topPlatformShare: 0.62,
    bestClip: { platform: 'tiktok', handle: 'ryzeclips', views: 900_000 },
    paidCents: 84000, adEquivalentCents: 4_200_000, multiple: 50,
    prevViews: 2_000_000,
  });
  assert.match(text, /7 clippers posted 31 clips/);
  assert.match(text, /Tiktok led the way with 62%/);
  assert.match(text, /@ryzeclips at 900,000 views/);
  assert.match(text, /2.1×|110% more/);
  assert.match(text, /50× cheaper/);
});

test('recap stays sane with minimal data', () => {
  const text = writeRecap({ campaignName: 'X', totalViews: 1000, clipCount: 1, clipperCount: 1, paidCents: 0 });
  assert.match(text, /1 clipper posted 1 clip/);
  assert.ok(!text.includes('undefined'));
});

// ---- pace ----
test('pace: velocity + days-to-cap', () => {
  const r = paceInfo({
    series: [{ label: '2026-08-06', value: 100000 }, { label: '2026-08-07', value: 150000 }],
    budgetCapCents: 350000, totalPayoutCents: 150000,
    endsOn: '2099-12-31',
  });
  assert.equal(r.viewsPerDay, 50000);
  // centsPerView = 1; centsPerDay = 50000; remaining = 200000 -> 4 days
  assert.equal(r.daysToCap, 4);
  assert.equal(r.capBeforeEnd, true);
});

test('pace with no budget gives velocity only', () => {
  const r = paceInfo({
    series: [{ label: '2026-08-06', value: 1000 }, { label: '2026-08-07', value: 3000 }],
    budgetCapCents: 0, totalPayoutCents: 0,
  });
  assert.equal(r.viewsPerDay, 2000);
  assert.equal(r.daysToCap, null);
});
