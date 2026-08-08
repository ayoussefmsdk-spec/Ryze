import Link from 'next/link';
import { requireSession } from '../lib/auth.mjs';
import { getDashboard } from '../lib/dashboard.mjs';
import { formatCents } from '../core/payout.mjs';
import Shell from '../components/Shell.jsx';

export const dynamic = 'force-dynamic';

const MODEL_SHORT = { cpm: 'CPM', pot_proportional: 'Pot · share', pot_equal: 'Pot · equal', placement: 'Placement', flat_per_clip: 'Flat' };
const BAND = { ok: 'var(--good)', warn: '#f6a64b', critical: '#f6a64b', over: 'var(--crit)' };
const nf = (n) => Number(n || 0).toLocaleString('en-US');

export default async function DashboardPage() {
  requireSession();
  let d = null;
  let error = null;
  try { d = await getDashboard(); } catch (e) { error = e.message; }

  if (error) {
    return (
      <Shell breadcrumb={<span style={{ fontSize: 14 }} className="muted">Dashboard</span>}>
        <div className="card" style={{ borderColor: 'var(--crit)' }}>
          <h2>Database not ready</h2>
          <p className="muted">Set <code>DATABASE_URL</code> and run migrate. {error}</p>
        </div>
      </Shell>
    );
  }

  const c = d.counts;
  const needs = [];
  if (Number(c.pending) > 0) needs.push({ t: `${c.pending} clip${c.pending > 1 ? 's' : ''} waiting for review`, href: d.cycles[0] ? `/cycle/${d.cycles[0].id}` : '/campaigns', kind: 'pending' });
  if (Number(c.flagged) > 0) needs.push({ t: `${c.flagged} flagged clip${c.flagged > 1 ? 's' : ''} to check`, href: '/campaigns', kind: 'flag' });
  for (const cy of d.cycles) {
    if (cy.budget?.band === 'over' || cy.budget?.band === 'critical') {
      needs.push({ t: `${cy.name} budget at ${cy.budget.pct}%`, href: `/cycle/${cy.id}`, kind: 'budget' });
    }
  }

  const tiles = [
    { k: 'Views (active cycles)', v: nf(d.totalViews), accent: false },
    { k: 'Owed right now', v: formatCents(d.owedCents), accent: true },
    { k: 'Paid all-time', v: formatCents(d.paidCents), accent: false },
    { k: 'In the hive', v: `${c.clippers} clippers`, accent: false },
  ];

  return (
    <Shell breadcrumb={<span style={{ fontSize: 14, fontWeight: 600 }}>Dashboard</span>}>
      <div className="grid" style={{ gap: 22 }}>
        <div>
          <div className="eyebrow">The hive at a glance</div>
          <h1>Dashboard</h1>
        </div>

        {/* Hero ticker */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t) => (
            <div key={t.k} className="card" style={{ padding: '16px 18px' }}>
              <div className="eyebrow" style={{ letterSpacing: '0.09em' }}>{t.k}</div>
              <div style={{ fontSize: 27, fontWeight: 730, marginTop: 5, fontVariantNumeric: 'tabular-nums', color: t.accent ? 'var(--honey)' : 'var(--text)' }}>{t.v}</div>
            </div>
          ))}
        </div>

        {/* Needs you */}
        {needs.length > 0 && (
          <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '13px 16px' }}>
            <span className="eyebrow" style={{ color: 'var(--honey)' }}>Needs you</span>
            {needs.map((n, i) => (
              <Link key={i} href={n.href} className="pillbtn" style={{ color: n.kind === 'pending' ? 'var(--text)' : 'var(--crit)' }}>
                {n.kind === 'pending' ? '◔' : '⚑'} {n.t} →
              </Link>
            ))}
          </div>
        )}

        {/* Active cycles */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Active cycles</h2>
            <Link href="/campaigns" className="muted" style={{ marginLeft: 'auto', fontSize: 13.5 }}>All campaigns →</Link>
          </div>
          {d.cycles.length === 0 ? (
            <div className="card">
              <h2>The hive is quiet</h2>
              <p className="muted">No active cycles yet. Start a campaign, open a cycle, and invite your clippers.</p>
              <Link href="/campaigns" className="btn" style={{ marginTop: 6 }}>+ New campaign</Link>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {d.cycles.map((cy) => (
                <Link key={cy.id} href={`/cycle/${cy.id}`} style={{ color: 'inherit' }}>
                  <div className="card" style={{ height: '100%' }}>
                    <div className="muted" style={{ fontSize: 12.5 }}>{cy.campaign_name}</div>
                    <h2 style={{ margin: '2px 0 6px' }}>{cy.name}</h2>
                    <div className="muted" style={{ fontSize: 13 }}>{MODEL_SHORT[cy.payout_model]} · ends {cy.ends_on} · {cy.clips} clips</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>
                      <span>{nf(cy.views)} views</span>
                      <span style={{ color: 'var(--honey)', fontWeight: 650 }}>{formatCents(cy.computedCents)}</span>
                    </div>
                    {Number(cy.budget_cap_cents) > 0 && (
                      <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 10 }}>
                        <div style={{ width: `${Math.min(cy.budget.pct, 100)}%`, height: '100%', background: BAND[cy.budget.band] }} />
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top clippers */}
        {d.topClippers.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Top of the hive</h2>
              <Link href="/payouts" className="muted" style={{ marginLeft: 'auto', fontSize: 13.5 }}>Payouts →</Link>
            </div>
            <div className="card grid" style={{ gap: 2 }}>
              {d.topClippers.map((cl, i) => (
                <Link key={cl.id} href={`/clipper/${cl.id}`} style={{ color: 'inherit' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 4px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ fontFamily: 'var(--mono)', color: i < 3 ? 'var(--honey)' : 'var(--text-3)', width: 24 }}>#{i + 1}</span>
                    <span style={{ fontWeight: 600 }}>{cl.name}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCents(cl.paid)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .pillbtn { font-size: 13.5px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--line-2); text-decoration: none; }
        .pillbtn:hover { border-color: var(--honey); text-decoration: none; }
      `}</style>
    </Shell>
  );
}
