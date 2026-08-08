import { notFound } from 'next/navigation';
import { requireSession } from '../../../../lib/auth.mjs';
import { campaignReport } from '../../../../lib/reports.mjs';
import { formatCents, formatEngagement } from '../../../../core/payout.mjs';
import PrintButton from '../../../../components/PrintButton.jsx';

export const dynamic = 'force-dynamic';
const nf = (n) => Number(n || 0).toLocaleString('en-US');

/** Printable CAMPAIGN ALL-TIME report — every cycle, platform, top clippers. */
export default async function CampaignReportPage({ params }) {
  requireSession();
  const r = await campaignReport(params.id);
  if (!r) notFound();
  const { campaign, cycles, platforms, topClippers, totals } = r;

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
        <span style={{ color: '#888', fontSize: 12 }}>campaign report · all-time</span>
      </div>
      <h1 style={{ margin: '8px 0 2px', fontSize: 26 }}>{campaign.name}</h1>
      <div style={{ color: '#555', fontSize: 13, marginBottom: 22 }}>
        {campaign.streamer_handle ? `${campaign.streamer_handle} · ` : ''}{cycles.length} cycle{cycles.length === 1 ? '' : 's'} · generated {new Date().toLocaleDateString()}
      </div>

      <table className="rt">
        <tbody>
          <tr><td>Total views (approved clips)</td><td className="num"><b>{nf(totals.views)}</b></td></tr>
          <tr><td>Total clips</td><td className="num">{nf(totals.clips)}</td></tr>
          <tr><td>Overall engagement</td><td className="num">{formatEngagement(totals.engagement)}</td></tr>
          <tr><td>Total paid out</td><td className="num"><b>{formatCents(totals.paid)}</b></td></tr>
          {totals.views > 0 && totals.paid > 0 && (
            <tr><td>Cost per 1,000 views</td><td className="num">{formatCents(Math.round(totals.paid / (totals.views / 1000)))}</td></tr>
          )}
        </tbody>
      </table>

      <h2>Cycle by cycle</h2>
      <table className="rt">
        <thead><tr><th>Cycle</th><th>Dates</th><th className="num">Clippers</th><th className="num">Clips</th><th className="num">Views</th><th className="num">Paid</th></tr></thead>
        <tbody>
          {cycles.map((cy) => (
            <tr key={cy.id}>
              <td>{cy.name}{cy.status === 'active' ? ' (live)' : ''}</td>
              <td>{cy.starts_on} → {cy.ends_on}</td>
              <td className="num">{cy.clippers}</td>
              <td className="num">{cy.clips}</td>
              <td className="num">{nf(cy.views)}</td>
              <td className="num">{formatCents(cy.paid)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>By platform</h2>
      <table className="rt">
        <thead><tr><th>Platform</th><th className="num">Clips</th><th className="num">Views</th></tr></thead>
        <tbody>
          {platforms.map((p) => (
            <tr key={p.platform}><td style={{ textTransform: 'capitalize' }}>{p.platform}</td><td className="num">{p.clips}</td><td className="num">{nf(p.views)}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Top clippers (all-time in this campaign)</h2>
      <table className="rt">
        <thead><tr><th>#</th><th>Clipper</th><th className="num">Clips</th><th className="num">Views</th><th className="num">Paid</th></tr></thead>
        <tbody>
          {topClippers.map((c, i) => (
            <tr key={c.id}><td>{i + 1}</td><td>{c.name}</td><td className="num">{c.clips}</td><td className="num">{nf(c.views)}</td><td className="num">{formatCents(c.paid)}</td></tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 30, color: '#999', fontSize: 11.5 }}>ClipHive — where clips make money · joincliphive.com</div>
    </div>
  );
}
