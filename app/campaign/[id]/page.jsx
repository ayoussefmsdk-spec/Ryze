import Link from 'next/link';
import Brand from '../../../components/Brand.jsx';
import { notFound } from 'next/navigation';
import { requireSession } from '../../../lib/auth.mjs';
import { query } from '../../../lib/db.mjs';
import CycleForm from '../../../components/CycleForm.jsx';
import CloneCycleForm from '../../../components/CloneCycleForm.jsx';
import { formatCents } from '../../../core/payout.mjs';
import Shell from '../../../components/Shell.jsx';
import { gmtLabel } from '../../../lib/tz.mjs';
import TrendChart from '../../../components/TrendChart.jsx';
import { campaignDailySeries } from '../../../lib/history.mjs';

export const dynamic = 'force-dynamic';

const MODEL_SHORT = {
  cpm: 'CPM',
  pot_proportional: 'Pot · view share',
  pot_equal: 'Pot · equal split',
  placement: 'Placement prizes',
  flat_per_clip: 'Flat per clip',
};

export default async function CampaignPage({ params }) {
  requireSession();

  const campaign = (await query(`select * from campaigns where id = $1`, [params.id])).rows[0];
  if (!campaign) notFound();

  const { rows: cycles } = await query(
    `select cy.*,
            (select count(*) from clips cl where cl.cycle_id = cy.id) as clip_count
       from cycles cy where cy.campaign_id = $1 order by cy.starts_on desc`,
    [params.id],
  );

  const series = await campaignDailySeries(params.id);

  return (
    <Shell breadcrumb={<>
      <Link href="/campaigns" className="muted" style={{ fontSize: 14 }}>Campaigns</Link>
      <span className="muted">›</span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{campaign.name}</span>
    </>}>
      <div className="grid" style={{ gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Campaign · {gmtLabel(campaign.timezone)}</div>
            <h1>{campaign.name}</h1>
            {campaign.streamer_handle && <div className="muted" style={{ fontSize: 14 }}>{campaign.streamer_handle}</div>}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href={`/report/campaign/${campaign.id}`} className="btn secondary" style={{ padding: '8px 13px', fontSize: 13.5 }}>
              📊 All-time report
            </Link>
            {cycles.length > 0 && (
              <CloneCycleForm campaignId={campaign.id} sourceCycleId={cycles[0].id} sourceName={cycles[0].name} />
            )}
            <CycleForm campaignId={campaign.id} campaignTimezone={campaign.timezone} />
          </div>
        </div>

        {series.length >= 2 && (
          <div className="card grid" style={{ gap: 10 }}>
            <h2 style={{ margin: 0 }}>Campaign views — all cycles</h2>
            <TrendChart points={series} />
          </div>
        )}

        {cycles.length === 0 && (
          <div className="card">
            <h2>No cycles yet</h2>
            <p className="muted">A cycle is one round of the campaign — with its own dates, budget, payout style and clippers. Create the first one.</p>
          </div>
        )}

        {cycles.length > 0 && (
          <div className="grid" style={{ gap: 12 }}>
            {cycles.map((cy) => (
              <Link key={cy.id} href={`/cycle/${cy.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 180 }}>
                  <h2 style={{ margin: 0 }}>{cy.name}</h2>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {String(cy.starts_on).slice(0, 10)} → {String(cy.ends_on).slice(0, 10)}
                    {cy.timezone ? ` · ${gmtLabel(cy.timezone)}` : ''}
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 14 }}>{MODEL_SHORT[cy.payout_model] || cy.payout_model}</div>
                <div className="muted" style={{ fontSize: 14 }}>
                  {cy.budget_cap_cents > 0 ? formatCents(cy.budget_cap_cents) : '—'}
                </div>
                <div className="muted" style={{ fontSize: 14 }}>{cy.clip_count} clips</div>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                    padding: '3px 10px',
                    borderRadius: 999,
                    border: '1px solid var(--line-2)',
                    color: cy.status === 'active' ? 'var(--good)' : 'var(--text-2)',
                  }}
                >
                  {cy.status}
                </span>
              </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
