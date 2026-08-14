import Link from 'next/link';
import { requireSession } from '../../lib/auth.mjs';
import { getSpending, thisMonth, monthChoices } from '../../lib/spending.mjs';
import { formatCents } from '../../core/payout.mjs';
import Shell from '../../components/Shell.jsx';
import DayBars from '../../components/DayBars.jsx';
import { zeroFillDaily } from '../../core/series.mjs';

export const dynamic = 'force-dynamic';

const nf = (n) => Number(n || 0).toLocaleString('en-US');
const gb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';
const monthLabel = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Fill a month's days (1st → today or month end) with zeros for the bar charts. */
function fillMonth(series, month) {
  const start = `${month}-01`;
  const today = new Date().toISOString().slice(0, 10);
  const endOfMonth = new Date(`${month}-01T00:00:00Z`);
  endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);
  endOfMonth.setUTCDate(0);
  const end = endOfMonth.toISOString().slice(0, 10);
  return zeroFillDaily(series, { from: start, to: today < end && today > start ? today : end });
}

export default async function SpendingPage({ searchParams }) {
  requireSession();
  const month = /^\d{4}-\d{2}$/.test(searchParams?.month || '') ? searchParams.month : thisMonth();
  let s = null; let error = null;
  try { s = await getSpending(month); } catch (e) { error = e.message; }

  return (
    <Shell breadcrumb={<span style={{ fontSize: 14, fontWeight: 600 }}>Spending</span>}>
      <div className="grid" style={{ gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Where the money goes</div>
            <h1 style={{ margin: 0 }}>Spending</h1>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {monthChoices(6).map((m) => (
              <Link key={m} href={`/spending?month=${m}`} className="pill"
                style={{ borderColor: m === month ? 'var(--honey)' : 'var(--line-2)', color: m === month ? 'var(--honey)' : 'var(--text-2)' }}>
                {monthLabel(m)}
              </Link>
            ))}
          </div>
        </div>

        {error && <div className="card" style={{ borderColor: 'var(--crit)' }}><p className="muted">{error}</p></div>}

        {s && (
          <>
            {/* Month tiles */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              {[
                ['Clipper payouts', formatCents(s.payoutMonthCents), `${monthLabel(month)}`, true],
                ['API spend (Apify)', formatCents(s.apiCostMonthCents), `${nf(s.paidChecksMonth)} paid TikTok/IG checks`],
                ['YouTube checks', nf(s.ytChecksMonth), 'free — no cost'],
                ['Database storage', gb(s.dbBytes), `${nf(s.totals.historyRows)} history rows · ${nf(s.totals.clipsRows)} clips`],
              ].map(([k, v, sub, accent]) => (
                <div key={k} className="card" style={{ padding: '15px 17px' }}>
                  <div className="eyebrow" style={{ letterSpacing: '0.08em' }}>{k}</div>
                  <div style={{ fontSize: 25, fontWeight: 730, marginTop: 4, fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--honey)' : 'var(--text)' }}>{v}</div>
                  {sub && <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{sub}</div>}
                </div>
              ))}
            </div>

            {/* Daily charts */}
            <div className="grid spend-cols" style={{ gap: 16 }}>
              <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
                <h2 style={{ margin: 0 }}>Payouts per day — {monthLabel(month)}</h2>
                <DayBars points={fillMonth(s.payoutDaily, month)} money emptyNote="No payouts recorded this month." />
                <div className="muted" style={{ fontSize: 12 }}>Hover any bar for the exact amount.</div>
              </div>
              <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
                <h2 style={{ margin: 0 }}>API spend per day</h2>
                <DayBars points={fillMonth(s.apiDaily, month)} color="var(--violet)" money emptyNote="No paid checks this month." />
                <div className="muted" style={{ fontSize: 12 }}>
                  Estimated at {formatCents(s.rateCentsPer1k)} per 1,000 paid TikTok/IG post-checks — tune this
                  rate in <Link href="/system">System</Link> to match your real Apify bill.
                </div>
              </div>
              <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
                <h2 style={{ margin: 0 }}>YouTube checks per day</h2>
                <DayBars points={fillMonth(s.ytDaily, month)} color="#f6524f" unit="checks" emptyNote="No YouTube checks this month." />
                <div className="muted" style={{ fontSize: 12 }}>Free under the YouTube Data API quota.</div>
              </div>
            </div>

            {/* Per-campaign breakdown */}
            <div className="card grid" style={{ gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <h2 style={{ margin: 0 }}>Per campaign</h2>
                <span className="muted" style={{ marginLeft: 'auto', fontSize: 12.5, fontFamily: 'var(--mono)' }}>{monthLabel(month)} · all-time</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 640 }}>
                  <thead>
                    <tr className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--mono)' }}>
                      {['Campaign', 'Payouts (month)', 'API cost (month)', 'Paid checks (month)', 'Payouts (all-time)', 'API cost (all-time)'].map((h, i) => (
                        <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '8px 6px', borderBottom: '1px solid var(--line-2)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.perCampaign.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '9px 6px' }}>
                          <Link href={`/campaign/${c.id}`} style={{ color: 'inherit', fontWeight: 600 }}>
                            {c.avatar && !/^https?:/.test(c.avatar) ? `${c.avatar} ` : ''}{c.name}
                          </Link>
                        </td>
                        <td style={{ textAlign: 'right', padding: '9px 6px', fontVariantNumeric: 'tabular-nums', color: 'var(--honey)', fontWeight: 650 }}>{formatCents(c.payoutMonthCents)}</td>
                        <td style={{ textAlign: 'right', padding: '9px 6px', fontVariantNumeric: 'tabular-nums' }}>{formatCents(c.apiCostMonthCents)}</td>
                        <td style={{ textAlign: 'right', padding: '9px 6px', fontVariantNumeric: 'tabular-nums' }} className="muted">{nf(c.paidChecksMonth)}</td>
                        <td style={{ textAlign: 'right', padding: '9px 6px', fontVariantNumeric: 'tabular-nums' }}>{formatCents(c.payoutAllCents)}</td>
                        <td style={{ textAlign: 'right', padding: '9px 6px', fontVariantNumeric: 'tabular-nums' }} className="muted">{formatCents(c.apiCostAllCents)}</td>
                      </tr>
                    ))}
                    {s.perCampaign.length === 0 && (
                      <tr><td colSpan={6} className="muted" style={{ padding: '14px 6px' }}>No campaigns yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* All-time strip */}
            <div className="card" style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 13.5, padding: '13px 17px' }}>
              <span className="eyebrow" style={{ letterSpacing: '0.08em', alignSelf: 'center' }}>All-time</span>
              <span>Payouts <b style={{ color: 'var(--honey)' }}>{formatCents(s.totals.payoutAllCents)}</b></span>
              <span>API spend <b>{formatCents(s.totals.apiCostAllCents)}</b> <span className="muted">({nf(s.totals.paidChecksAll)} paid checks)</span></span>
              <span>YouTube checks <b>{nf(s.totals.ytChecksAll)}</b> <span className="muted">(free)</span></span>
              <Link href="/system" className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>Spend guard settings →</Link>
            </div>
          </>
        )}
      </div>

      <style>{`
        .pill { font-size: 12.5px; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--line-2); text-decoration: none; white-space: nowrap; }
        .pill:hover { border-color: var(--honey); text-decoration: none; }
        .spend-cols { grid-template-columns: 1fr; }
        @media (min-width: 1100px) { .spend-cols { grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); align-items: start; } }
      `}</style>
    </Shell>
  );
}
