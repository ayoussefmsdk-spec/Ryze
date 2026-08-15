// Server-safe flag badges (no interactivity).
const FLAG_LABELS = {
  duplicate: ['duplicate', 'var(--warn, #f6a64b)'],
  repeat_from_past_cycle: ['recycled from a past cycle', 'var(--warn, #f6a64b)'],
  unknown_account: ['unknown account', 'var(--crit)'],
  outside_dates: ['posted outside cycle', 'var(--crit)'],
  missing_hashtag: ['missing hashtag', 'var(--crit)'],
  ig_suspect: ['IG views suspect — verify', 'var(--crit)'],
  removed: ['video removed?', 'var(--crit)'],
  view_drop: ['big view drop', 'var(--crit)'],
  fetch_failed: ['check failed', 'var(--text-3)'],
  engagement_suspect: ['engagement too low — bought views?', 'var(--crit)'],
  velocity_suspect: ['unnatural view spike', 'var(--crit)'],
  api_glitch: ['stats glitch — kept last good numbers (likely Apify, not the video)', 'var(--warn, #f6a64b)'],
  previously_deleted: ['was deleted from this cycle before — re-added', 'var(--crit)'],
};

export default function FlagBadges({ flags }) {
  if (!flags?.length) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
      {flags.map((f) => {
        const [label, color] = FLAG_LABELS[f] || [f, 'var(--text-3)'];
        return (
          <span key={f} style={{ fontSize: 11, fontFamily: 'var(--mono)', color, border: `1px solid ${color}`, borderRadius: 999, padding: '1px 8px', opacity: 0.95 }}>
            ⚑ {label}
          </span>
        );
      })}
    </span>
  );
}
