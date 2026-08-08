import Link from 'next/link';
import Brand from '../../components/Brand.jsx';
import { requireSession } from '../../lib/auth.mjs';
import { query } from '../../lib/db.mjs';
import { computeCyclePayouts } from '../../lib/payouts.mjs';
import { formatCents } from '../../core/payout.mjs';
import PayCycleButton from '../../components/PayCycleButton.jsx';
import AdjustmentForm from '../../components/AdjustmentForm.jsx';
import Shell from '../../components/Shell.jsx';

export const dynamic = 'force-dynamic';

function nfmt(n) { return Number(n || 0).toLocaleString('en-US'); }

export default async function PayoutsPage() {
  requireSession();

  // Cycles that have any approved clips — candidates for payout.
  const { rows: cycleRows } = await query(
    `select distinct cy.id, cy.name, cy.status, cy.ends_on, ca.name as campaign_name
       from cycles cy
       join campaigns ca on ca.id = cy.campaign_id
       join clips c on c.cycle_id = cy.id and c.status = 'approved'
      order by cy.ends_on desc`,
  );

  const paidRows = (await query(`select cycle_id, clipper_id from payouts`)).rows;
  const paidSet = new Set(paidRows.map((r) => `${r.cycle_id}:${r.clipper_id}`));

  // Compute pending per cycle.
  const pendingBlocks = [];
  for (const cy of cycleRows) {
    const computed = await computeCyclePayouts(cy.id);
    const unpaid = computed.perClipper.filter(
      (p) => p.payoutCents > 0 && !paidSet.has(`${cy.id}:${p.clipperId}`),
    );
    if (unpaid.length) {
      pendingBlocks.push({
        cycle: cy,
        unpaid,
        totalCents: unpaid.reduce((a, p) => a + p.payoutCents, 0),
      });
    }
  }

  // Payment history.
  const { rows: history } = await query(
    `select p.amount_cents, p.paid_at, p.method, p.notes,
            cl.name as clipper_name, cl.id as clipper_id,
            cy.name as cycle_name, ca.name as campaign_name
       from payouts p
       join clippers cl on cl.id = p.clipper_id
       join cycles cy on cy.id = p.cycle_id
       join campaigns ca on ca.id = cy.campaign_id
      order by p.paid_at desc limit 100`,
  );

  // Lifetime totals per clipper (per campaign + grand).
  const { rows: lifetime } = await query(
    `select cl.id as clipper_id, cl.name,
            ca.name as campaign_name,
            sum(p.amount_cents)::bigint as campaign_cents
       from payouts p
       join clippers cl on cl.id = p.clipper_id
       join cycles cy on cy.id = p.cycle_id
       join campaigns ca on ca.id = cy.campaign_id
      group by cl.id, cl.name, ca.name
      order by cl.name, ca.name`,
  );
  const byClipper = new Map();
  for (const r of lifetime) {
    if (!byClipper.has(r.clipper_id)) byClipper.set(r.clipper_id, { name: r.name, campaigns: [], total: 0 });
    const g = byClipper.get(r.clipper_id);
    g.campaigns.push({ campaign: r.campaign_name, cents: Number(r.campaign_cents) });
    g.total += Number(r.campaign_cents);
  }
  const lifetimeRows = [...byClipper.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <Shell breadcrumb={<span style={{ fontSize: 14, fontWeight: 600 }}>Payouts</span>}>
      <div className="grid" style={{ gap: 22 }}>
        <div>
          <div className="eyebrow">Payouts hub</div>
          <h1>Payouts</h1>
        </div>

        {/* Pending */}
        <div className="grid" style={{ gap: 14 }}>
          <h2 style={{ margin: 0 }}>Waiting to be paid</h2>
          {pendingBlocks.length === 0 && (
            <div className="card muted">Nothing owed right now — everyone's settled. 🎉</div>
          )}
          {pendingBlocks.map(({ cycle, unpaid, totalCents }) => (
            <div key={cycle.id} className="card grid" style={{ gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <strong>{cycle.campaign_name}</strong>
                  <span className="muted"> · </span>
                  <Link href={`/cycle/${cycle.id}`}>{cycle.name}</Link>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {' '}· {cycle.status === 'frozen' ? 'frozen — numbers are final' : 'still active — numbers may grow'}
                  </span>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <PayCycleButton cycleId={cycle.id} amount={formatCents(totalCents)} />
                </div>
              </div>
              <div className="grid" style={{ gap: 4 }}>
                {unpaid.map((p) => (
                  <details key={p.clipperId} style={{ borderTop: '1px solid var(--line)' }}>
                    <summary style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 2px', cursor: 'pointer', listStyle: 'none' }}>
                      <Link href={`/clipper/${p.clipperId}`} style={{ color: 'inherit', fontWeight: 650 }}>{p.name}</Link>
                      {p.paymentHandle && <span className="muted" style={{ fontSize: 13 }}>→ {p.paymentHandle}</span>}
                      <span className="muted" style={{ fontSize: 13 }}>{p.clipCount} clips · {nfmt(p.views)} views</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{formatCents(p.payoutCents)}</span>
                      <AdjustmentForm cycleId={cycle.id} clipperId={p.clipperId} />
                      <PayCycleButton cycleId={cycle.id} clipperId={p.clipperId} label={p.name} amount={formatCents(p.payoutCents)} />
                    </summary>
                    <div className="grid" style={{ gap: 3, padding: '2px 2px 10px 14px' }}>
                      {Object.entries(p.byPlatform).map(([plat, d]) => (
                        <div key={plat} className="muted" style={{ display: 'flex', fontSize: 13 }}>
                          <span style={{ width: 100, textTransform: 'capitalize' }}>{plat}</span>
                          <span>{d.clips} clips · {nfmt(d.views)} views</span>
                          {d.payoutCents > 0 && <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{formatCents(d.payoutCents)}</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Lifetime */}
        {lifetimeRows.length > 0 && (
          <div className="grid" style={{ gap: 10 }}>
            <h2 style={{ margin: 0 }}>Lifetime earnings</h2>
            <div className="card grid" style={{ gap: 4 }}>
              {lifetimeRows.map(([clipperId, g], i) => (
                <details key={clipperId} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <summary style={{ display: 'flex', gap: 12, padding: '8px 2px', cursor: 'pointer', listStyle: 'none' }}>
                    <Link href={`/clipper/${clipperId}`} style={{ color: 'inherit', fontWeight: 650 }}>{g.name}</Link>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCents(g.total)}</span>
                  </summary>
                  <div className="grid" style={{ gap: 3, padding: '0 2px 10px 14px' }}>
                    {g.campaigns.map((c) => (
                      <div key={c.campaign} className="muted" style={{ display: 'flex', fontSize: 13 }}>
                        <span>{c.campaign}</span>
                        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{formatCents(c.cents)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="grid" style={{ gap: 10 }}>
            <h2 style={{ margin: 0 }}>Payment history</h2>
            <div className="card grid" style={{ gap: 6 }}>
              {history.map((h, i) => (
                <div key={i} className="muted" style={{ display: 'flex', gap: 10, fontSize: 13.5, flexWrap: 'wrap', borderTop: i ? '1px solid var(--line)' : 'none', paddingTop: i ? 6 : 0 }}>
                  <span>{new Date(h.paid_at).toLocaleDateString()}</span>
                  <strong style={{ color: 'var(--text)' }}>{h.clipper_name}</strong>
                  <span>{h.campaign_name} · {h.cycle_name}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatCents(h.amount_cents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
