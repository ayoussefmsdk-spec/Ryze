// Turns raw Apify API failures into messages a manager can act on.
// Shared by every Apify-backed fetcher (TikTok/IG and both Facebook actors).
export function friendlyApifyError(actor, status, body) {
  if (status === 402 || /not-enough-usage/i.test(body)) {
    return 'Apify credit is used up — paid checks are paused until it renews or you top up at console.apify.com/billing. YouTube checks keep working (free).';
  }
  // Apify's actor-permission system: an actor can require a one-time manual
  // approval on YOUR Apify account before the API may run it again.
  if (/full-permission-actor-not-approved|approvePermissions/i.test(body)) {
    const m = body.match(/https:\/\/console\.apify\.com\/actors\/[\w-]+\?approvePermissions=true/);
    return `Apify needs a ONE-TIME approval from you before it will run ${actor} again: `
      + `open ${m ? m[0] : `console.apify.com, find the actor "${actor}"`} while logged into your Apify account, `
      + 'approve the permissions, then just recheck — nothing else changes.';
  }
  return `Apify ${actor} ${status}: ${String(body).slice(0, 300)}`;
}
