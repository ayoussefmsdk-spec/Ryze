# Ryze Clip Tracker

Automated view-tracking and payout tool for paid clipping campaigns.

A campaign manager runs a streamer's clipping program as a series of monthly
**cycles**. Clippers post short clips to YouTube / TikTok / Instagram / X; the app
fetches each clip's current view count automatically and computes payouts on a
cost-per-1000-views (CPM) basis.

- **YouTube** — official Data API (exact, free).
- **TikTok** — Apify scraper (reliable).
- **Instagram** — Apify scraper (views flagged for manual verification — IG's
  reported counts are unreliable).
- **X / Other** — manual entry.

## Status

Foundation logic is built and tested (`npm test` → 32 passing). See
[`NEXT-STEPS.md`](./NEXT-STEPS.md) for the full build plan and current status,
and the design brief shared in chat for costs, architecture, and open decisions.

## Layout

```
db/schema.sql     Postgres schema (portable: Supabase or Railway)
core/             pure logic — platform/URL parsing, payout math, response normalizers
core/*.test.mjs   test suite (node --test)
```

## Test

```
npm test
```
