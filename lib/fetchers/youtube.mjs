// YouTube Data API v3 — official, free. Batches up to 50 ids per call at a
// flat 1 quota unit; missing ids are silently omitted by the API (we use that
// as the "video removed" signal).
import { normalizeYouTube } from '../../core/normalize.mjs';

const API = 'https://www.googleapis.com/youtube/v3/videos';

/**
 * fetchYouTubeStats(ids) -> { stats: Map(videoId -> normalized), missing: Set(videoId) }
 * Throws if the API key is absent or the API errors.
 * The videos API only exposes the channel's display NAME; account matching
 * needs the real @handle, so channel handles are batch-resolved too (1 extra
 * free quota unit per 50 channels) and cached for the process lifetime.
 */
const channelHandleCache = new Map(); // channelId -> '@handle' (no @, lowercased) | null

async function resolveChannelHandles(channelIds, key) {
  const todo = [...new Set(channelIds)].filter((id) => id && !channelHandleCache.has(id));
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${batch.join(',')}&key=${key}`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (!res.ok) continue; // matching falls back to channelTitle
      const data = await res.json();
      for (const ch of data.items || []) {
        const custom = ch?.snippet?.customUrl || null; // e.g. '@theinvestigator00'
        channelHandleCache.set(ch.id, custom ? custom.replace(/^@/, '').toLowerCase() : null);
      }
    } catch { /* non-fatal — fall back to channelTitle */ }
  }
}

export async function fetchYouTubeStats(ids) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not set');
  const stats = new Map();
  const requested = [...new Set(ids)];
  const items = [];

  for (let i = 0; i < requested.length; i += 50) {
    const batch = requested.slice(i, i + 50);
    const url = `${API}?part=snippet,statistics&id=${batch.join(',')}&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`YouTube API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    items.push(...(data.items || []));
  }

  await resolveChannelHandles(items.map((it) => it?.snippet?.channelId), key);
  for (const item of items) {
    stats.set(item.id, normalizeYouTube(item, channelHandleCache.get(item?.snippet?.channelId) ?? null));
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
