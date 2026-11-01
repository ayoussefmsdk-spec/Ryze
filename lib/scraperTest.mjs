// Live self-test of the paid scrapers: re-fetch ONE recent, known-good clip
// per platform through the exact fetchers checks use, and compare the fresh
// numbers with what's stored. READ-ONLY — nothing is written to clips.
import { query } from './db.mjs';
import { fetchTikTokStats, fetchInstagramStats } from './fetchers/apify.mjs';
import { fetchFacebookStats } from './fetchers/facebook.mjs';

const FETCHERS = {
  tiktok: (clip) => fetchTikTokStats([clip.url]),
  instagram: (clip) => fetchInstagramStats([clip.url]),
  // Light test: read the post directly, NO page scan (which can take several
  // runs). Answers "can Apify read Facebook right now?" in one run.
  facebook: (clip) => fetchFacebookStats([{ url: clip.url, handle: null, handles: [] }]),
};

/** Pure verdict from stored vs fresh numbers (exported for tests). */
export function judgeScrape({ storedViews, fresh, platform = null }) {
  if (!fresh) return { verdict: 'fail', why: 'the scraper ran but did not return this post' };
  const v = Number(fresh.views) || 0;
  const was = Number(storedViews) || 0;
  // A direct Facebook read carries likes/comments but often no play count —
  // views come from page scans. Getting the post back means FB is working.
  if (platform === 'facebook' && v === 0 && (fresh.likes != null || fresh.comments != null)) {
    return { verdict: 'ok', why: 'post read fine (likes/comments) — Facebook views come from page scans, not this light test' };
  }
  if (v === 0 && was > 0) return { verdict: 'warn', why: `returned 0 views (stored ${was}) — likely a scraper glitch` };
  if (was >= 1000 && v < was * 0.7) return { verdict: 'warn', why: `views dropped from ${was} to ${v} in one read — suspicious` };
  return { verdict: 'ok', why: v >= was ? 'fresh numbers look right' : 'small dip — normal correction' };
}

export async function runScraperSelfTest() {
  // All platforms at once: the wait is the slowest one, not the sum.
  const one = async (platform) => {
    // The most recently checked approved clip that had real views — a post we
    // know the scraper could read before. Junk "not a post" rows are skipped.
    const { rows } = await query(
      `select * from clips
        where platform = $1 and status = 'approved' and views > 0
          and last_checked_at is not null and not ('not_a_post' = any(flags))
        order by last_checked_at desc limit 1`,
      [platform],
    );
    const clip = rows[0];
    if (!clip) return { platform, verdict: 'skip', why: 'no approved clip with views to test against yet' };
    const t = Date.now();
    try {
      const map = await FETCHERS[platform](clip);
      const fresh = map.get(clip.normalized_key) || null;
      const { verdict, why } = judgeScrape({ storedViews: clip.views, fresh, platform });
      return ({
        platform, verdict, why, ms: Date.now() - t,
        clip: { id: clip.id, url: clip.url, storedViews: Number(clip.views), lastChecked: clip.last_checked_at },
        fresh: fresh ? { views: fresh.views, likes: fresh.likes, comments: fresh.comments } : null,
      });
    } catch (err) {
      return ({
        platform, verdict: 'fail', why: String(err.message || err).slice(0, 300), ms: Date.now() - t,
        clip: { id: clip.id, url: clip.url, storedViews: Number(clip.views), lastChecked: clip.last_checked_at },
      });
    }
  };
  const results = await Promise.all(Object.keys(FETCHERS).map(one));
  return { ranAt: new Date().toISOString(), tokenSet: Boolean(process.env.APIFY_TOKEN), results };
}
