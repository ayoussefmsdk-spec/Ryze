// ============================================================================
// Ryze — response normalizers (pure, no I/O)
// ============================================================================
// Each source (YouTube Data API, Apify TikTok, Apify Instagram) returns a
// different shape. These map them onto ONE common ClipStats object so the rest
// of the app never cares where a number came from. Field names below are the
// real ones verified from each API's output.
//
// Common shape:
//   {
//     views, likes|null, comments|null, shares|null,
//     postedAt|null (ISO), accountHandle|null (lowercased, no '@'),
//     caption|null, hashtags[] (lowercased, no '#'),
//     thumbnailUrl|null, addedFlags[] (e.g. ['ig_suspect'])
//   }
// Missing likes/comments are null (unknown), never 0 or -1.
// ============================================================================

/** Pull #hashtags out of free text (used for YouTube, where there's no field). */
export function parseHashtags(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  for (const m of String(text).matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    const tag = m[1].toLowerCase();
    if (!seen.has(tag)) { seen.add(tag); out.push(tag); }
  }
  return out;
}

function intOrZero(x) {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
// Counts that can legitimately be hidden: absent, null, or a sentinel -1 => unknown.
function countOrNull(x) {
  if (x == null) return null;
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

// ---- YouTube (videos.list item: parts snippet + statistics) -----------------
export function normalizeYouTube(item) {
  const s = item?.statistics ?? {};
  const n = item?.snippet ?? {};
  const title = n.title ?? '';
  const desc = n.description ?? '';
  const thumbs = n.thumbnails ?? {};
  const thumb = thumbs.maxres || thumbs.standard || thumbs.high || thumbs.medium || thumbs.default || null;
  return {
    views: intOrZero(s.viewCount),
    likes: countOrNull(s.likeCount),        // absent when the creator hides likes
    comments: countOrNull(s.commentCount),  // absent when comments are disabled
    shares: null,
    postedAt: n.publishedAt ?? null,
    accountHandle: (n.channelTitle ?? '').toLowerCase() || null,
    accountId: n.channelId ?? null,
    caption: title,
    hashtags: parseHashtags(`${title}\n${desc}`),
    thumbnailUrl: thumb?.url ?? null,
    addedFlags: [],
  };
}

// ---- TikTok (Apify clockworks/tiktok-scraper item) --------------------------
export function normalizeTikTok(item) {
  const author = item?.authorMeta ?? {};
  const video = item?.videoMeta ?? {};
  const tags = Array.isArray(item?.hashtags)
    ? item.hashtags.map((h) => String(h?.name ?? h).toLowerCase()).filter(Boolean)
    : [];
  return {
    views: intOrZero(item?.playCount),
    likes: countOrNull(item?.diggCount),
    comments: countOrNull(item?.commentCount),
    shares: countOrNull(item?.shareCount),
    postedAt: item?.createTimeISO ?? null,
    accountHandle: (author.name ?? '').toLowerCase() || null,
    accountId: author.id ?? null,
    caption: item?.text ?? null,
    hashtags: tags,
    thumbnailUrl: video.coverUrl ?? video.originalCoverUrl ?? null,
    addedFlags: [],
  };
}

// ---- Instagram (Apify apify/instagram-scraper item) -------------------------
// IG view counts are unreliable (often 0 / null / mismatched). We normalize the
// best available value and RAISE ig_suspect whenever it looks untrustworthy, so
// the clip is flagged for manual verification instead of paid on a bad number.
export function normalizeInstagram(item) {
  const play = item?.videoPlayCount;
  const view = item?.videoViewCount;
  const rawViews = play != null ? play : view;
  const views = intOrZero(rawViews);

  const tags = Array.isArray(item?.hashtags)
    ? item.hashtags.map((h) => String(h).toLowerCase()).filter(Boolean)
    : parseHashtags(item?.caption);

  const flags = [];
  const isVideo = item?.type === 'Video' || item?.productType === 'clips';
  // Suspect when: it's a video/reel but views are missing or zero.
  if (isVideo && (rawViews == null || views === 0)) flags.push('ig_suspect');

  return {
    views,
    likes: countOrNull(item?.likesCount), // -1 when likes are hidden => null
    comments: countOrNull(item?.commentsCount),
    shares: null,
    postedAt: item?.timestamp ?? null,
    accountHandle: (item?.ownerUsername ?? '').toLowerCase() || null,
    accountId: item?.ownerId ?? null,
    caption: item?.caption ?? null,
    hashtags: tags,
    thumbnailUrl: item?.displayUrl ?? (Array.isArray(item?.images) ? item.images[0] : null) ?? null,
    addedFlags: flags,
  };
}

// ---- Guard checks over a normalized stat + clip context ---------------------
// Returns the list of flag codes to attach. Pure: caller passes in what it knows.
export function evaluateFlags({ stats, cycle, clipperAccounts, previousViews }) {
  const flags = new Set(stats?.addedFlags ?? []);

  // account match — only when we know the handle and the clipper's known set
  if (stats?.accountHandle && Array.isArray(clipperAccounts)) {
    const known = clipperAccounts.map((h) => String(h).toLowerCase());
    if (known.length && !known.includes(stats.accountHandle)) flags.add('unknown_account');
  }

  // posted within the cycle window
  if (cycle?.enforcePostWindow && stats?.postedAt && cycle?.startsOn && cycle?.endsOn) {
    const t = Date.parse(stats.postedAt);
    const start = Date.parse(cycle.startsOn);
    const end = Date.parse(cycle.endsOn) + 86_399_000; // inclusive of end day
    if (Number.isFinite(t) && (t < start || t > end)) flags.add('outside_dates');
  }

  // required hashtag
  if (cycle?.hashtagMode && cycle.hashtagMode !== 'off' && Array.isArray(cycle.requiredHashtags) && cycle.requiredHashtags.length) {
    const have = new Set((stats?.hashtags ?? []).map((h) => h.toLowerCase()));
    const missing = cycle.requiredHashtags.some((h) => !have.has(String(h).toLowerCase()));
    if (missing) flags.add('missing_hashtag');
  }

  // big view drop vs last known (possible deletion / restriction / fraud)
  if (previousViews != null && stats?.views != null) {
    if (previousViews > 100 && stats.views < previousViews * 0.5) flags.add('view_drop');
  }

  return [...flags];
}
