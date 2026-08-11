import { clipperPortal } from '../../../lib/portal.mjs';
import Brand, { BRAND, BeeMascot } from '../../../components/Brand.jsx';
import { formatCents } from '../../../core/payout.mjs';
import PortalPlatforms from '../../../components/PortalPlatforms.jsx';

export const dynamic = 'force-dynamic';

const nf = (n) => Number(n || 0).toLocaleString('en-US');

/** PUBLIC, view-only — a clipper's stats for ONE cycle. No submitting here. */
export default async function CycleStatsPage({ params }) {
  const portal = await clipperPortal(params.token, { kind: 'stats' });

  if (!portal) {
    return (
      <div className="center-screen">
        <div className="card" style={{ maxWidth: 380 }}>
          <Brand size={16} />
          <h2 style={{ marginTop: 12 }}>Link not valid</h2>
          <p className="muted">This stats link doesn’t work anymore. Ask the campaign manager for a fresh one.</p>
        </div>
      </div>
    );
  }

  const { cycle, clipperName, clips, stats } = portal;

  return (
    <div className="center-screen" style={{ alignItems: 'flex-start', paddingTop: 40, paddingBottom: 60 }}>
      <div className="grid" style={{ width: 520, maxWidth: '94vw', gap: 14 }}>
        <div className="card grid" style={{ gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Brand size={18} />
              <span className="muted" style={{ fontSize: 12, fontFamily: 'var(--mono)', marginLeft: 'auto', border: '1px solid var(--line-2)', borderRadius: 999, padding: '2px 10px' }}>view-only · live</span>
            </div>
            <h2 style={{ margin: '10px 0 2px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <BeeMascot size={30} /> Hey {clipperName} 👋
            </h2>
            <div className="muted" style={{ fontSize: 14 }}>
              Your stats for <strong>{cycle.name}</strong>
              {' '}({String(cycle.starts_on).slice(0, 10)} → {String(cycle.ends_on).slice(0, 10)}) — always current, refresh any time.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Your hive stats</h2>
            {stats.rank && stats.rosterSize > 1 && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 13, color: stats.rank <= 3 ? 'var(--honey)' : 'var(--text-3)' }}>
                #{stats.rank} of {stats.rosterSize} in the hive
              </span>
            )}
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
            {[
              ['Views', nf(stats.views)],
              ['Clips live', String(stats.approved)],
              ['In review', String(stats.pending)],
              ['Earned so far', formatCents(stats.estimatedCents), true],
            ].map(([k, v, accent]) => (
              <div key={k} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)' }}>
                <div className="eyebrow" style={{ letterSpacing: '0.08em' }}>{k}</div>
                <div style={{ fontSize: 19, fontWeight: 700, marginTop: 3, fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--honey)' : 'var(--text)' }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            “Earned so far” is a live estimate — it moves with views until the cycle is paid out.
            {stats.paidCents > 0 && <> Already paid this cycle: <strong style={{ color: 'var(--text)' }}>{formatCents(stats.paidCents)}</strong>.</>}
          </div>

          {clips.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <div className="eyebrow" style={{ letterSpacing: '0.08em', marginBottom: 8 }}>Your platforms — tap one to see its clips</div>
              <PortalPlatforms clips={clips} byPlatform={portal.byPlatform} />
            </div>
          )}
        </div>

        <div className="brand" style={{ fontSize: 12, letterSpacing: '0.04em', textAlign: 'center' }}>{BRAND.taglineFun} 🍯</div>
      </div>
    </div>
  );
}
