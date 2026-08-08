// YouTube Data API v3 — official, free. Batches up to 50 ids per call at a
// flat 1 quota unit; missing ids are silently omitted by the API (we use that
// as the "video removed" signal).
import { normalizeYouTube } from '../../core/normalize.mjs';

const API = 'https://www.googleapis.com/youtube/v3/videos';

/**
 * fetchYouTubeStats(ids) -> { stats: Map(videoId -> normalized), missing: Set(videoId) }
 * Throws if the API key is absent or the API errors.
 */
export async function fetchYouTubeStats(ids) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not set');
  const stats = new Map();
  const requested = [...new Set(ids)];

  for (let i = 0; i < requested.length; i += 50) {
    const batch = requested.slice(i, i + 50);
    const url = `${API}?part=snippet,statistics&id=${batch.join(',')}&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`YouTube API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    for (const item of data.items || []) {
      stats.set(item.id, normalizeYouTube(item));
    }
  }

  const missing = new Set(requested.filter((id) => !stats.has(id)));
  return { stats, missing };
}
