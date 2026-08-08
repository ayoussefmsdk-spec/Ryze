// ============================================================================
// The single source of truth for the brand. Change BRAND.name here and the
// whole app — every page, tab title, submit page, report — follows.
// ============================================================================

export const BRAND = {
  name: 'RyzeClips',            // alternates considered: RyZeX, RyzeCuts — one-line swap
  descriptor: 'clipping agency',
  tagline: 'Clip. Post. Get paid.',
};

/**
 * The mark: an upward triangle (rise / views climbing) with a clean slice
 * through it (the clip — something cut out of a stream). Inline SVG so it
 * renders crisp everywhere with zero assets.
 */
export function BrandMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="bm-g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--gold-dim, #b48f45)" />
          <stop offset="1" stopColor="var(--gold, #e4b85e)" />
        </linearGradient>
      </defs>
      {/* lower part of the sliced triangle */}
      <path d="M12 4 L21.5 21 H2.5 Z M12 4" fill="none" />
      <path d="M7.1 12.4 L2.5 21 H21.5 L16.6 12.2 L6.9 15.4 Z" fill="url(#bm-g)" opacity="0.55" />
      {/* upper tip, offset slightly — the "clipped" slice */}
      <path d="M12.6 2.6 L16.1 9.0 L6.6 12.1 Z" fill="url(#bm-g)" />
    </svg>
  );
}

/** Standard wordmark lockup used in top bars and card headers. */
export default function Brand({ size = 16, withDescriptor = false }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <BrandMark size={size + 2} />
      <span className="brand" style={{ fontSize: size }}>
        Ryze<span style={{ color: 'var(--text)' }}>Clips</span>
      </span>
      {withDescriptor && (
        <span className="muted" style={{ fontSize: size - 3, letterSpacing: '0.06em' }}>{BRAND.descriptor}</span>
      )}
    </span>
  );
}
