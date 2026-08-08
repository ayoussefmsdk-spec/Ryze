import Link from 'next/link';
import { requireSession } from '../lib/auth.mjs';
import { query } from '../lib/db.mjs';
import CampaignForm from '../components/CampaignForm.jsx';

export const dynamic = 'force-dynamic';

async function loadCampaigns() {
  try {
    const { rows } = await query(
      `select c.id, c.name, c.streamer_handle, c.timezone,
              (select count(*) from cycles cy where cy.campaign_id = c.id) as cycle_count
         from campaigns c
        where not c.archived
        order by c.created_at desc`,
    );
    return { rows };
  } catch (err) {
    return { error: err.message };
  }
}

export default async function HomePage() {
  requireSession();
  const { rows, error } = await loadCampaigns();

  return (
    <>
      <div className="topbar">
        <span className="brand">▲ RyZeX</span>
        <span className="muted" style={{ fontSize: 14 }}>clipping agency</span>
        <form action="/api/logout" method="post" style={{ marginLeft: 'auto' }}>
          <button className="btn secondary" style={{ padding: '6px 12px' }} type="submit">Log out</button>
        </form>
      </div>

      <div className="wrap grid" style={{ gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div className="eyebrow">Campaigns</div>
            <h1>Your campaigns</h1>
          </div>
          <div style={{ marginLeft: 'auto' }}><CampaignForm /></div>
        </div>

        {error && (
          <div className="card" style={{ borderColor: 'var(--crit)' }}>
            <h2>Database not ready yet</h2>
            <p className="muted">
              The app is running, but it can’t reach the database or the tables aren’t created.
              Set <code>DATABASE_URL</code> and run <code>npm run migrate</code>.
            </p>
            <p className="muted" style={{ fontSize: 13 }}>{error}</p>
          </div>
        )}

        {!error && rows.length === 0 && (
          <div className="card">
            <h2>No campaigns yet</h2>
            <p className="muted">Create your first campaign to get started — then you’ll add cycles inside it.</p>
          </div>
        )}

        {!error && rows.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {rows.map((c) => (
              <Link key={c.id} href={`/campaign/${c.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="card" style={{ height: '100%' }}>
                  <h2>{c.name}</h2>
                  <div className="muted" style={{ fontSize: 14 }}>
                    {c.streamer_handle ? `${c.streamer_handle} · ` : ''}{c.timezone}
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                    {c.cycle_count} cycle{Number(c.cycle_count) === 1 ? '' : 's'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
