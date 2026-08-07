# Ryze Clip Tracker — build plan & status

Automated view-tracking + payout tool for paid clipping campaigns
(streamer program → monthly cycles → clips by clippers, paid on views × CPM).

The full design rationale, cost breakdown, and the Instagram-reliability risk are
in the **build brief** shared in chat. This file is the engineering plan.

---

## ✅ Done (decision-independent foundation — already built & tested)

These don't change based on any pending decision (timezone, host, etc.), so they
were built first. All verified against the real APIs; `npm test` → **32 passing**.

| File | What it is |
|---|---|
| `db/schema.sql` | Full Postgres schema. Portable across Supabase **and** Railway. Money in integer cents; times in UTC; per-campaign timezone column. Soft-delete on people/history. |
| `core/platform.mjs` | Platform detection + YouTube-ID / TikTok / IG / X parsing + URL normalization. Powers duplicate detection (youtu.be = watch = shorts). |
| `core/payout.mjs` | Payout math (min-view floor, per-clip & per-clipper caps, cent-rounding), engagement % (null-safe for hidden counts), budget bands, money formatting. |
| `core/normalize.mjs` | Maps YouTube / Apify-TikTok / Apify-IG responses → one common shape. Raises `ig_suspect` on unreliable IG views. `evaluateFlags()` = the anti-fraud suite. |
| `core/*.test.mjs` | 32 tests covering the tricky real-world cases. Run: `npm test`. |

## ⏳ Blocked only on two answers
- **Timezone** (drives cycle freeze + posted-in-dates check).
- **Host: free Vercel+Supabase vs ~$5/mo Railway** (changes only the deploy step, not the code).

Six other choices already have recommended defaults (see brief). None block starting.

---

## Build order (once we go)

1. **Project skeleton** — Next.js (App Router) + TypeScript; fold `core/` in as `lib/core`.
2. **DB + data layer** — apply `schema.sql`; typed query helpers; seed a demo campaign.
3. **Auth** — single shared password (hashed env var) + session cookie; protect all API routes; secret token on the cron route.
4. **Campaigns & cycles** — CRUD, cycle setup form (all per-cycle settings), "clone last cycle", mid-cycle edit + change log.
5. **Roster** — clippers, linked accounts, per-clipper private submission tokens.
6. **Submission** — public per-clipper link (auto-detect platform, rate-limited) → Pending queue.
7. **Fetching** — YouTube batch (50/call); Apify TikTok/IG async + webhook→DB; per-clip "recheck"; freeze logic; failure flags; thumbnail download-and-rehost.
8. **Dashboard** — summary ticker, budget bar, platform totals, leaderboard (views+payout), clip cards (thumbnail/views/likes/comments/engagement), clip detail Overview+Analytics charts, filters/search, alerts strip.
9. **Payouts Hub** — pending → pay-whole-cycle → history → lifetime per-campaign + grand total.
10. **Reports** — PDF cycle report + per-clipper payout sheets.
11. **Automation** — Vercel daily cron (runs the check + keeps Supabase awake) with enable/disable + Apify daily spend cap.

**v1 = steps 1–10 with YouTube + manual entry live; TikTok/IG (step 7 Apify) is the fast second pass once the Apify key exists.**

## Guardrails baked into the plan
Server-side keys only · DB writes server-only · cron secret · submission rate-limit ·
hard Apify daily cap + live cost readout · soft-delete (never lose lifetime totals) ·
IG views flagged not trusted · thumbnails re-hosted (source links expire).
