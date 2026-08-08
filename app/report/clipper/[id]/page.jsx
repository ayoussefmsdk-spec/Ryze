import { notFound } from 'next/navigation';
import { requireSession } from '../../../../lib/auth.mjs';
import { clipperReport } from '../../../../lib/reports.mjs';
import { formatCents, formatEngagement } from '../../../../core/payout.mjs';
import PrintButton from '../../../../components/PrintButton.jsx';

export const dynamic = 'force-dynamic';
const nf = (n) => Number(n || 0).toLocaleString('en-US');

/**
 * Printable CLIPPER report.
 *   /report/clipper/[id]                → all-time across every campaign
 *   /report/clipper/[id]?campaign=<id>  → detailed, scoped to one campaign (with clips)
 */
export default async function ClipperReportPage({ params, searchParams }) {
  requireSession();
  const campaignId = searchParams?.campaign || null;
  const r = await clipperReport(params.id, campaignId);
  if (!r) notFound();
  const { clipper, campaign, cycles, campaigns, clips, totals } = r;
  const scoped = Boolean(campaignId);

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px', background: '#fff', color: '#111', minHeight: '100vh' }}>
      <style>{`
        @media print { .no-print { display: none !important; } }
        .rt { border-collapse: collapse; width: 100%; font-size: 13.5px; }
        .rt th, .rt td { border-bottom: 1px solid #ddd; text-align: left; padding: 7px 10px; }
        .rt th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #666; }
        .num { text-align: right !important; font-variant-numeric: tabular-nums; }
        h2 { font-size: 16px; margin: 26px 0 8px; }
      `}</style>
      <div className="no-print" style={{ marginBottom: 18 }}><PrintButton /></div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#b8860b' }}>⬡ ClipHive</span>
        <span style={{ color: '#888', fontSize: 12 }}>clipper report · {scoped ? `campaign: ${campaign?.name}` : 'all-time'}</span>
      </div>
      <h1 style={{ margin: '8px 0 2px', fontSize: 26 }}>{clipper.name}</h1>
      <div style={{ color: '#555', fontSize: 13, marginBottom: 22 }}>
        {clipper.payment_handle ? `pays to ${clipper.payment_handle} · ` : ''}generated {new Date().toLocaleDateString()}
      </div>

      <table className="rt">
        <tbody>
          <tr><td>Total views (approved)</td><td className="num"><b>{nf(totals.views)}</b></td></tr>
          <tr><td>Approved clips</td><td className="num">{nf(totals.clips)}</td></tr>
          <tr><td>Engagement</td><td className="num">{formatEngagement(totals.engagement)}</td></tr>
          <tr><td>Total earned</td><td className="num"><b>{formatCents(totals.paid)}</b></td></tr>
          <tr><td>Cycles worked</td><td className="num">{cycles.length}</td></tr>
        </tbody>
      </table>

      {!scoped && campaigns.length > 0 && (
        <>
          <h2>By campaign</h2>
          <table className="rt">
            <thead><tr><th>Campaign</th><th className="num">Clips</th><th className="num">Views</th><th className="num">Earned</th></tr></thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}><td>{c.name}</td><td className="num">{c.clips}</td><td className="num">{nf(c.views)}</td><td className="num">{formatCents(c.paid)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Cycle history</h2>
      <table className="rt">
        <thead><tr>{!scoped && <th>Campaign</th>}<th>Cycle</th><th>Dates</th><th className="num">Clips</th><th className="num">Views</th><th className="num">Paid</th></tr></thead>
        <tbody>
          {cycles.map((cy) => (
            <tr key={cy.id}>
              {!scoped && <td>{cy.campaign_name}</td>}
              <td>{cy.name}</td>
              <td>{cy.starts_on} → {cy.ends_on}</td>
              <td className="num">{cy.clips}</td>
              <td className="num">{nf(cy.views)}</td>
              <td className="num">{Number(cy.paid) > 0 ? formatCents(cy.paid) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {scoped && clips.length > 0 && (
        <>
          <h2>Every clip in this campaign</h2>
          <table className="rt">
            <thead><tr><th>Cycle</th><th>Platform</th><th>Account</th><th className="num">Views</th><th className="num">Likes</th><th className="num">Eng.</th><th>Status</th></tr></thead>
            <tbody>
              {clips.map((c, i) => (
                <tr key={i}>
                  <td>{c.cycle_name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{c.platform}</td>
                  <td>{c.account_handle ? `@${c.account_handle}` : '—'}</td>
                  <td className="num">{nf(c.views)}</td>
                  <td className="num">{c.likes == null ? '—' : nf(c.likes)}</td>
                  <td className="num">{formatEngagement(c.engagement)}</td>
                  <td>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ marginTop: 30, color: '#999', fontSize: 11.5 }}>ClipHive — where clips make money · joincliphive.com</div>
    </div>
  );
}
