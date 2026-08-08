// Timezone display helpers — users see "GMT+1", the app stores real IANA zones
// underneath (so daylight-saving shifts stay correct automatically).

export const ZONES = [
  'Africa/Casablanca',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
];

/** "GMT+1" / "GMT-5" for a zone, at today's date (DST-aware). */
export function gmtLabel(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date());
    const name = parts.find((p) => p.type === 'timeZoneName')?.value || tz;
    return name.replace('GMT', 'GMT').replace(/^UTC$/, 'GMT+0') || tz;
  } catch {
    return tz;
  }
}

/** Full option label: "GMT+1 · Casablanca". */
export function zoneOption(tz) {
  const city = tz.split('/').pop().replace(/_/g, ' ');
  const g = gmtLabel(tz);
  return tz === 'UTC' ? 'GMT+0 · UTC' : `${g} · ${city}`;
}

/** Sorted [value, label] pairs for selects. */
export function zoneChoices() {
  return ZONES
    .map((tz) => ({ tz, label: zoneOption(tz), off: offsetMinutes(tz) }))
    .sort((a, b) => a.off - b.off)
    .map(({ tz, label }) => [tz, label]);
}

function offsetMinutes(tz) {
  const g = gmtLabel(tz); // e.g. GMT+5:30 / GMT-4
  const m = g.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
}
