import Link from 'next/link';
import { requireSession } from '../../lib/auth.mjs';
import { query } from '../../lib/db.mjs';
import Shell from '../../components/Shell.jsx';

export const dynamic = 'force-dynamic';

/** Reports hub — every report type, one click each. All open printable pages. */
export default async function ReportsPage() {
  requireSession();

  const [campaignsRes, clippersRes] = await Promise.all([
    query(
      `select ca.id, ca.name,
              (select cy.id from cycles cy where cy.campaign_id = ca.id order by cy.starts_on desc limit 1) as latest_cycle_id,
              (select cy.name from cycles cy where cy.campaign_id = ca.id order by cy.starts_on desc limit 1) as latest_cycle_name,
              (select count(*) from cycles cy where cy.campaign_id = ca.id) as cycle_count
         from campaigns ca where not ca.archived order by ca.created_at desc`,
    ),
    query(
      `select cl.id, cl.name,
              coalesce(json_agg(distinct jsonb_build_object('id', ca.id, 'name', ca.name))
                       filter (where ca.id is not null), '[]') as campaigns
         from clippers cl
         left join clips c on c.clipper_id = cl.id
         left join cycles cy on cy.id = c.cycle_id
         left join campaigns ca on ca.id = cy.campaign_id
        where not cl.archived
        group by cl.id order by cl.name`,
    ),
  ]);

  const campaigns = campaignsRes.rows;
  const clippers = clippersRes.rows;

  return (
    <Shell breadcrumb={<span style={{ fontSize: 14, fontWeight: 600 }}>Reports</span>}>
      <div className="grid" style={{ gap: 22 }}>
        <div>
          <div className="eyebrow">Exports &amp; documents</div>
          <h1>Reports</h1>
          <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>
            Every report opens as a clean printable page — hit “Download PDF / Print” and save. CSV exports live on each cycle.
          </p>
        </div>

        {/* Campaign reports */}
        <div className="grid" style={{ gap: 10 }}>
          <h2 style={{ margin: 0 }}>Campaign reports</h2>
          {campaigns.length === 0 && <div className="card muted">No campaigns yet.</div>}
          {campaigns.map((ca) => (
            <div key={ca.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <strong>{ca.name}</strong>
                <span className="muted" style={{ fontSize: 13 }}> · {ca.cycle_count} cycle{Number(ca.cycle_count) === 1 ? '' : 's'}</span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/report/campaign/${ca.id}`}>
                  📊 All-time report
                </Link>
                {ca.latest_cycle_id && (
                  <Link className="btn secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/cycle/${ca.latest_cycle_id}/report`}>
                    🐝 Latest cycle ({ca.latest_cycle_name})
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Clipper reports */}
        <div className="grid" style={{ gap: 10 }}>
          <h2 style={{ margin: 0 }}>Clipper reports</h2>
          {clippers.length === 0 && <div className="card muted">No clippers yet.</div>}
          {clippers.map((cl) => (
            <div key={cl.id} className="card grid" style={{ gap: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{cl.name}</strong>
                <div style={{ marginLeft: 'auto' }}>
                  <Link className="btn secondary" style={{ padding: '6px 12px', fontSize: 13 }} href={`/report/clipper/${cl.id}`}>
                    🏆 All-time report
                  </Link>
                </div>
              </div>
              {cl.campaigns.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="muted" style={{ fontSize: 12.5 }}>Detailed per campaign:</span>
                  {cl.campaigns.map((ca) => (
                    <Link key={ca.id} href={`/report/clipper/${cl.id}?campaign=${ca.id}`}
                      style={{ fontSize: 12.5, fontFamily: 'var(--mono)', border: '1px solid var(--line-2)', borderRadius: 999, padding: '3px 10px' }}>
                      {ca.name} →
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
