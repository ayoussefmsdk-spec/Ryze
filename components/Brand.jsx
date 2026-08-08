// ============================================================================
// ClipHive brand — single source of truth.
// Logo system: N "Hive Reel" = official mark · B "Solid Cell" = compact stamp
// (avatars/watermarks) · E "Worker Bee" = mascot for clipper-facing corners.
// ============================================================================

export const BRAND = {
  name: 'ClipHive',
  descriptor: 'clipping agency',
  tagline: 'Where clips make money.',          // professional face (login, pitches)
  taglineFun: 'Post the clip. Keep the honey.', // community face (clipper pages, socials)
};

/** N — The Hive Reel: a comb cell that is also a film frame (official logo). */
export function BrandMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 24" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="bm-n" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--honey-deep, #c98f2b)" />
          <stop offset="1" stopColor="var(--honey, #f0b64a)" />
        </linearGradient>
      </defs>
      <path d="M13 1.8 L22 7 V17 L13 22.2 L4 17 V7 Z" fill="none" stroke="url(#bm-n)" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M7.2 7.6 h11.6 M7.2 16.4 h11.6" stroke="url(#bm-n)" strokeWidth="1.1" opacity="0.8" />
      <path d="M8.6 7.6 v-1.7 M11.6 7.6 v-1.7 M14.6 7.6 v-1.7 M17.6 7.6 v-1.7 M8.6 16.4 v1.7 M11.6 16.4 v1.7 M14.6 16.4 v1.7 M17.6 16.4 v1.7" stroke="url(#bm-n)" strokeWidth="1" />
      <path d="M10.8 9.6 L16.4 12 L10.8 14.4 Z" fill="url(#bm-n)" />
    </svg>
  );
}

/** B — The Solid Cell: compact stamp for tight spots and watermarks. */
export function BrandStamp({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M12 1.8 L20.6 6.8 V16.8 L12 21.8 L3.4 16.8 V6.8 Z" fill="var(--honey, #f0b64a)" />
      <path d="M9.9 8.3 L16.2 11.8 L9.9 15.3 Z" fill="var(--bg, #0e0c0a)" />
    </svg>
  );
}

/** E — The Worker Bee: mascot for clipper-facing, community corners. */
export function BeeMascot({ size = 26 }) {
  return (
    <svg width={size} height={size * 0.86} viewBox="0 0 28 24" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="bm-e" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--honey-deep, #c98f2b)" />
          <stop offset="1" stopColor="var(--honey, #f0b64a)" />
        </linearGradient>
      </defs>
      <ellipse cx="9" cy="7" rx="5.2" ry="2.6" fill="none" stroke="url(#bm-e)" strokeWidth="1.4" transform="rotate(-28 9 7)" />
      <ellipse cx="17.5" cy="6.4" rx="5.2" ry="2.6" fill="none" stroke="url(#bm-e)" strokeWidth="1.4" transform="rotate(24 17.5 6.4)" />
      <path d="M9.5 10.5 L19.5 15.5 L9.5 20.5 Z" fill="url(#bm-e)" />
    </svg>
  );
}

/** Wordmark lockup: hex-in-the-name style. */
export default function Brand({ size = 16, withDescriptor = false }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <BrandMark size={size + 4} />
      <span className="brand" style={{ fontSize: size }}>
        Clip<span style={{ color: 'var(--text)' }}>Hive</span>
      </span>
      {withDescriptor && (
        <span className="muted" style={{ fontSize: size - 3, letterSpacing: '0.06em' }}>{BRAND.descriptor}</span>
      )}
    </span>
  );
}
