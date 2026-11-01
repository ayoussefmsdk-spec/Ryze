// Per-account memory of which Apify scraper can read a Facebook account.
import { query } from './db.mjs';

// Re-try the (richer) reels scraper now and then — Facebook changes, and an
// account that was unreadable may become readable.
const REMEMBER_DAYS = 14;

/** Set of facebook handles that should be read with the posts scraper first. */
export async function fbPostsFirst(handles) {
  const list = [...new Set((handles || []).filter(Boolean).map(String))];
  if (!list.length) return new Set();
  const { rows } = await query(
    `select distinct handle from clipper_accounts
      where platform = 'facebook' and handle = any($1) and fb_scan_via = 'posts'
        and fb_scan_via_at > now() - ($2 || ' days')::interval`,
    [list, String(REMEMBER_DAYS)],
  );
  return new Set(rows.map((r) => r.handle));
}

/** Record which scraper actually read the account ('reels' | 'posts'). */
export async function rememberFbVia(handle, via) {
  if (!handle || !['reels', 'posts'].includes(via)) return;
  await query(
    `update clipper_accounts set fb_scan_via = $2, fb_scan_via_at = now()
      where platform = 'facebook' and handle = $1`,
    [String(handle), via],
  );
}
