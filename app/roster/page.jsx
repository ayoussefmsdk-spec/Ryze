import Link from 'next/link';
import Brand from '../../components/Brand.jsx';
import { requireSession } from '../../lib/auth.mjs';
import { query } from '../../lib/db.mjs';
import { AddClipperForm, AccountsEditor } from '../../components/RosterManager.jsx';
import StatsLinkPanel from '../../components/StatsLinkPanel.jsx';
import Shell from '../../components/Shell.jsx';

export const dynamic = 'force-dynamic';

export default async function RosterPage() {
  requireSession();
  const { rows: clippers } = await query(
    `select cl.id, cl.name, cl.payment_handle, cl.notes,
            coalesce(json_agg(json_build_object('id', a.id, 'platform', a.platform, 'handle', a.handle)
                     order by a.platform, a.handle)
                     filter (where a.id is not null), '[]') as accounts
       from clippers cl
       left join clipper_accounts a on a.clipper_id = cl.id
      where not cl.archived
      group by cl.id order by cl.name`,
  );

  // Personal stats links per clipper (serializable shapes for the panel).
  const { rows: codeRows } = clippers.length
    ? await query(
        `select id, clipper_id, code, label, show_money, expires_at, revoked, uses, last_used_at
           from clipper_codes where clipper_id = any($1) order by created_at desc`,
        [clippers.map((c) => c.id)],
      )
    : { rows: [] };
  const codesByClipper = {};
  for (const r of codeRows) {
    (codesByClipper[r.clipper_id] ??= []).push({
      id: r.id, code: r.code, label: r.label, show_money: r.show_money,
      expires_at: r.expires_at ? String(new Date(r.expires_at).toISOString()) : null,
      revoked: r.revoked, uses: r.uses,
      last_used_at: r.last_used_at ? String(new Date(r.last_used_at).toISOString()) : null,
    });
  }

  return (
    <Shell breadcrumb={<span style={{ fontSize: 14, fontWeight: 600 }}>Clippers</span>}>
      <div className="grid" style={{ gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div className="eyebrow">Roster</div>
            <h1>Clippers</h1>
          </div>
          <div style={{ marginLeft: 'auto' }}><AddClipperForm /></div>
        </div>

        {clippers.length === 0 && (
          <div className="card">
            <h2>No clippers yet</h2>
            <p className="muted">Add your people once — then enroll them into any cycle. Linking their platform accounts enables the anti-fraud checks and account scanning.</p>
          </div>
        )}

        <div className="grid" style={{ gap: 12 }}>
          {clippers.map((c) => (
            <div key={c.id} className="card grid" style={{ gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0 }}>
                  <Link href={`/clipper/${c.id}`} style={{ color: 'inherit' }}>{c.name}</Link>
                </h2>
                {c.payment_handle && <span className="muted" style={{ fontSize: 13 }}>pays to: {c.payment_handle}</span>}
                {c.notes && <span className="muted" style={{ fontSize: 13 }}>· {c.notes}</span>}
                <span style={{ marginLeft: 'auto' }}>
                  <StatsLinkPanel clipperId={c.id} clipperName={c.name} codes={codesByClipper[c.id] || []} />
                </span>
              </div>
              <AccountsEditor clipperId={c.id} accounts={c.accounts} />
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
