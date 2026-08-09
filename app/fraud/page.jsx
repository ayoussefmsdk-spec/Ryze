import Link from 'next/link';
import { requireSession } from '../../lib/auth.mjs';
import { query } from '../../lib/db.mjs';
import { computeCyclePayouts } from '../../lib/payouts.mjs';
import { formatCents, formatEngagement } from '../../core/payout.mjs';
import Shell from '../../components/Shell.jsx';
import FlagControls from '../../components/FlagControls.jsx';
import ClipActions from '../../components/ClipActions.jsx';

export const dynamic = 'force-dynamic';
const nf = (n) => Number(n || 0).toLocaleString('en-US');

export default async function FraudPage() {
  requireSession();

  let rows = [];
  let error = null;
  try {
    ({ rows } = await query(
      `select c.*, cl.name as clipper_name, cy.name as cycle_name, cy.id as cycle_id2,
              ca.name as campaign_name
         from clips c
         join clippers cl on cl.id = c.clipper_id
         join cycles cy on cy.id = c.cycle_id
         join campaigns ca on ca.id = cy.campaign_id
        where array_length(c.flags, 1) > 0 and c.status <> 'rejected' and cy.status = 'active'
        order by c.views desc limit 100`,
    ));
  } catch (e) { error = e.message; }

  // Dollars at risk per clip = its computed payout under its cycle's model.
  const byCycle = new Map();
  for (const c of rows) if (!byCycle.has(c.cycle_id)) byCycle.set(c.cycle_id, null);
  for (const id of byCycle.keys()) {
    try { byCycle.set(id, await computeCyclePayouts(id)); } catch { /* skip */ }
  }
  const withRisk = rows.map((c) => ({
    ...c,
    riskCents: byCycle.get(c.cycle_id)?.clipPayouts?.[c.id] ?? 0,
  })).sort((a, b) => b.riskCents - a.riskCents || Number(b.views) - Number(a.views));
  const totalRisk = withRisk.reduce((a, c) => a + c.riskCents, 0);

  return (
    <Shell breadcrumb={<span style={{ fontSize: 14, fontWeight: 600 }}>Fraud radar</span>}>
      <div className="grid" style={{ gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Trust &amp; integrity</div>
            <h1>Fraud radar</h1>
            <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>
              Every flagged clip in active cycles, ranked by the money it would take if approved as-is.
            </p>
          </div>
          <div className="card" style={{ marginLeft: 'auto', padding: '14px 20px', borderColor: totalRisk > 0 ? 'rgba(240,115,111,.45)' : 'var(--line)' }}>
            <div className="eyebrow">$ at risk</div>
            <div style={{ fontSize: 26, fontWeight: 740, color: totalRisk > 0 ? 'var(--crit)' : 'var(--good)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCents(totalRisk)}
            </div>
          </div>
        </div>

        {error && <div className="card" style={{ borderColor: 'var(--crit)' }}><p className="muted">{error}</p></div>}

        {!error && withRisk.length === 0 && (
          <div className="card">
            <h2>All clear 🐝</h2>
            <p className="muted">No flagged clips in any active cycle. The guards are watching — anything suspicious lands here ranked by dollar exposure.</p>
          </div>
        )}

        {withRisk.map((c) => (
          <div key={c.id} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {c.thumbnail_url && <img src={c.thumbnail_url} alt="" style={{ width: 46, height: 62, objectFit: 'cover', borderRadius: 8 }} />}
            <div className="grid" style={{ gap: 4, flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <strong>{c.clipper_name}</strong>
                <span className="muted" style={{ fontSize: 13 }}>{c.campaign_name} · <Link href={`/cycle/${c.cycle_id}`}>{c.cycle_name}</Link></span>
                <span className="muted" style={{ fontSize: 12.5, fontFamily: 'var(--mono)' }}>{c.status}</span>
              </div>
              <FlagControls clip={c} />
              <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, wordBreak: 'break-all' }}>{c.url}</a>
              <div className="muted" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                {nf(c.views)} views · {c.likes == null ? '—' : nf(c.likes)} likes · ♥ {formatEngagement(c.engagement)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="eyebrow">at risk</div>
              <div style={{ fontSize: 20, fontWeight: 720, color: c.riskCents > 0 ? 'var(--crit)' : 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCents(c.riskCents)}
              </div>
            </div>
            <ClipActions clip={c} compact />
          </div>
        ))}
      </div>
    </Shell>
  );
}
