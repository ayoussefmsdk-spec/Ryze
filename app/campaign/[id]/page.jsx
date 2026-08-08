import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '../../../lib/auth.mjs';
import { query } from '../../../lib/db.mjs';
import CycleForm from '../../../components/CycleForm.jsx';
import { formatCents } from '../../../core/payout.mjs';

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

  return (
    <>
      <div className="topbar">
        <span className="brand">▲ RyZeX</span>
        <Link href="/" className="muted" style={{ fontSize: 14 }}>Campaigns</Link>
        <span className="muted">›</span>
        <span style={{ fontSize: 14 }}>{campaign.name}</span>
      </div>

      <div className="wrap grid" style={{ gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Campaign · {campaign.timezone}</div>
            <h1>{campaign.name}</h1>
            {campaign.streamer_handle && <div className="muted" style={{ fontSize: 14 }}>{campaign.streamer_handle}</div>}
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <CycleForm campaignId={campaign.id} campaignTimezone={campaign.timezone} />
          </div>
        </div>

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
                    {cy.timezone ? ` · ${cy.timezone}` : ''}
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
    </>
  );
}
