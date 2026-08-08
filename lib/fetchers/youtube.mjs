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

/**
 * Scan a channel's recent uploads (for account-scan). handle may be a channel
 * id (UC…), an @handle, or a legacy username. Returns [normalized + url].
 */
export async function fetchChannelRecent(handle, n = 20) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not set');
  const h = String(handle).trim();

  // Resolve the channel's "uploads" playlist id.
  let param;
  if (/^UC[\w-]{22}$/.test(h)) param = `id=${h}`;
  else if (h.startsWith('@')) param = `forHandle=${encodeURIComponent(h)}`;
  else param = `forHandle=${encodeURIComponent('@' + h)}`;

  const chRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${param}&key=${key}`,
    { signal: AbortSignal.timeout(20000) },
  );
  if (!chRes.ok) throw new Error(`YouTube channels ${chRes.status}`);
  let chData = await chRes.json();
  if (!chData.items?.length && !h.startsWith('@') && !/^UC/.test(h)) {
    // fall back to legacy username
    const alt = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forUsername=${encodeURIComponent(h)}&key=${key}`,
      { signal: AbortSignal.timeout(20000) },
    );
    if (alt.ok) chData = await alt.json();
  }
  const uploads = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];

  const plRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=${Math.min(50, n)}&playlistId=${uploads}&key=${key}`,
    { signal: AbortSignal.timeout(20000) },
  );
  if (!plRes.ok) return [];
  const plData = await plRes.json();
  const ids = (plData.items || []).map((it) => it.contentDetails?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const { stats } = await fetchYouTubeStats(ids);
  return ids
    .filter((id) => stats.has(id))
    .map((id) => ({ ...stats.get(id), url: `https://www.youtube.com/watch?v=${id}`, platform: 'youtube' }));
}
