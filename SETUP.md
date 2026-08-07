# Ryze — account setup guide

Three accounts to create. None need a credit card except Railway (the $5/mo host).
Do them in this order. When you finish each, you'll have a **key** to hand me —
paste them somewhere safe as you go; we'll drop them into Railway at the end.

Total time: ~20 minutes.

---

## 1. Google — free YouTube API key  (≈5 min, $0)

This lets the app read YouTube view counts. Free forever at our scale.

1. Go to **console.cloud.google.com** and sign in with any Google account.
2. Top bar → **Select a project** → **New Project** → name it `ryze` → **Create**.
3. Left menu → **APIs & Services → Library**. Search **"YouTube Data API v3"**,
   click it → **Enable**.
4. Left menu → **APIs & Services → Credentials → + Create Credentials → API key**.
5. Copy the key it shows. Click **Edit** on it → under **API restrictions** choose
   **Restrict key** → tick **YouTube Data API v3** → **Save**. (Safety: the key can
   only ever touch YouTube data.)

➡️ **You now have:** `YOUTUBE_API_KEY` — a long string starting with `AIza...`

---

## 2. Apify — TikTok & Instagram scraping  (≈5 min, free $5 credit)

This reads TikTok/Instagram numbers. You get $5 of free credit each month and
we use ~$1.40 — so effectively free. No card required to start.

1. Go to **apify.com** → **Sign up** (Google or email).
2. Once in the Console, left menu → **Settings → Integrations** (or **API & Integrations**).
3. Copy your **Personal API token** (a long string).
4. That's it — you don't need to configure the actors; the app calls them for you.
   (During our first test we'll confirm your usage is drawing from the free credit.)

➡️ **You now have:** `APIFY_TOKEN`

---

## 3. Railway — hosting + database  ($5/mo)

This is the one you pay for: it runs the app AND holds the database, always on.

1. Go to **railway.app** → **Login** (GitHub sign-in is easiest).
2. Add the **Hobby plan** ($5/month) in **Account → Billing** (needs a card).
3. **New Project → Deploy from GitHub repo** → pick this repo (`ryze`) and the
   branch we've been building on. (I'll tell you the exact branch when the app code
   is ready.)
4. In the same project → **New → Database → Add PostgreSQL**. Railway creates it
   and wires a `DATABASE_URL` in automatically.
5. Project → **Variables** — this is the private vault. Add:
   - `YOUTUBE_API_KEY` = *(from step 1)*
   - `APIFY_TOKEN` = *(from step 2)*
   - `APP_PASSWORD` = *(the password you'll use to log into the app)*
   - `CRON_SECRET` = *(any long random string — I'll tell you when needed)*
6. Deploy. Railway gives you a URL like `ryze-production.up.railway.app` — that's
   your app. Open it, enter your password, you're in.

➡️ **Result:** a live, private app at your own URL, with the database attached.

---

## What you hand me
Just confirm when each account exists. **Never paste the actual keys into chat** —
they go straight into Railway's Variables (step 5), which only you can see. I only
need to know they're ready and named as above.

## Optional later
- **Custom domain** (`ryze.gg` etc.) — ~$12/year, added in Railway's Settings.
- Everything else (YouTube quota, Apify credit) stays inside free limits at your scale.
