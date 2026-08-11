-- ============================================================================
-- Ryze Clip Tracker — database schema (PostgreSQL)
-- ============================================================================
-- Portable across Supabase and Railway (both are plain Postgres), so this file
-- does not change based on the hosting decision. Money is stored as integer
-- CENTS everywhere to avoid floating-point rounding bugs. Times are timestamptz
-- (UTC); per-campaign display timezone lives on `campaigns.timezone`.
-- ============================================================================

-- ---- Enumerated types -------------------------------------------------------
create type platform_t          as enum ('youtube','tiktok','instagram','twitter','other');
create type cycle_status_t       as enum ('draft','active','frozen');
-- How clippers get paid in a given cycle. Each model reads its own params from
-- cycles.payout_config (jsonb), so new models can be added without schema changes.
--   cpm             — views/1000 × CPM per platform (+ floor/caps)
--   pot_proportional— fixed pot split by each qualifier's share of views
--   pot_equal       — fixed pot split equally among qualifiers
--   placement       — fixed prizes to the top ranks (1st/2nd/3rd…)
--   flat_per_clip   — fixed amount per qualifying clip
create type payout_model_t       as enum ('cpm','pot_proportional','pot_equal','placement','flat_per_clip');
create type clip_status_t        as enum ('pending','approved','rejected');
create type clip_source_t        as enum ('auto','manual');   -- how the view NUMBER was obtained: fetched vs hand-typed
create type clip_added_via_t     as enum ('manual','submission','scan'); -- how the CLIP entered the app
create type hashtag_mode_t       as enum ('off','flag','auto_reject');

-- ---- Campaigns (a streamer's ongoing program) -------------------------------
create table campaigns (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  streamer_handle text,
  avatar_url      text,
  timezone        text not null default 'UTC',      -- IANA tz, e.g. 'America/New_York'
  currency        text not null default 'USD',
  notes           text,
  default_settings jsonb not null default '{}',      -- seeds new cycles (CPMs, budget, hashtag, ...)
  archived        boolean not null default false,    -- soft-hide; never hard-delete history
  created_at      timestamptz not null default now()
);

-- ---- Cycles (one time-boxed round inside a campaign) ------------------------
create table cycles (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references campaigns(id) on delete cascade,
  name              text not null,
  status            cycle_status_t not null default 'draft',
  timezone          text,                            -- optional per-cycle IANA tz; falls back to campaign.timezone
  starts_on         date not null,
  ends_on           date not null,
  freeze_at         timestamptz,                     -- computed from ends_on + campaign tz
  -- Payout model + its parameters. `payout_config` holds model-specific values:
  --   cpm             -> {"maxPerClipCents":null,"maxPerClipperCents":null}  (rates live in cycle_cpm)
  --   pot_proportional-> {"potCents":350000,"qualifyMinViews":5000,"maxPerClipperCents":null}
  --   pot_equal       -> {"potCents":350000,"qualifyMinViews":5000}
  --   placement       -> {"prizesCents":[100000,50000,25000],"qualifyMinViews":1000}
  --   flat_per_clip   -> {"amountCents":500}
  payout_model      payout_model_t not null default 'cpm',
  payout_config     jsonb not null default '{}',
  budget_cap_cents  bigint not null default 0,        -- spend ceiling for cpm/flat; equals the pot for pot/placement
  min_view_enabled  boolean not null default false,
  min_view_floor    bigint not null default 0,        -- general qualify threshold: below it a clip pays $0 but stays tracked
  allowed_platforms platform_t[] not null default '{youtube,tiktok,instagram,twitter,other}',
  enforce_post_window boolean not null default true,  -- flag clips posted outside the dates
  hashtag_mode      hashtag_mode_t not null default 'off',
  required_hashtags text[] not null default '{}',     -- stored lowercased, without '#'
  -- Automatic view-check schedule, interpreted in this cycle's timezone and run
  -- only while status='active'. YouTube is free so it can run often; TikTok/IG
  -- cost per check, so `paid` has its own (usually slower) cadence to control spend.
  -- Modes: 'manual' (button only) | 'daily' (atLocal times) | 'interval' (everyMinutes).
  auto_check_enabled boolean not null default true,
  check_schedule     jsonb not null default
    '{"free":{"mode":"interval","everyMinutes":360},"paid":{"mode":"daily","atLocal":["06:00"]}}',
  created_at        timestamptz not null default now()
);
create index on cycles (campaign_id, status);

-- ---- CPM rate per platform, per cycle --------------------------------------
create table cycle_cpm (
  cycle_id   uuid not null references cycles(id) on delete cascade,
  platform   platform_t not null,
  cpm_cents  bigint not null default 0,              -- dollars-per-1000-views, in cents
  primary key (cycle_id, platform)
);

-- ---- Clippers (remembered people; roster spans campaigns) ------------------
create table clippers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  payment_handle text,                                -- PayPal/etc, for payout time
  notes          text,
  active          boolean not null default true,
  archived        boolean not null default false,     -- soft-delete; keeps lifetime totals intact
  created_at      timestamptz not null default now()
);

-- ---- Known accounts linked to a clipper (anti-fraud match) ------------------
create table clipper_accounts (
  id         uuid primary key default gen_random_uuid(),
  clipper_id uuid not null references clippers(id) on delete cascade,
  platform   platform_t not null,
  handle     text not null,                           -- stored lowercased, without '@'
  added_at   timestamptz not null default now(),
  unique (platform, handle)                            -- one handle belongs to one clipper
);

-- ---- Cycle membership + each clipper's private submission link --------------
create table cycle_clippers (
  cycle_id         uuid not null references cycles(id) on delete cascade,
  clipper_id       uuid not null references clippers(id) on delete cascade,
  submission_token text not null unique,               -- unguessable; powers their personal link
  added_at         timestamptz not null default now(),
  primary key (cycle_id, clipper_id)
);

-- ---- Clips ------------------------------------------------------------------
create table clips (
  id              uuid primary key default gen_random_uuid(),
  cycle_id        uuid not null references cycles(id) on delete cascade,
  clipper_id      uuid not null references clippers(id) on delete restrict,
  platform        platform_t not null,
  url             text not null,
  normalized_key  text not null,                       -- 'youtube:VIDEOID' etc; dedup compares this
  account_handle  text,                                -- resolved from URL/fetch, lowercased
  status          clip_status_t not null default 'pending',
  source          clip_source_t not null default 'auto',
  added_via       clip_added_via_t not null default 'manual', -- manual | submission | scan
  views           bigint not null default 0,
  likes           bigint,                              -- null = hidden/unknown (never store -1 or 0-as-unknown)
  comments        bigint,                              -- null = disabled/unknown
  engagement      numeric(6,4),                        -- (likes+comments)/views as a fraction; null if unknown
  thumbnail_url   text,                                -- our re-hosted copy (source links expire)
  caption         text,
  posted_at       timestamptz,                         -- original post date, from the fetch
  last_checked_at timestamptz,
  manual_override boolean not null default false,      -- true once a human types the number
  flags           text[] not null default '{}',        -- duplicate,unknown_account,outside_dates,missing_hashtag,ig_suspect,removed,view_drop,fetch_failed
  created_at      timestamptz not null default now()
);
create index on clips (cycle_id, status);
create index on clips (cycle_id, normalized_key);      -- fast duplicate lookup within a cycle
create index on clips (normalized_key);                -- cross-cycle repeat detection
create index on clips (clipper_id);

-- ---- View history (time series that powers the charts) ---------------------
create table view_history (
  id         bigint generated always as identity primary key,
  clip_id    uuid not null references clips(id) on delete cascade,
  checked_at timestamptz not null default now(),
  views      bigint not null,
  likes      bigint,
  comments   bigint
);
create index on view_history (clip_id, checked_at);

-- ---- Payouts (one settlement per clipper per cycle) ------------------------
create table payouts (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references cycles(id) on delete cascade,
  clipper_id   uuid not null references clippers(id) on delete restrict,
  amount_cents bigint not null,
  paid_at      timestamptz not null default now(),
  method       text,
  notes        text,
  unique (cycle_id, clipper_id)                         -- a clipper is settled once per cycle
);

-- ---- Manual payout adjustments (the "any detail" catch-all) -----------------
-- A signed per-clipper tweak on top of whatever the model computes: a bonus
-- (+), a deduction (−), or a note. Covers anything the structured models don't.
create table payout_adjustments (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references cycles(id) on delete cascade,
  clipper_id   uuid not null references clippers(id) on delete cascade,
  amount_cents bigint not null,                         -- may be negative
  reason       text,
  created_at   timestamptz not null default now()
);
create index on payout_adjustments (cycle_id, clipper_id);

-- ---- Cycle change log (mid-cycle edits to money/dates) ---------------------
create table cycle_changes (
  id         bigint generated always as identity primary key,
  cycle_id   uuid not null references cycles(id) on delete cascade,
  changed_at timestamptz not null default now(),
  field      text not null,
  old_value  text,
  new_value  text,
  note       text
);
create index on cycle_changes (cycle_id, changed_at);

-- ---- Streamer viewer codes (single-use, read-only campaign access) ----------
-- The manager mints a short code for a streamer to watch a cycle's numbers with
-- zero ability to touch anything. Single-use (consumed on first open) + expiry.
create table viewer_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- short, shareable e.g. HIVE-7K2M
  cycle_id    uuid not null references cycles(id) on delete cascade,
  label       text,                                 -- e.g. "for Camy"
  show_money  boolean not null default false,       -- include $ spend/payouts, or reach-only
  used_at     timestamptz,                          -- set on first open (single-use)
  expires_at  timestamptz not null,
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on viewer_codes (cycle_id);

-- ---- Global app settings (single row) --------------------------------------
create table app_settings (
  id                 int primary key default 1 check (id = 1),
  apify_daily_cap    int not null default 200,          -- hard ceiling on paid checks/day
  updated_at         timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict do nothing;
-- Note: the app password is NOT stored here — it lives as a hashed environment
-- variable on the host, never in the database.

-- ---- Incremental migrations (idempotent — safe to re-run on live DBs) ------
-- Submission-link controls: revoke a clipper's link and/or give it an expiry.
alter table cycle_clippers add column if not exists token_revoked boolean not null default false;
alter table cycle_clippers add column if not exists token_expires_at timestamptz;
-- Manager-dismissed flags: cleared once, never auto re-added on later checks.
alter table clips add column if not exists dismissed_flags text[] not null default '{}';

-- Personal clipper stats links: multi-use, live-data, revocable, tracked.
create table if not exists clipper_codes (
  id           uuid primary key default gen_random_uuid(),
  clipper_id   uuid not null references clippers(id) on delete cascade,
  code         text not null unique,
  label        text,
  show_money   boolean not null default true,
  expires_at   timestamptz,                             -- null = never
  revoked      boolean not null default false,
  uses         int not null default 0,                  -- opens, for tracking
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists clipper_codes_clipper_idx on clipper_codes (clipper_id);
-- Stats-only twin of the submission link: view their cycle stats, can't submit.
alter table cycle_clippers add column if not exists stats_token text unique;
alter table cycle_clippers add column if not exists stats_token_revoked boolean not null default false;
alter table cycle_clippers add column if not exists stats_token_expires_at timestamptz;
alter table cycle_clippers add column if not exists stats_token_uses int not null default 0;
alter table cycle_clippers add column if not exists stats_token_last_used_at timestamptz;
