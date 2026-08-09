// Server component: the cycle "intelligence band" — stat cases instead of
// prose, plus ROI, pace and the money-state pipeline. Pure render.
import { formatCents, formatEngagement } from '../core/payout.mjs';

const nf = (n) => Number(n || 0).toLocaleString('en-US');
const nfc = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));
const PLAT_LABEL = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', twitter: 'X', other: 'Other' };

const STATE_META = {
  estimating: { label: 'Estimating', color: 'var(--violet)', hint: 'still growing' },
  pending: { label: 'Held', color: '#f6a64b', hint: 'flags / review' },
  locked: { label: 'Locked', color: 'var(--good)', hint: 'final — guaranteed' },
  paid: { label: 'Paid', color: 'var(--honey)', hint: 'settled' },
};

function Case({ label, value, sub, color = 'var(--text)', accent = 'var(--line-2)' }) {
  return (
    <div style={{
      padding: '11px 14px', borderRadius: 11, background: 'var(--surface-2)',
      borderLeft: `3px solid ${accent}`, minWidth: 0,
    }}>
      <div className="eyebrow" style={{ letterSpacing: '0.08em', fontSize: 10.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 720, marginTop: 3, fontVariantNumeric: 'tabular-nums', color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 11.5, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  );
}

export default function IntelBand({ facts, pace, moneyStates }) {
  const hasPace = pace && pace.viewsPerDay != null && pace.viewsPerDay > 0;
  const states = (moneyStates || []).filter((s) => s.cents > 0 && STATE_META[s.state]);
  const stateTotal = states.reduce((a, s) => a + s.cents, 0);

  if (!facts && !hasPace && !states.length) return null;

  return (
    <div className="card grid" style={{ gap: 14, borderColor: 'rgba(240,182,74,.3)' }}>
      {facts && (
        <div className="grid" style={{ gap: 10 }}>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--honey)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            🐝 The cycle in numbers
          </span>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <Case label="Reach" value={`${nf(facts.totalViews)} views`} color="var(--honey)" accent="var(--honey)"
              sub={facts.deltaPct != null ? `${facts.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(facts.deltaPct)}% vs last cycle` : null} />
            {facts.totalClips != null && (
              <Case label="Clips" value={nf(facts.totalClips)}
                sub={`${facts.clipCount} live${facts.pendingCount ? ` · ${facts.pendingCount} in review` : ''}`} accent="#2ad4c8" />
            )}
            {facts.engagement != null && (
              <Case label="Engagement" value={formatEngagement(facts.engagement)} accent="#e1568f"
                sub="likes + comments / views" />
            )}
            <Case label="Hive" value={`${facts.roster ?? facts.clipperCount} clipper${(facts.roster ?? facts.clipperCount) === 1 ? '' : 's'}`}
              sub="on this cycle's roster" />
            {facts.topPlatform && (
              <Case label="Top platform" value={PLAT_LABEL[facts.topPlatform.platform] || facts.topPlatform.platform}
                sub={`${facts.topPlatform.sharePct}% of all views`} accent="#2ad4c8" />
            )}
            {facts.bestClip && (
              <Case label="Breakout clip" value={`${nfc(facts.bestClip.views)} views`}
                sub={facts.bestClip.handle ? `@${facts.bestClip.handle}` : facts.bestClip.clipper} accent="var(--violet)" color="var(--violet)" />
            )}
            <Case label={facts.isPot ? 'Distributed' : 'Invested'} value={formatCents(facts.investedCents)} accent="var(--honey)"
              sub={facts.costPer1kCents != null ? `${formatCents(facts.costPer1kCents)} per 1k views` : null} />
          </div>
        </div>
      )}

      {hasPace && (
        <div style={{ fontSize: 14 }}>
          ⚡ Pace: <b>{nf(pace.viewsPerDay)}</b> views/day
          {pace.daysToCap != null && (
            <span style={{ color: pace.capBeforeEnd ? 'var(--crit)' : 'var(--text-2)' }}>
              {' '}· budget cap in ~{pace.daysToCap} day{pace.daysToCap === 1 ? '' : 's'}{pace.capBeforeEnd ? ' — before the cycle ends!' : ''}
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
