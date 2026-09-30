// Pure logic for account-scan: given candidate posts pulled from a clipper's
// linked accounts, decide which to ingest. No I/O — fully testable.

/**
 * selectScanCandidates({ candidates, requiredHashtags, startsOn, endsOn,
 *                        enforceWindow, existingKeys })
 * candidate: { key, platform, url, postedAt (ISO|null), hashtags: string[] }
 * Returns { accept: [candidate], reject: [{ ...candidate, reason }] }
 * Rules (in order): skip if already ingested; skip if the same post is already
 * tracked in ANOTHER campaign's cycle (reason 'in_other_campaign', with the
 * campaign name attached as `elsewhere`); drop if missing a required hashtag;
 * drop if posted outside the cycle window (when enforced).
 */
export function selectScanCandidates({
  candidates = [],
  requiredHashtags = [],
  startsOn = null,
  endsOn = null,
  enforceWindow = false,
  existingKeys = new Set(),
  deletedKeys = new Set(), // tombstones: manager deleted these from this cycle
  otherCycleKeys = new Map(), // key -> 'Campaign · Cycle' label
}) {
  const accept = [];
  const reject = [];
  const need = (requiredHashtags || []).map((h) => String(h).toLowerCase());
  const start = startsOn ? Date.parse(startsOn) : null;
  const end = endsOn ? Date.parse(endsOn) + 86_399_000 : null; // inclusive end day
  const seen = new Set();

  for (const c of candidates) {
    if (!c || !c.key) { reject.push({ key: c?.key ?? null, reason: 'invalid' }); continue; }
    // The same post pulled twice in one scan (e.g. one channel linked under two
    // spellings) is ONE candidate — later copies are dropped silently. Giving
    // them a reject row would relabel the key with a contradictory reason
    // ("already in" for a post that isn't) and double it in the skipped list.
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    if (existingKeys.has(c.key)) { reject.push({ ...c, reason: 'duplicate' }); continue; }
    // Cross-campaign wins over this cycle's tombstone: the money-affecting
    // warning ("this already counts for another client") must never be
    // swallowed by the friendlier "you deleted this, bring it back" bucket.
    if (otherCycleKeys.has(c.key)) {
      reject.push({ ...c, reason: 'in_other_campaign', elsewhere: otherCycleKeys.get(c.key) });
      continue;
    }
    // Deleted-before is its own bucket: "already in" must mean IN — a post the
    // manager deleted from Pending is not in, it's remembered-as-removed.
    if (deletedKeys.has(c.key)) { reject.push({ ...c, reason: 'deleted_before' }); continue; }

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
