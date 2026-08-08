import { notFound } from 'next/navigation';
import { requireSession } from '../../../../lib/auth.mjs';
import { query } from '../../../../lib/db.mjs';
import { computeCyclePayouts } from '../../../../lib/payouts.mjs';
import { formatCents } from '../../../../core/payout.mjs';
import PrintButton from '../../../../components/PrintButton.jsx';

export const dynamic = 'force-dynamic';

function nfmt(n) { return Number(n || 0).toLocaleString('en-US'); }

/** Clean printable cycle report — use the button (or Ctrl/Cmd+P) → Save as PDF. */
export default async function ReportPage({ params }) {
  requireSession();

  const cycle = (await query(
    `select cy.*, ca.name as campaign_name from cycles cy
       join campaigns ca on ca.id = cy.campaign_id where cy.id = $1`,
    [params.id],
  )).rows[0];
  if (!cycle) notFound();

  const p = await computeCyclePayouts(params.id);
  const paid = new Map(
    (await query(`select clipper_id, amount_cents, paid_at from payouts where cycle_id = $1`, [params.id]))
      .rows.map((r) => [r.clipper_id, r]),
  );

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', background: '#fff', color: '#111', minHeight: '100vh' }}>
      <style>{`
        @media print { .no-print { display: none !important; } body { background: #fff; } }
        .rpt-table { border-collapse: collapse; width: 100%; font-size: 14px; }
        .rpt-table th, .rpt-table td { border-bottom: 1px solid #ddd; text-align: left; padding: 8px 10px; }
        .rpt-table th { font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #666; }
        .rpt-num { text-align: right !important; font-variant-numeric: tabular-nums; }
      `}</style>

      <div className="no-print" style={{ marginBottom: 20 }}>
        <PrintButton />
      </div>

      <h1 style={{ margin: '0 0 4px', fontSize: 26 }}>{cycle.campaign_name} — {cycle.name}</h1>
      <div style={{ color: '#555', fontSize: 14, marginBottom: 26 }}>
        {cycle.starts_on} → {cycle.ends_on} · {cycle.status === 'frozen' ? 'Final numbers (tracking stopped)' : 'Interim numbers (cycle still active)'} · Generated {new Date().toLocaleDateString()}
      </div>

      <h2 style={{ fontSize: 17 }}>Summary</h2>
      <table className="rpt-table" style={{ marginBottom: 26 }}>
        <tbody>
          <tr><td>Total views</td><td className="rpt-num">{nfmt(p.totalViews)}</td></tr>
          <tr><td>Total payout</td><td className="rpt-num">{formatCents(p.totalPayoutCents)}</td></tr>
          <tr><td>Budget / pot</td><td className="rpt-num">{formatCents(cycle.budget_cap_cents)} ({p.budget.pct}% used)</td></tr>
          <tr><td>Clippers</td><td className="rpt-num">{p.perClipper.length}</td></tr>
          <tr><td>Approved clips</td><td className="rpt-num">{p.perClipper.reduce((a, c) => a + c.clipCount, 0)}</td></tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: 17 }}>By platform</h2>
      <table className="rpt-table" style={{ marginBottom: 26 }}>
        <thead><tr><th>Platform</th><th className="rpt-num">Clips</th><th className="rpt-num">Views</th><th className="rpt-num">Payout</th></tr></thead>
        <tbody>
          {p.perPlatform.map((r) => (
            <tr key={r.platform}>
              <td style={{ textTransform: 'capitalize' }}>{r.platform}</td>
              <td className="rpt-num">{r.clips}</td>
              <td className="rpt-num">{nfmt(r.views)}</td>
              <td className="rpt-num">{r.payoutCents ? formatCents(r.payoutCents) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 17 }}>By clipper</h2>
      <table className="rpt-table">
        <thead><tr><th>#</th><th>Clipper</th><th className="rpt-num">Clips</th><th className="rpt-num">Views</th><th className="rpt-num">Payout</th><th>Status</th></tr></thead>
        <tbody>
          {p.perClipper.map((c, i) => {
            const pd = paid.get(c.clipperId);
            return (
              <tr key={c.clipperId}>
                <td>{i + 1}</td>
                <td>{c.name}{c.paymentHandle ? ` (${c.paymentHandle})` : ''}</td>
                <td className="rpt-num">{c.clipCount}</td>
                <td className="rpt-num">{nfmt(c.views)}</td>
                <td className="rpt-num">{formatCents(c.payoutCents)}</td>
                <td>{pd ? `paid ${new Date(pd.paid_at).toLocaleDateString()}` : 'unpaid'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
