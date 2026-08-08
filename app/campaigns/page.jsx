import Link from 'next/link';
import { requireSession } from '../../lib/auth.mjs';
import { query } from '../../lib/db.mjs';
import CampaignForm from '../../components/CampaignForm.jsx';
import Shell from '../../components/Shell.jsx';

export const dynamic = 'force-dynamic';

/** Campaign icon: image URL → picture, emoji → emoji, none → honey monogram. */
function CampaignAvatar({ avatar, name }) {
  if (avatar && /^https?:\/\//i.test(avatar)) {
    return <img src={avatar} alt="" style={{ width: 52, height: 52, borderRadius: 13, objectFit: 'cover', border: '1px solid var(--line-2)', flexShrink: 0 }} />;
  }
  if (avatar) {
    return <span style={{ fontSize: 34, lineHeight: 1, flexShrink: 0 }}>{avatar}</span>;
  }
  return (
    <span style={{
      width: 52, height: 52, borderRadius: 13, flexShrink: 0, display: 'grid', placeItems: 'center',
      background: 'var(--honey-soft)', border: '1px solid rgba(240,182,74,.35)',
      color: 'var(--honey)', fontWeight: 750, fontSize: 22, fontFamily: 'var(--mono)',
    }}>
      {String(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}

export default async function CampaignsPage() {
  requireSession();
  let rows = [];
  let error = null;
  try {
    ({ rows } = await query(
      `select c.id, c.name, c.streamer_handle, c.avatar_url,
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
              <Link key={c.id} href={`/campaign/${c.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="card" style={{ height: '100%', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <CampaignAvatar avatar={c.avatar_url} name={c.name} />
                  <div>
                    <h2 style={{ margin: 0 }}>{c.name}</h2>
                    {c.streamer_handle && <div className="muted" style={{ fontSize: 14 }}>{c.streamer_handle}</div>}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <span className="tagchip">{c.cycle_count} cycle{Number(c.cycle_count) === 1 ? '' : 's'}</span>
                      {Number(c.active_count) > 0 && <span className="tagchip" style={{ color: 'var(--good)', borderColor: 'rgba(92,217,140,.4)' }}>{c.active_count} active</span>}
                    </div>
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
