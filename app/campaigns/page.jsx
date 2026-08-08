import Link from 'next/link';
import { requireSession } from '../../lib/auth.mjs';
import { query } from '../../lib/db.mjs';
import CampaignForm from '../../components/CampaignForm.jsx';
import Shell from '../../components/Shell.jsx';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  requireSession();
  let rows = [];
  let error = null;
  try {
    ({ rows } = await query(
      `select c.id, c.name, c.streamer_handle, c.timezone,
              (select count(*) from cycles cy where cy.campaign_id = c.id) as cycle_count,
              (select count(*) from cycles cy where cy.campaign_id = c.id and cy.status='active') as active_count
         from campaigns c where not c.archived order by c.created_at desc`,
    ));
  } catch (e) { error = e.message; }

  return (
    <Shell breadcrumb={<span style={{ fontSize: 14, fontWeight: 600 }}>Campaigns</span>}>
      <div className="grid" style={{ gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div className="eyebrow">Your streamer programs</div>
            <h1>Campaigns</h1>
          </div>
          <div style={{ marginLeft: 'auto' }}><CampaignForm /></div>
        </div>

        {error && <div className="card" style={{ borderColor: 'var(--crit)' }}><p className="muted">{error}</p></div>}

        {!error && rows.length === 0 && (
          <div className="card">
            <h2>No campaigns yet</h2>
            <p className="muted">A campaign is one streamer's ongoing program. Create your first, then open cycles inside it.</p>
          </div>
        )}

        {!error && rows.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
            {rows.map((c) => (
              <Link key={c.id} href={`/campaign/${c.id}`} style={{ color: 'inherit' }}>
                <div className="card" style={{ height: '100%' }}>
                  <h2>{c.name}</h2>
                  <div className="muted" style={{ fontSize: 14 }}>{c.streamer_handle ? `${c.streamer_handle} · ` : ''}{c.timezone}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <span className="tagchip">{c.cycle_count} cycle{Number(c.cycle_count) === 1 ? '' : 's'}</span>
                    {Number(c.active_count) > 0 && <span className="tagchip" style={{ color: 'var(--good)', borderColor: 'rgba(92,217,140,.4)' }}>{c.active_count} active</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <style>{`.tagchip{font-size:12px;font-family:var(--mono);padding:3px 10px;border-radius:999px;border:1px solid var(--line-2);color:var(--text-2)}`}</style>
    </Shell>
  );
}
