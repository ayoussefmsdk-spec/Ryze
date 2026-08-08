import Link from 'next/link';
import { requireSession } from '../lib/auth.mjs';
import { getDashboard } from '../lib/dashboard.mjs';
import { getSystemStatus } from '../lib/system.mjs';
import { formatCents } from '../core/payout.mjs';
import Shell from '../components/Shell.jsx';
import TrendChart from '../components/TrendChart.jsx';
import { hiveDailySeries } from '../lib/history.mjs';

export const dynamic = 'force-dynamic';

const MODEL_SHORT = { cpm: 'CPM', pot_proportional: 'Pot · share', pot_equal: 'Pot · equal', placement: 'Placement', flat_per_clip: 'Flat' };
const BAND = { ok: 'var(--good)', warn: '#f6a64b', critical: '#f6a64b', over: 'var(--crit)' };
const nf = (n) => Number(n || 0).toLocaleString('en-US');
const PLAT = {
  tiktok: { label: 'TikTok', color: '#2ad4c8' },
  youtube: { label: 'YouTube', color: '#f6524f' },
  instagram: { label: 'Instagram', color: '#e1568f' },
  x: { label: 'X', color: '#9aa0aa' },
};

/** Views added over the trailing `days` window from a cumulative daily series. */
function windowGain(series, days) {
  if (!series || series.length < 2) return 0;
  const last = series[series.length - 1];
  const cutoff = Date.parse(last.label) - days * 86400000;
  let base = series[0];
  for (const p of series) { if (Date.parse(p.label) <= cutoff) base = p; }
  return Math.max(0, last.value - base.value);
}

export default async function DashboardPage() {
  requireSession();
  let d = null;
  let error = null;
  let hiveSeries = [];
  let sys = null;
  try {
    d = await getDashboard();
    hiveSeries = await hiveDailySeries(30);
    try { sys = await getSystemStatus(); } catch { /* system strip is optional */ }
  } catch (e) { error = e.message; }

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
  const week = windowGain(hiveSeries, 7);
  const prevWeek = windowGain(hiveSeries, 14) - week;
  const weekDelta = prevWeek > 0 ? Math.round(((week - prevWeek) / prevWeek) * 100) : null;

  // Onboarding steps — each completes as the hive fills up.
  const steps = [
    { done: Number(c.campaigns) > 0, label: 'Create your first campaign', href: '/campaigns', cta: 'New campaign' },
    { done: Number(c.clippers) > 0, label: 'Add clippers to your roster', href: '/roster', cta: 'Add clippers' },
    { done: Number(c.cycles_total) > 0, label: 'Open a cycle & pick a payout model', href: '/campaigns', cta: 'Open cycle' },
    { done: Number(c.clips) > 0, label: 'Add clips — manually, by link, or account-scan', href: '/campaigns', cta: 'Add clips' },
    { done: Boolean(sys?.youtubeKey || sys?.apifyToken), label: 'Connect view-tracking integrations', href: '/system', cta: 'Open System' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const setupComplete = doneCount === steps.length;

  const needs = [];
  if (Number(c.pending) > 0) needs.push({ t: `${c.pending} clip${c.pending > 1 ? 's' : ''} waiting for review`, href: d.cycles[0] ? `/cycle/${d.cycles[0].id}` : '/campaigns', kind: 'pending' });
  if (Number(c.flagged) > 0) needs.push({ t: `${c.flagged} flagged clip${c.flagged > 1 ? 's' : ''} to check`, href: '/fraud', kind: 'flag' });
  for (const cy of d.cycles) {
    if (cy.budget?.band === 'over' || cy.budget?.band === 'critical') {
      needs.push({ t: `${cy.name} budget at ${cy.budget.pct}%`, href: `/cycle/${cy.id}`, kind: 'budget' });
    }
  }

  const tiles = [
    { k: 'Views · active cycles', v: nf(d.totalViews), sub: week > 0 ? `+${nf(week)} this week` : null, accent: false },
    { k: 'Owed right now', v: formatCents(d.owedCents), sub: 'across active cycles', accent: true },
    { k: 'Paid all-time', v: formatCents(d.paidCents), sub: `${nf(c.clips)} clips tracked`, accent: false },
    { k: 'In the hive', v: `${nf(c.clippers)}`, sub: `${nf(c.campaigns)} campaign${Number(c.campaigns) === 1 ? '' : 's'}`, accent: false },
  ];

  const platTotal = d.platformSplit.reduce((a, p) => a + p.views, 0);

  return (
    <Shell breadcrumb={<span style={{ fontSize: 14, fontWeight: 600 }}>Dashboard</span>}>
      <div className="grid" style={{ gap: 22 }}>
        {/* Header + quick actions */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">The hive at a glance</div>
            <h1 style={{ margin: 0 }}>Dashboard</h1>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/campaigns" className="btn" style={{ fontSize: 13.5 }}>+ New campaign</Link>
            <Link href="/roster" className="btn secondary" style={{ fontSize: 13.5 }}>+ Clipper</Link>
            <Link href="/reports" className="btn secondary" style={{ fontSize: 13.5 }}>Reports</Link>
          </div>
        </div>

        {/* Onboarding checklist — shows until fully set up */}
        {!setupComplete && (
          <div className="card grid" style={{ gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>Get the hive running</h2>
              <span className="muted" style={{ fontSize: 13, marginLeft: 'auto', fontFamily: 'var(--mono)' }}>{doneCount}/{steps.length} done</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ width: `${(doneCount / steps.length) * 100}%`, height: '100%', background: 'var(--honey)', transition: 'width 0.3s' }} />
            </div>
            <div className="grid" style={{ gap: 2 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 2px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                    background: s.done ? 'var(--honey)' : 'var(--surface-2)',
                    color: s.done ? 'var(--bg)' : 'var(--text-3)',
                    border: s.done ? 'none' : '1px solid var(--line-2)',
                  }}>{s.done ? '✓' : i + 1}</span>
                  <span style={{ color: s.done ? 'var(--text-3)' : 'var(--text)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
                  {!s.done && <Link href={s.href} className="pillbtn" style={{ marginLeft: 'auto' }}>{s.cta} →</Link>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hero ticker */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {tiles.map((t) => (
            <div key={t.k} className="card" style={{ padding: '16px 18px' }}>
              <div className="eyebrow" style={{ letterSpacing: '0.09em' }}>{t.k}</div>
              <div style={{ fontSize: 27, fontWeight: 730, marginTop: 5, fontVariantNumeric: 'tabular-nums', color: t.accent ? 'var(--honey)' : 'var(--text)' }}>{t.v}</div>
              {t.sub && <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{t.sub}</div>}
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

        {/* Growth chart + side panels */}
        <div className="grid dash-cols" style={{ gap: 16 }}>
          <div className="grid" style={{ gap: 16, minWidth: 0 }}>
            {hiveSeries.length >= 2 ? (
              <div className="card grid" style={{ gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <h2 style={{ margin: 0 }}>Hive views — last 30 days</h2>
                  {weekDelta !== null && (
                    <span style={{ marginLeft: 'auto', fontSize: 12.5, fontFamily: 'var(--mono)', color: weekDelta >= 0 ? 'var(--good)' : 'var(--crit)' }}>
                      {weekDelta >= 0 ? '▲' : '▼'} {Math.abs(weekDelta)}% wk/wk
                    </span>
                  )}
                </div>
                <TrendChart points={hiveSeries} />
              </div>
            ) : (
              <div className="card" style={{ display: 'grid', placeItems: 'center', minHeight: 160, textAlign: 'center' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px' }}>No view history yet</h2>
                  <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>Once clips are tracked, growth shows up here.</p>
                </div>
              </div>
            )}

            {/* Platform split */}
            {platTotal > 0 && (
              <div className="card grid" style={{ gap: 12 }}>
                <h2 style={{ margin: 0 }}>Where the views are</h2>
                <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-2)' }}>
                  {d.platformSplit.map((p) => (
                    <div key={p.platform} title={`${(PLAT[p.platform]?.label || p.platform)}: ${nf(p.views)}`}
                      style={{ width: `${(p.views / platTotal) * 100}%`, background: PLAT[p.platform]?.color || 'var(--honey)' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {d.platformSplit.map((p) => (
                    <div key={p.platform} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: PLAT[p.platform]?.color || 'var(--honey)' }} />
                      <span style={{ fontWeight: 600 }}>{PLAT[p.platform]?.label || p.platform}</span>
                      <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{nf(p.views)} · {Math.round((p.views / platTotal) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right rail: system + top clippers */}
          <div className="grid" style={{ gap: 16, minWidth: 0 }}>
            {sys && (
              <div className="card grid" style={{ gap: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                  <h2 style={{ margin: 0 }}>System</h2>
                  <Link href="/system" className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>Open →</Link>
                </div>
                {[
                  ['Database', sys.dbOk],
                  ['YouTube API', sys.youtubeKey],
                  ['Apify (TikTok/IG)', sys.apifyToken],
                ].map(([label, ok], i) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderTop: i ? '1px solid var(--line)' : '1px solid var(--line)', marginTop: i ? 0 : 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: ok ? 'var(--good)' : 'var(--crit)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5 }}>{label}</span>
                    <span className="muted" style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'var(--mono)' }}>{ok ? 'on' : 'off'}</span>
                  </div>
                ))}
                <div className="muted" style={{ fontSize: 12, paddingTop: 9, borderTop: '1px solid var(--line)' }}>
                  Last check: {sys.lastCheckAt ? new Date(sys.lastCheckAt).toLocaleString() : 'never'}
                </div>
              </div>
            )}

            {d.topClippers.length > 0 && (
              <div className="card grid" style={{ gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}>
                  <h2 style={{ margin: 0 }}>Top of the hive</h2>
                  <Link href="/payouts" className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>Payouts →</Link>
                </div>
                {d.topClippers.map((cl, i) => (
                  <Link key={cl.id} href={`/clipper/${cl.id}`} style={{ color: 'inherit' }}>
                    <div style={{ display: 'flex', gap: 11, alignItems: 'center', padding: '8px 2px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                      <span style={{ fontFamily: 'var(--mono)', color: i < 3 ? 'var(--honey)' : 'var(--text-3)', width: 22 }}>#{i + 1}</span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{cl.name}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCents(cl.paid)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active cycles */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Active cycles</h2>
            <Link href="/campaigns" className="muted" style={{ marginLeft: 'auto', fontSize: 13.5 }}>All campaigns →</Link>
          </div>
          {d.cycles.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <h2 style={{ margin: '0 0 4px' }}>The hive is quiet</h2>
              <p className="muted" style={{ margin: '0 0 12px' }}>No active cycles yet. Start a campaign, open a cycle, and invite your clippers.</p>
              <Link href="/campaigns" className="btn">+ New campaign</Link>
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
      </div>

      <style>{`
        .pillbtn { font-size: 13px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--line-2); text-decoration: none; white-space: nowrap; }
        .pillbtn:hover { border-color: var(--honey); text-decoration: none; }
        .dash-cols { grid-template-columns: 1fr; }
        @media (min-width: 900px) { .dash-cols { grid-template-columns: 1.6fr 1fr; align-items: start; } }
      `}</style>
    </Shell>
  );
}
