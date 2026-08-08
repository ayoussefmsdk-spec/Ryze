// ============================================================================
// ClipHive brand — single source of truth. The story: the hive is the crew of
// clippers, honey is the money, each clip is a cell in the comb.
// ============================================================================

export const BRAND = {
  name: 'ClipHive',
  descriptor: 'clipping agency',
  tagline: 'Clip together. Get paid.',
};

/**
 * The mark: a honeycomb cell (hexagon) holding a play button — one cell of the
 * hive, one clip of the stream. Pure geometry: crisp at any size, no assets.
 */
export function BrandMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="bm-g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--honey-deep, #c98f2b)" />
          <stop offset="1" stopColor="var(--honey, #f0b64a)" />
        </linearGradient>
      </defs>
      {/* hex cell */}
      <path
        d="M12 1.8 L20.6 6.8 V16.8 L12 21.8 L3.4 16.8 V6.8 Z"
        fill="none"
        stroke="url(#bm-g)"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      {/* the clip inside: play triangle */}
      <path d="M9.9 8.3 L16.2 11.8 L9.9 15.3 Z" fill="url(#bm-g)" />
    </svg>
  );
}

/** Wordmark lockup for top bars and card headers. */
export default function Brand({ size = 16, withDescriptor = false }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <BrandMark size={size + 3} />
      <span className="brand" style={{ fontSize: size }}>
        Clip<span style={{ color: 'var(--text)' }}>Hive</span>
      </span>
      {withDescriptor && (
        <span className="muted" style={{ fontSize: size - 3, letterSpacing: '0.06em' }}>{BRAND.descriptor}</span>
      )}
    </span>
  );
}
