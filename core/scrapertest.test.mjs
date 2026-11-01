import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeScrape } from '../lib/scraperTest.mjs';

test('scraper self-test verdicts', () => {
  assert.equal(judgeScrape({ storedViews: 500, fresh: null }).verdict, 'fail');
  assert.equal(judgeScrape({ storedViews: 500, fresh: { views: 0 } }).verdict, 'warn');
  assert.equal(judgeScrape({ storedViews: 10000, fresh: { views: 5000 } }).verdict, 'warn');
  assert.equal(judgeScrape({ storedViews: 10000, fresh: { views: 9800 } }).verdict, 'ok');
  assert.equal(judgeScrape({ storedViews: 500, fresh: { views: 650 } }).verdict, 'ok');
});

test('Apify monthly hard limit becomes a plain instruction', async () => {
  const { friendlyApifyError } = await import('../lib/fetchers/apify-errors.mjs');
  const msg = friendlyApifyError('apify~facebook-posts-scraper', 403,
    '{"error":{"type":"platform-feature-disabled","message":"Monthly usage hard limit exceeded"}}');
  assert.match(msg, /MONTHLY USAGE LIMIT/);
  assert.match(msg, /Billing → Limits/);
});
