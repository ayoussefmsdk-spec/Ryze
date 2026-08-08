import Link from 'next/link';
import { requireSession } from '../../lib/auth.mjs';
import { query } from '../../lib/db.mjs';
import { formatCents } from '../../core/payout.mjs';
import Shell from '../../components/Shell.jsx';

export const dynamic = 'force-dynamic';
const nf = (n) => Number(n || 0).toLocaleString('en-US');

export default async function AnalyticsPage() {
  requireSession();
  let frozen = [];
  let error = null;
  try {
    // Every finished (frozen) cycle with its settled numbers = performance history.
    ({ rows: frozen } = await query(`
      select cy.id, cy.name, cy.starts_on, cy.ends_on, cy.payout_model,
             ca.name as campaign_name,
             coalesce(sum(c.views) filter (where c.status='approved'),0)::bigint as views,
             count(distinct c.clipper_id) filter (where c.status='approved')::int as clippers,
             count(c.id) filter (where c.status='approved')::int as clips,
             (select coalesce(sum(amount_cents),0) from payouts p where p.cycle_id = cy.id)::bigint as paid
        from cycles cy
        join campaigns ca on ca.id = cy.campaign_id
        left join clips c on c.cycle_id = cy.id
       where cy.status = 'frozen'
       group by cy.id, ca.name
       order by cy.ends_on desc
       limit 40
    `));
  } catch (e) { error = e.message; }

  const totalViews = frozen.reduce((a, r) => a + Number(r.views), 0);
  const totalPaid = frozen.reduce((a, r) => a + Number(r.paid), 0);
  const maxViews = Math.max(1, ...frozen.map((r) => Number(r.views)));

  return (
    <Shell breadcrumb={<span style={{ fontSize: 14, fontWeight: 600 }}>Performance</span>}>
      <div className="grid" style={{ gap: 20 }}>
        <div>
          <div className="eyebrow">History &amp; tracking</div>
          <h1>Performance</h1>
          <p className="muted" style={{ fontSize: 14 }}>Every finished cycle, side by side — how the hive is growing month over month.</p>
        </div>

        {error && <div className="card" style={{ borderColor: 'var(--crit)' }}><p className="muted">{error}</p></div>}

        {!error && frozen.length === 0 && (
          <div className="card">
            <h2>No finished cycles yet</h2>
            <p className="muted">Once a cycle freezes (its end date passes, or you stop it), its final numbers land here so you can compare performance over time.</p>
          </div>
        )}

        {frozen.length > 0 && (
          <>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px,1fr))', gap: 12 }}>
              <div className="card"><div className="eyebrow">Finished cycles</div><div style={{ fontSize: 26, fontWeight: 720, marginTop: 4 }}>{frozen.length}</div></div>
              <div className="card"><div className="eyebrow">Total views</div><div style={{ fontSize: 26, fontWeight: 720, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{nf(totalViews)}</div></div>
              <div className="card"><div className="eyebrow">Total paid out</div><div style={{ fontSize: 26, fontWeight: 720, marginTop: 4, color: 'var(--honey)', fontVariantNumeric: 'tabular-nums' }}>{formatCents(totalPaid)}</div></div>
            </div>

            {/* Cycle-over-cycle bars */}
            <div className="card grid" style={{ gap: 10 }}>
              <h2 style={{ margin: 0 }}>Views per finished cycle</h2>
              <div className="grid" style={{ gap: 8 }}>
                {frozen.slice().reverse().map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="muted" style={{ fontSize: 12.5, width: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.campaign_name} · {r.name}</span>
                    <div style={{ flex: 1, height: 14, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${(Number(r.views) / maxViews) * 100}%`, height: '100%', background: 'linear-gradient(90deg,var(--honey-deep),var(--honey))' }} />
                    </div>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, width: 74, textAlign: 'right' }}>{nf(r.views)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="card grid" style={{ gap: 4 }}>
              <h2 style={{ margin: '0 0 6px' }}>Cycle history</h2>
              {frozen.map((r, i) => (
                <Link key={r.id} href={`/cycle/${r.id}`} style={{ color: 'inherit' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 14, borderTop: i ? '1px solid var(--line)' : 'none', padding: '9px 2px' }}>
                    <span className="muted" style={{ fontSize: 12.5, width: 92 }}>{r.ends_on}</span>
                    <span style={{ fontWeight: 600 }}>{r.campaign_name}</span>
                    <span className="muted">{r.name}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{r.clippers} clippers · {r.clips} clips</span>
                    <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{nf(r.views)} views</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--honey)', minWidth: 82, textAlign: 'right' }}>{formatCents(r.paid)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
