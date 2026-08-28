// ============================================================================
// ClipHive — response normalizers (pure, no I/O)
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
export function normalizeYouTube(item, channelHandle = null) {
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
    // Prefer the channel's real @handle (resolved separately) — channelTitle
    // is the display NAME and never matches linked handles.
    accountHandle: (channelHandle ?? n.channelTitle ?? '').replace(/^@/, '').toLowerCase() || null,
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
  // IG reports several view-ish numbers (plays vs the older "views" metric,
  // and igPlayCount on some actor versions) and any of them can be missing or
  // absurdly low on a given fetch. Take the LARGEST — paying a 300k reel as
  // "600 views" because the plays field was absent is the real failure mode.
  const play = item?.videoPlayCount;
  const view = item?.videoViewCount;
  const ig = item?.igPlayCount;
  // Wide net: the actor renames/moves the plays field across versions
  // (ig_play_count, playCount, …). Take the largest of ANY numeric top-level
  // field whose name says play/view — whatever it's called this month.
  let widest = 0;
  for (const [k, v] of Object.entries(item || {})) {
    if (/play|view/i.test(k) && typeof v === 'number' && Number.isFinite(v) && v > widest) widest = Math.trunc(v);
  }
  const views = Math.max(intOrZero(play), intOrZero(view), intOrZero(ig), widest);

  const tags = Array.isArray(item?.hashtags)
    ? item.hashtags.map((h) => String(h).toLowerCase()).filter(Boolean)
    : parseHashtags(item?.caption);

  const flags = [];
  const isVideo = item?.type === 'Video' || item?.productType === 'clips';
  // Suspect when: it's a video/reel but views are missing or zero.
  if (isVideo && (play == null && view == null && ig == null || views === 0)) flags.push('ig_suspect');
  // Suspect when: more likes than views — physically impossible, so the view
  // count is under-reported and needs manual verification.
  const likesNum = countOrNull(item?.likesCount);
  if (isVideo && views > 0 && likesNum != null && likesNum > views && !flags.includes('ig_suspect')) {
    flags.push('ig_suspect');
  }

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

// ---- Facebook (Apify facebook scrapers; shapes vary per actor) --------------
// Field names differ across FB actors, so this maps defensively: the LARGEST
// numeric play/view-ish field wins (the same lesson IG taught us), and likes/
// comments try every common spelling.
export function normalizeFacebook(item) {
  let views = 0;
  for (const [k, v] of Object.entries(item || {})) {
    if (/play|view/i.test(k) && typeof v === 'number' && Number.isFinite(v) && v > views) views = Math.trunc(v);
  }
  const likes = countOrNull(item?.likesCount ?? item?.likes ?? item?.reactionsCount ?? item?.reactions);
  const comments = countOrNull(item?.commentsCount ?? item?.comments ?? item?.total_comment_count);
  const caption = item?.text ?? item?.caption ?? item?.title ?? null;
  // creation_time arrives as unix SECONDS on direct-post items.
  const created = typeof item?.creation_time === 'number' && item.creation_time > 1e9
    ? new Date(item.creation_time * 1000).toISOString() : null;
  const handle = (item?.pageUsername ?? item?.username ?? item?.pageName ?? item?.user?.name ?? '')
    .toLowerCase().replace(/\s+/g, '') || null;
  return {
    views,
    likes,
    comments,
    shares: countOrNull(item?.sharesCount ?? item?.shares),
    postedAt: item?.time ?? item?.timestamp ?? item?.publishedTime ?? item?.date ?? created,
    accountHandle: handle,
    accountId: item?.pageId ?? item?.userId ?? null,
    caption,
    hashtags: parseHashtags(caption),
    thumbnailUrl: item?.thumbnailUrl ?? item?.thumbnail ?? item?.previewImage ?? null,
    addedFlags: [],
  };
}

// ---- Guard checks over a normalized stat + clip context ---------------------
// Returns the list of flag codes to attach. Pure: caller passes in what it knows.
export function evaluateFlags({ stats, cycle, clipperAccounts, previousViews }) {
  const flags = new Set(stats?.addedFlags ?? []);

  // account match — only when we know the handle and the clipper's known set.
  // Compare loosely: lowercase, no leading @, no spaces (spaces are never part
  // of a real handle — they only appear in display names).
  if (stats?.accountHandle && Array.isArray(clipperAccounts)) {
    const canon = (h) => String(h).toLowerCase().replace(/^@/, '').replace(/\s+/g, '');
    const known = clipperAccounts.map(canon);
    if (known.length && !known.includes(canon(stats.accountHandle))) flags.add('unknown_account');
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

/**
 * classifyStatsAnomaly({ prevViews, newViews }) — is this fetched number almost
 * certainly a scraper glitch rather than reality? Short-form views basically
 * never collapse; a sudden zero or a >30% one-check drop on an established post
 * means the scraper (Apify) returned bad/incomplete data.
 *  - 'zero_glitch': the post had real views (≥100) and suddenly reads 0
 *  - 'big_drop':    an established post (≥1,000) lost >30% in one check
 * Small posts and small dips pass through untouched (real corrections happen).
 */
export function classifyStatsAnomaly({ prevViews, newViews }) {
  const prev = Number(prevViews);
  const next = Number(newViews);
  if (!Number.isFinite(prev) || !Number.isFinite(next)) return null;
  if (prev >= 100 && next === 0) return 'zero_glitch';
  if (prev >= 1000 && next < prev * 0.7) return 'big_drop';
  return null;
}

/**
 * sanitizeCheckSchedule(v) — validate a per-cycle check schedule from the UI.
 * Shape: { free: {mode, atLocal?, everyMinutes?}, paid: {...} }
 * mode: 'daily' (fires once per atLocal time, in the cycle tz) | 'manual' |
 * 'interval' (legacy). Unknown input falls back to sane defaults.
 */
export function sanitizeCheckSchedule(v) {
  const group = (g, defTimes, defMode = 'daily') => {
    if (!g || typeof g !== 'object') {
      return defMode === 'manual' ? { mode: 'manual' } : { mode: 'daily', atLocal: defTimes };
    }
    if (g.mode === 'manual') return { mode: 'manual' };
    if (g.mode === 'interval') {
      const m = Math.min(1440, Math.max(15, Math.trunc(Number(g.everyMinutes)) || 360));
      return { mode: 'interval', everyMinutes: m };
    }
    const times = [...new Set((Array.isArray(g.atLocal) ? g.atLocal : [])
      .map((t) => String(t).trim())
      .filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort().slice(0, 48);
    return { mode: 'daily', atLocal: times.length ? times : defTimes };
  };
  return {
    free: group(v?.free, ['06:00', '12:00', '18:00', '23:00']),
    paid: group(v?.paid, ['06:00']),
    // Facebook: same machinery as TikTok/IG, its own schedule. Defaults to
    // manual-only so existing cycles never start spending without a choice.
    fb: group(v?.fb, ['06:00'], 'manual'),
  };
}
