import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '../../../../../lib/auth.mjs';
import { query } from '../../../../../lib/db.mjs';
import { computeCyclePayouts } from '../../../../../lib/payouts.mjs';
import { clipperCycleDailySeries, clipsPostedPerDay } from '../../../../../lib/history.mjs';
import { fillDailySeries, zeroFillDaily, dailyGains, minIso } from '../../../../../core/series.mjs';
import { formatCents, formatEngagement } from '../../../../../core/payout.mjs';
import Shell from '../../../../../components/Shell.jsx';
import TrendChart from '../../../../../components/TrendChart.jsx';
import DayBars from '../../../../../components/DayBars.jsx';
import FlagBadges from '../../../../../components/FlagBadges.jsx';

export const dynamic = 'force-dynamic';

const PLATFORM_ICON = { youtube: '▶', tiktok: '♪', instagram: '◎', twitter: '𝕏', other: '∙' };
const nf = (n) => Number(n || 0).toLocaleString('en-US');

/** One clipper's performance inside ONE cycle — charts on real calendar days. */
export default async function ClipperInCyclePage({ params }) {
  requireSession();

  const cycle = (await query(
    `select cy.*, ca.name as campaign_name
       from cycles cy join campaigns ca on ca.id = cy.campaign_id
      where cy.id = $1`,
    [params.id],
  )).rows[0];
  if (!cycle) notFound();

  const clipper = (await query(`select id, name from clippers where id = $1`, [params.clipperId])).rows[0];
  if (!clipper) notFound();

  const { rows: clips } = await query(
    `select id, platform, url, status, views, likes, comments, engagement, flags,
            account_handle, thumbnail_url, created_at, last_checked_at
       from clips
      where cycle_id = $1 and clipper_id = $2
      order by views desc, created_at desc`,
    [params.id, params.clipperId],
  );

  let pay = null;
  let mine = null;
  let rank = null;
  try {
    pay = await computeCyclePayouts(params.id);
    const idx = pay.perClipper.findIndex((p) => p.clipperId === params.clipperId);
    if (idx >= 0) { mine = pay.perClipper[idx]; rank = idx + 1; }
  } catch { /* charts and clips still render */ }

  const paidRow = (await query(
    `select coalesce(sum(amount_cents),0)::bigint as paid from payouts
      where cycle_id = $1 and clipper_id = $2`,
    [params.id, params.clipperId],
  )).rows[0];

  // Calendar-day series: from the cycle's start to today (or its end, whichever
  // comes first) — real dates, not just the days that happened to have checks.
  const sparse = await clipperCycleDailySeries(params.clipperId, params.id);
  const today = new Date().toISOString().slice(0, 10);
  const filled = fillDailySeries(sparse, {
    from: String(cycle.starts_on),
    to: minIso(today, String(cycle.ends_on)),
  });
  const gains = dailyGains(filled);
  const postedSeries = zeroFillDaily(
    await clipsPostedPerDay({ cycleId: params.id, clipperId: params.clipperId }),
    { from: String(cycle.starts_on), to: minIso(today, String(cycle.ends_on)) },
  );

  const approved = clips.filter((c) => c.status === 'approved');
  const totalViews = approved.reduce((a, c) => a + Number(c.views), 0);
  let engInter = 0; let engViews = 0;
  for (const c of approved) {
    if (c.likes == null && c.comments == null) continue;
    engInter += Number(c.likes || 0) + Number(c.comments || 0);
    engViews += Number(c.views || 0);
  }
  const engagement = engViews > 0 ? engInter / engViews : null;

  const tiles = [
    ['Views (this cycle)', nf(totalViews)],
    ['Clips', `${approved.length} live · ${clips.length - approved.length} other`],
    ['Engagement', formatEngagement(engagement)],
    ['Earning (this cycle)', mine ? formatCents(mine.payoutCents) : '—', true],
    ...(Number(paidRow.paid) > 0 ? [['Paid out', formatCents(paidRow.paid)]] : []),
    ...(rank && pay?.perClipper.length > 1 ? [['Rank', `#${rank} of ${pay.perClipper.length}`]] : []),
  ];

  return (
    <Shell breadcrumb={<>
      <Link href="/campaigns" className="muted" style={{ fontSize: 14 }}>Campaigns</Link>
      <span className="muted">›</span>
      <Link href={`/cycle/${cycle.id}`} className="muted" style={{ fontSize: 14 }}>{cycle.name}</Link>
      <span className="muted">›</span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{clipper.name}</span>
    </>}>
      <div className="grid" style={{ gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">{cycle.campaign_name} · {cycle.name}</div>
            <h1>{clipper.name}</h1>
            <div className="muted" style={{ fontSize: 13.5 }}>
              {String(cycle.starts_on).slice(0, 10)} → {String(cycle.ends_on).slice(0, 10)} · this cycle only
            </div>
          </div>
          <Link href={`/clipper/${clipper.id}`} className="btn secondary" style={{ marginLeft: 'auto', padding: '8px 13px', fontSize: 13.5 }}>
            All-time profile →
          </Link>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {tiles.map(([k, v, accent]) => (
            <div key={k} className="card" style={{ padding: '14px 16px' }}>
              <div className="eyebrow" style={{ letterSpacing: '0.08em' }}>{k}</div>
              <div style={{ fontSize: 22, fontWeight: 720, marginTop: 4, fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--honey)' : 'var(--text)' }}>{v}</div>
            </div>
          ))}
        </div>

        <div className="grid two-col" style={{ gap: 16 }}>
          <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>Total views — day by day</h2>
            <TrendChart points={filled} />
          </div>
          <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
            <h2 style={{ margin: 0 }}>Views gained each day</h2>
            <DayBars points={gains} />
          </div>
          <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h2 style={{ margin: 0 }}>Clips posted each day</h2>
              <span className="muted" style={{ fontSize: 11.5, marginLeft: 'auto', fontFamily: 'var(--mono)' }}>platform post date</span>
            </div>
            <DayBars points={postedSeries} color="var(--violet)" unit="clips" emptyNote="Bars appear as their clips get posted across the cycle's days." />
          </div>
        </div>

        {mine && Object.keys(mine.byPlatform).length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {Object.entries(mine.byPlatform).map(([plat, d]) => (
              <div key={plat} className="card" style={{ padding: '13px 16px' }}>
                <div className="muted" style={{ fontSize: 13, textTransform: 'capitalize' }}>{PLATFORM_ICON[plat]} {plat} · {d.clips} clips</div>
                <div style={{ fontSize: 17, fontWeight: 650, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {nf(d.views)} views{d.payoutCents > 0 && <span className="muted"> · {formatCents(d.payoutCents)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card grid" style={{ gap: 4 }}>
          <h2 style={{ margin: '0 0 8px' }}>Their clips this cycle ({clips.length})</h2>
          {clips.length === 0 && <div className="muted" style={{ fontSize: 14 }}>No clips from {clipper.name} in this cycle yet.</div>}
          {clips.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '9px 2px', borderTop: i ? '1px solid var(--line)' : 'none', opacity: c.status === 'rejected' ? 0.45 : 1 }}>
              {c.thumbnail_url && <img loading="lazy" src={c.thumbnail_url} alt="" style={{ width: 38, height: 51, objectFit: 'cover', borderRadius: 6 }} />}
              <span className="muted" style={{ fontSize: 13, width: 24, textAlign: 'center' }}>{PLATFORM_ICON[c.platform]}</span>
              <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.account_handle ? `@${c.account_handle}` : c.url.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
              <span className="muted" style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>{c.status}</span>
              <FlagBadges flags={c.flags} />
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: 14 }}>{nf(c.views)} views</span>
                <span className="muted" style={{ fontSize: 13 }}>♥ {formatEngagement(c.engagement)}</span>
                {pay?.clipPayouts?.[c.id] != null && c.status === 'approved' && (
                  <span style={{ color: 'var(--honey)', fontWeight: 650, fontSize: 13.5 }}>{formatCents(pay.clipPayouts[c.id])}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .two-col { grid-template-columns: 1fr; }
        @media (min-width: 1000px) { .two-col { grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); align-items: start; } }
      `}</style>
    </Shell>
  );
}
