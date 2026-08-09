// Pure logic for account-scan: given candidate posts pulled from a clipper's
// linked accounts, decide which to ingest. No I/O — fully testable.

/**
 * selectScanCandidates({ candidates, requiredHashtags, startsOn, endsOn,
 *                        enforceWindow, existingKeys })
 * candidate: { key, platform, url, postedAt (ISO|null), hashtags: string[] }
 * Returns { accept: [candidate], reject: [{ ...candidate, reason }] }
 * Rules (in order): skip if already ingested; drop if missing a required
 * hashtag; drop if posted outside the cycle window (when enforced).
 */
export function selectScanCandidates({
  candidates = [],
  requiredHashtags = [],
  startsOn = null,
  endsOn = null,
  enforceWindow = false,
  existingKeys = new Set(),
}) {
  const accept = [];
  const reject = [];
  const need = (requiredHashtags || []).map((h) => String(h).toLowerCase());
  const start = startsOn ? Date.parse(startsOn) : null;
  const end = endsOn ? Date.parse(endsOn) + 86_399_000 : null; // inclusive end day
  const seen = new Set();

  for (const c of candidates) {
    if (!c || !c.key) { reject.push({ key: c?.key ?? null, reason: 'invalid' }); continue; }
    if (existingKeys.has(c.key) || seen.has(c.key)) { reject.push({ ...c, reason: 'duplicate' }); continue; }
    seen.add(c.key);

    if (need.length) {
      const have = new Set((c.hashtags || []).map((h) => String(h).toLowerCase()));
      if (need.some((h) => !have.has(h))) { reject.push({ ...c, reason: 'missing_hashtag' }); continue; }
    }

    if (enforceWindow && c.postedAt && start != null && end != null) {
      const t = Date.parse(c.postedAt);
      if (Number.isFinite(t) && (t < start || t > end)) { reject.push({ ...c, reason: 'outside_dates' }); continue; }
    }

    accept.push(c);
  }
  return { accept, reject };
}

/** Rough Apify cost estimate for a scan (TikTok/IG only; YouTube is free). */
export function estimateScanCostCents({ paidPosts, perThousand = 160 }) {
  return Math.ceil((paidPosts * perThousand) / 1000);
}
