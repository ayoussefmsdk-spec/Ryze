import Link from 'next/link';
import Brand from '../../../components/Brand.jsx';
import { notFound } from 'next/navigation';
import { requireSession } from '../../../lib/auth.mjs';
import { query } from '../../../lib/db.mjs';
import { formatCents } from '../../../core/payout.mjs';
import { AccountsEditor } from '../../../components/RosterManager.jsx';
import TrendChart from '../../../components/TrendChart.jsx';
import DayBars from '../../../components/DayBars.jsx';
import { clipperDailySeries, clipsPostedPerDay } from '../../../lib/history.mjs';
import { fillDailySeries, zeroFillDaily, dailyGains } from '../../../core/series.mjs';
import Shell from '../../../components/Shell.jsx';
import AccountBreakdown from '../../../components/AccountBreakdown.jsx';

export const dynamic = 'force-dynamic';

function nfmt(n) { return Number(n || 0).toLocaleString('en-US'); }

export default async function ClipperPage({ params }) {
  requireSession();

  const clipper = (await query(`select * from clippers where id = $1`, [params.id])).rows[0];
  if (!clipper) notFound();

  const [accountsRes, allClipsRes, cyclesRes, paidRes] = await Promise.all([
    query(`select id, platform, handle from clipper_accounts where clipper_id = $1 order by platform, handle`, [params.id]),
    // Every clip they've ever made — feeds the per-platform / per-account split.
    query(`select platform, account_handle, views, status from clips where clipper_id = $1`, [params.id]),
    // Per-cycle activity: views/clips from this clipper's clips in each cycle.
    query(
      `select cy.id as cycle_id, cy.name as cycle_name, cy.starts_on, cy.ends_on, cy.status,
              ca.name as campaign_name,
              count(c.id)::int as clips,
              coalesce(sum(c.views) filter (where c.status = 'approved'), 0)::bigint as views,
              count(c.id) filter (where c.status = 'approved')::int as approved
         from clips c
         join cycles cy on cy.id = c.cycle_id
         join campaigns ca on ca.id = cy.campaign_id
        where c.clipper_id = $1
        group by cy.id, cy.name, cy.starts_on, cy.ends_on, cy.status, ca.name
        order by cy.starts_on desc`,
      [params.id],
    ),
    query(
      `select p.cycle_id, p.amount_cents, p.paid_at, ca.name as campaign_name
         from payouts p join cycles cy on cy.id = p.cycle_id
         join campaigns ca on ca.id = cy.campaign_id
        where p.clipper_id = $1`,
      [params.id],
    ),
  ]);

  const clipperSeries = await clipperDailySeries(params.id);
  const clipperPosted = zeroFillDaily(await clipsPostedPerDay({ clipperId: params.id }));
  const paidByCycle = new Map(paidRes.rows.map((r) => [r.cycle_id, r]));
  const lifetimePaid = paidRes.rows.reduce((a, r) => a + Number(r.amount_cents), 0);
  const lifetimeViews = cyclesRes.rows.reduce((a, r) => a + Number(r.views), 0);
  const totalClips = cyclesRes.rows.reduce((a, r) => a + r.clips, 0);

  // Per-campaign paid totals.
  const perCampaign = new Map();
  for (const r of paidRes.rows) {
    perCampaign.set(r.campaign_name, (perCampaign.get(r.campaign_name) || 0) + Number(r.amount_cents));
  }

  return (
    <Shell breadcrumb={<>
      <Link href="/roster" className="muted" style={{ fontSize: 14 }}>Clippers</Link>
      <span className="muted">›</span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{clipper.name}</span>
    </>}>
      <div className="grid" style={{ gap: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Clipper profile</div>
            <h1>{clipper.name}</h1>
            <div className="muted" style={{ fontSize: 14 }}>
              {clipper.payment_handle ? `pays to ${clipper.payment_handle}` : 'no payment handle set'}
              {clipper.notes ? ` · ${clipper.notes}` : ''}
            </div>
          </div>
          <Link href={`/report/clipper/${clipper.id}`} className="btn secondary" style={{ marginLeft: 'auto', padding: '7px 13px', fontSize: 13.5 }}>
            🏆 All-time report
          </Link>
        </div>

        {/* Lifetime tiles */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {[
            ['Lifetime paid', formatCents(lifetimePaid)],
            ['Lifetime views', nfmt(lifetimeViews)],
            ['Clips', totalClips],
            ['Cycles', cyclesRes.rows.length],
          ].map(([k, v]) => (
            <div key={k} className="card" style={{ padding: '14px 16px' }}>
              <div className="eyebrow" style={{ letterSpacing: '0.08em' }}>{k}</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Platforms & accounts — lifetime views per posting account */}
        {allClipsRes.rows.length > 0 && (
          <div className="grid" style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h2 style={{ margin: 0 }}>Platforms &amp; accounts</h2>
              <span className="muted" style={{ fontSize: 12.5 }}>lifetime views per posting account</span>
            </div>
            <AccountBreakdown clips={allClipsRes.rows} />
          </div>
        )}

        {/* Per-campaign earnings */}
        {perCampaign.size > 0 && (
          <div className="card grid" style={{ gap: 4 }}>
            <h2 style={{ margin: '0 0 6px' }}>Earnings by campaign</h2>
            {[...perCampaign.entries()].sort((a, b) => b[1] - a[1]).map(([name, cents]) => (
              <div key={name} style={{ display: 'flex', fontSize: 14, padding: '4px 0' }}>
                <span>{name}</span>
                <span style={{ marginLeft: 'auto', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{formatCents(cents)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Views path chart — real calendar days */}
        {(() => {
          const filled = fillDailySeries(clipperSeries, { to: new Date().toISOString().slice(0, 10) });
          return (
            <div className="grid clip-chart-cols" style={{ gap: 16 }}>
              <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
                <h2 style={{ margin: 0 }}>Total views — day by day</h2>
                <TrendChart points={filled} />
              </div>
              <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
                <h2 style={{ margin: 0 }}>Views gained each day</h2>
                <DayBars points={dailyGains(filled)} />
              </div>
              <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <h2 style={{ margin: 0 }}>Clips posted each day</h2>
                  <span className="muted" style={{ fontSize: 11.5, marginLeft: 'auto', fontFamily: 'var(--mono)' }}>platform post date</span>
                </div>
                <DayBars points={clipperPosted} color="var(--violet)" unit="clips" emptyNote="Bars appear as their clips get posted." />
              </div>
              <style>{`
                .clip-chart-cols { grid-template-columns: 1fr; }
                @media (min-width: 1100px) { .clip-chart-cols { grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); align-items: start; } }
              `}</style>
            </div>
          );
        })()}

        {/* Cycle history — their "path" */}
        <div className="card grid" style={{ gap: 4 }}>
          <h2 style={{ margin: '0 0 6px' }}>Cycle history</h2>
          {cyclesRes.rows.length === 0 && <div className="muted" style={{ fontSize: 14 }}>No clips in any cycle yet.</div>}
          {cyclesRes.rows.map((r, i) => {
            const paid = paidByCycle.get(r.cycle_id);
            return (
              <div key={r.cycle_id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 14, borderTop: i ? '1px solid var(--line)' : 'none', padding: '8px 0' }}>
                <span className="muted" style={{ fontSize: 13 }}>{r.starts_on}</span>
                <span>{r.campaign_name} · <Link href={`/cycle/${r.cycle_id}`}>{r.cycle_name}</Link></span>
                <span className="muted" style={{ fontSize: 13 }}>{r.approved}/{r.clips} approved</span>
                <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{nfmt(r.views)} views</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 110, textAlign: 'right' }}>
                  {paid
                    ? <span style={{ color: 'var(--good)' }}>{formatCents(paid.amount_cents)} paid</span>
                    : <span className="muted">not settled</span>}
                </span>
              </div>
            );
          })}
        </div>

        {/* Linked accounts */}
        <div className="card grid" style={{ gap: 10 }}>
          <h2 style={{ margin: 0 }}>Linked accounts</h2>
          <AccountsEditor clipperId={clipper.id} accounts={accountsRes.rows} />
        </div>
      </div>
    </Shell>
  );
}
