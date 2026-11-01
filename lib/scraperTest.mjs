// Live self-test of the paid scrapers: re-fetch ONE recent, known-good clip
// per platform through the exact fetchers checks use, and compare the fresh
// numbers with what's stored. READ-ONLY — nothing is written to clips.
import { query } from './db.mjs';
import { fetchTikTokStats, fetchInstagramStats } from './fetchers/apify.mjs';
import { fetchFacebookStats } from './fetchers/facebook.mjs';
import { withFbHandles } from './check.mjs';

const FETCHERS = {
  tiktok: (clip) => fetchTikTokStats([clip.url]),
  instagram: (clip) => fetchInstagramStats([clip.url]),
  facebook: async (clip) => fetchFacebookStats(await withFbHandles([clip])),
};

/** Pure verdict from stored vs fresh numbers (exported for tests). */
export function judgeScrape({ storedViews, fresh }) {
  if (!fresh) return { verdict: 'fail', why: 'the scraper ran but did not return this post' };
  const v = Number(fresh.views) || 0;
  const was = Number(storedViews) || 0;
  if (v === 0 && was > 0) return { verdict: 'warn', why: `returned 0 views (stored ${was}) — likely a scraper glitch` };
  if (was >= 1000 && v < was * 0.7) return { verdict: 'warn', why: `views dropped from ${was} to ${v} in one read — suspicious` };
  return { verdict: 'ok', why: v >= was ? 'fresh numbers look right' : 'small dip — normal correction' };
}

export async function runScraperSelfTest() {
  const results = [];
  for (const platform of Object.keys(FETCHERS)) {
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
    if (!clip) { results.push({ platform, verdict: 'skip', why: 'no approved clip with views to test against yet' }); continue; }
    const t = Date.now();
    try {
      const map = await FETCHERS[platform](clip);
      const fresh = map.get(clip.normalized_key) || null;
      const { verdict, why } = judgeScrape({ storedViews: clip.views, fresh });
      results.push({
        platform, verdict, why, ms: Date.now() - t,
        clip: { id: clip.id, url: clip.url, storedViews: Number(clip.views), lastChecked: clip.last_checked_at },
        fresh: fresh ? { views: fresh.views, likes: fresh.likes, comments: fresh.comments } : null,
      });
    } catch (err) {
      results.push({
        platform, verdict: 'fail', why: String(err.message || err).slice(0, 300), ms: Date.now() - t,
        clip: { id: clip.id, url: clip.url, storedViews: Number(clip.views), lastChecked: clip.last_checked_at },
      });
    }
  }
  return { ranAt: new Date().toISOString(), tokenSet: Boolean(process.env.APIFY_TOKEN), results };
}
