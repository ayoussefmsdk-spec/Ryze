// Server component: the cycle "intelligence band" — recap prose, ROI proof,
// pace/ETA, and the money-state pipeline. Pure render over precomputed data.
import { formatCents } from '../core/payout.mjs';

const nf = (n) => Number(n || 0).toLocaleString('en-US');

const STATE_META = {
  estimating: { label: 'Estimating', color: 'var(--violet)', hint: 'still growing' },
  pending: { label: 'Held', color: '#f6a64b', hint: 'flags / review' },
  locked: { label: 'Locked', color: 'var(--good)', hint: 'final — guaranteed' },
  paid: { label: 'Paid', color: 'var(--honey)', hint: 'settled' },
};

export default function IntelBand({ recap, roi, pace, moneyStates }) {
  const hasRoi = roi && roi.multiple != null && roi.multiple >= 1.5;
  const hasPace = pace && pace.viewsPerDay != null && pace.viewsPerDay > 0;
  const states = (moneyStates || []).filter((s) => s.cents > 0 && STATE_META[s.state]);
  const stateTotal = states.reduce((a, s) => a + s.cents, 0);

  if (!recap && !hasRoi && !hasPace && !states.length) return null;

  return (
    <div className="card grid" style={{ gap: 14, borderColor: 'rgba(240,182,74,.3)' }}>
      {recap && (
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--honey)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            🐝 The story so far
          </span>
          {recap}
        </p>
      )}

      {(hasRoi || hasPace) && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 14 }}>
          {hasRoi && (
            <span>
              💰 This reach ≈ <b style={{ color: 'var(--honey)' }}>{formatCents(roi.adEquivalentCents)}</b> in paid ads
              — you're <b style={{ color: 'var(--good)' }}>{roi.multiple}× cheaper</b>
              {roi.costPer1kCents != null && <span className="muted"> ({formatCents(roi.costPer1kCents)} per 1k views)</span>}
            </span>
          )}
          {hasPace && (
            <span>
              ⚡ Pace: <b>{nf(pace.viewsPerDay)}</b> views/day
              {pace.daysToCap != null && (
                <span style={{ color: pace.capBeforeEnd ? 'var(--crit)' : 'var(--text-2)' }}>
                  {' '}· budget cap in ~{pace.daysToCap} day{pace.daysToCap === 1 ? '' : 's'}{pace.capBeforeEnd ? ' — before the cycle ends!' : ''}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {states.length > 0 && stateTotal > 0 && (
        <div className="grid" style={{ gap: 6 }}>
          <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-2)' }}>
            {states.map((s) => (
              <div key={s.state} style={{ width: `${(s.cents / stateTotal) * 100}%`, background: STATE_META[s.state].color }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5 }}>
            {states.map((s) => (
              <span key={s.state} className="muted">
                <span style={{ color: STATE_META[s.state].color }}>●</span>{' '}
                {STATE_META[s.state].label} {formatCents(s.cents)} <span style={{ opacity: 0.7 }}>({STATE_META[s.state].hint})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
