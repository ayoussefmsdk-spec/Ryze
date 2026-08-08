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
| `core/payout.mjs` | Payout engine — **5 models**: CPM, pot-proportional, pot-equal, placement, flat-per-clip; exact-cent pot splitting; qualify thresholds; per-clip/per-clipper caps; manual +/− adjustments (the "any detail" catch-all); engagement % (null-safe); budget bands; formatting. Model is a per-cycle choice, editable mid-cycle. |
| `core/normalize.mjs` | Maps YouTube / Apify-TikTok / Apify-IG responses → one common shape. Raises `ig_suspect` on unreliable IG views. `evaluateFlags()` = the anti-fraud suite. |
| `core/*.test.mjs` | 40 tests covering the tricky real-world cases. Run: `npm test`. |

### App scaffold (step 1–4 begun — builds clean with `npm run build`)
| File | What it is |
|---|---|
| `package.json` / `next.config.mjs` | Next.js 14 (App Router) project. |
| `lib/db.mjs` | Postgres pool + `query()` helper (SSL auto for Railway). |
| `lib/auth.mjs` | Single-password login → signed session cookie; `requireSession()` guard. |
| `scripts/migrate.mjs` | Applies `db/schema.sql` (`npm run migrate`). |
| `app/login` + `app/api/login` `logout` | Password login flow. |
| `app/page.jsx` + `app/api/campaigns` + `components/CampaignForm.jsx` | Home: create & list campaigns (with timezone), backed by Postgres. |

## ✅ Decisions made
- **Host: Railway (~$5/mo)** — always-on Postgres, no pausing, no cold starts, no
  free-tier ToS gray area. Storage scales; data footprint is <1 MB/campaign/year.
- **Timezone: Morocco (`Africa/Casablanca`)** as the campaign default, **overridable
  per cycle** (`cycles.timezone`). All schedules/freeze times honor the cycle tz.
- **Programmable checks per cycle** (`cycles.check_schedule`, `auto_check_enabled`):
  manager sets frequency + times when creating a cycle. Separate cadence for FREE
  (YouTube) vs PAID (TikTok/IG) platforms, with a live monthly-cost estimate shown
  in the setup form. Railway (not Vercel) removes the once-a-day cron limit.
- Six smaller choices use recommended defaults (see brief) unless changed.

---

## Build order (once we go)

1. **Project skeleton** — Next.js (App Router) + TypeScript; fold `core/` in as `lib/core`.
2. **DB + data layer** — apply `schema.sql`; typed query helpers; seed a demo campaign.
3. **Auth** — single shared password (hashed env var) + session cookie; protect all API routes; secret token on the cron route.
4. **Campaigns & cycles** — CRUD, cycle setup form (all per-cycle settings), "clone last cycle", mid-cycle edit + change log.
5. **Roster** — clippers, linked accounts, per-clipper private submission tokens.
6. **Adding clips — three ways, all landing in Pending:**
   - **Manual** — paste a link (auto-detect platform).
   - **Submission link** — public per-clipper link (rate-limited).
   - **Account scan** — pull a clipper's last N posts from their linked accounts,
     keep only those matching the required hashtag + date window, de-dupe against
     existing clips, attribute to the clipper (account-match auto-satisfied).
     Shows a live "this scan ≈ $X" cost preview; occasional use keeps it ~free.
     YouTube scan is free; TikTok/IG scan is pay-per-post (~$1.60/1,000).
7. **Fetching** — YouTube batch (50/call); Apify TikTok/IG async + webhook→DB; per-clip "recheck"; freeze logic; failure flags; thumbnail download-and-rehost.
8. **Dashboard** — summary ticker, budget bar, platform totals, leaderboard (views+payout), clip cards (thumbnail/views/likes/comments/engagement), clip detail Overview+Analytics charts, filters/search, alerts strip.
9. **Payouts Hub** — pending → pay-whole-cycle → history → lifetime per-campaign + grand total.
9b. **History & analytics hub (two levels)** — built from view_history (trajectories)
    + payouts (settled amounts) + frozen cycle snapshots, so comparisons use final
    locked numbers:
    - **Per clipper (profile):** lifetime views/paid; per-campaign breakdown;
      month-by-month cycle history (views · payout · clips · engagement); a "path"
      trend graph of views + earnings over time; leaderboard rank per cycle.
    - **Per campaign:** list of past cycles (dates · views · payout · #clippers ·
      budget/pot used); cycle-over-cycle graphs (views, spend, clipper count, avg
      engagement); drill into any past cycle's frozen leaderboard.
    (No schema change needed — all derivable from existing tables; optional cached
    cycle-summary rollups can be added later purely for speed.)
10. **Reports** — PDF cycle report + per-clipper payout sheets.
11. **Automation** — Railway scheduler runs each active cycle's `check_schedule`
    (free vs paid cadence, in the cycle's timezone) + enable/disable + Apify daily
    spend cap. No once-a-day limit (that was a Vercel-free constraint we've dropped).

**v1 = steps 1–10 with YouTube + manual entry live; TikTok/IG (step 7 Apify) is the fast second pass once the Apify key exists.**

## Guardrails baked into the plan
Server-side keys only · DB writes server-only · cron secret · submission rate-limit ·
hard Apify daily cap + live cost readout · soft-delete (never lose lifetime totals) ·
IG views flagged not trusted · thumbnails re-hosted (source links expire).
