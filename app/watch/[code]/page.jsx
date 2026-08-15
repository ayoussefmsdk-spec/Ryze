import { headers } from 'next/headers';
import { resolveViewerCode } from '../../../lib/viewer.mjs';
import { limited, clientIp } from '../../../lib/ratelimit.mjs';
import { clipsPostedPerDay } from '../../../lib/history.mjs';
import { fillDailySeries, zeroFillDaily, dailyGains, minIso } from '../../../core/series.mjs';
import DayBars from '../../../components/DayBars.jsx';
import WatchGallery from '../../../components/WatchGallery.jsx';
import { computeCyclePayouts } from '../../../lib/payouts.mjs';
import { cycleDailySeries } from '../../../lib/history.mjs';
import { query } from '../../../lib/db.mjs';
import { formatCents, formatEngagement } from '../../../core/payout.mjs';
import Brand from '../../../components/Brand.jsx';
import TrendChart from '../../../components/TrendChart.jsx';
import { cycleIntel } from '../../../lib/intel.mjs';

export const dynamic = 'force-dynamic';
const nf = (n) => Number(n || 0).toLocaleString('en-US');
const PLAT = { youtube: '▶ YouTube', tiktok: '♪ TikTok', instagram: '◎ Instagram', twitter: '𝕏 Twitter', other: '∙ Other' };

function Gate({ title, msg }) {
  return (
    <div className="center-screen">
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Brand size={18} /></div>
        <h2>{title}</h2>
        <p className="muted">{msg}</p>
      </div>
    </div>
  );
}

// Link-preview crawlers (Discord, WhatsApp, Slack, iMessage…) fetch shared URLs
// to build embeds. They must see a branded teaser WITHOUT consuming the
// single-use code, or the streamer's link is burned before they ever click it.
const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|twitterbot|linkedin|skype|pinterest|vkshare|embedly|quora|snapchat|applebot/i;

export default async function WatchPage({ params }) {
  const h = headers();
  if (BOT_UA.test(h.get('user-agent') || '')) {
    return <Gate title="Live campaign report" msg="A private, read-only performance room. Open the link to step inside." />;
  }

  // Brake code-scanning: plenty for real viewers refreshing, fatal for sweeps.
  const ip = clientIp(h);
  if (limited(`watch:${ip}`, { max: 60, windowMs: 15 * 60 * 1000 })) {
    return <Gate title="Slow down" msg="Too many attempts from your network — try again in a few minutes." />;
  }

  let res;
  try { res = await resolveViewerCode(params.code); }
  catch { return <Gate title="Something went wrong" msg="Try the link again in a moment." />; }

  if (!res.ok) {
    const map = {
      notfound: ['Invalid code', 'This viewer code doesn’t exist. Ask for a fresh one.'],
      revoked: ['Access ended', 'This viewer link was turned off by the campaign manager.'],
      expired: ['Link expired', 'This viewer link has expired. Ask the manager for a new one.'],
      used: ['Already viewed', 'This is a single-use link and its viewing window has closed. Ask for a fresh one.'],
    };
    const [t, m] = map[res.reason] || ['Unavailable', 'This link can’t be opened.'];
    return <Gate title={t} msg={m} />;
  }

  const { cycle, showMoney } = res;
  const [pay, series, clipsRes, postedSparse, aggRes] = await Promise.all([
    computeCyclePayouts(cycle.id),
    cycleDailySeries(cycle.id),
    query(
      `select c.id, c.platform, c.url, c.account_handle, c.views, c.likes, c.comments, c.engagement,
              c.thumbnail_url, c.caption, c.posted_at, c.created_at, cl.name as clipper_name
         from clips c join clippers cl on cl.id = c.clipper_id
        where c.cycle_id = $1 and c.status = 'approved'
        order by c.views desc limit 1000`,
      [cycle.id],
    ),
    clipsPostedPerDay({ cycleId: cycle.id }),
    // Truthful totals over ALL approved clips — never derived from a capped list.
    query(
      `select count(*)::int as approved,
              coalesce(sum(coalesce(likes,0) + coalesce(comments,0))
                filter (where likes is not null or comments is not null), 0)::bigint as inter,
              coalesce(sum(views)
                filter (where likes is not null or comments is not null), 0)::bigint as eng_views
         from clips where cycle_id = $1 and status = 'approved'`,
      [cycle.id],
    ),
  ]);
  const clips = clipsRes.rows;
  const agg = aggRes.rows[0];

  // Real calendar days from the cycle's start through today (or its end).
  const todayIso = new Date().toISOString().slice(0, 10);
  const chartTo = minIso(todayIso, String(cycle.ends_on));
  const filledSeries = fillDailySeries(series, { from: String(cycle.starts_on), to: chartTo });
  const gainSeries = dailyGains(filledSeries);
  const postedSeries = zeroFillDaily(postedSparse, { from: String(cycle.starts_on), to: chartTo });
  const leaderboard = [...pay.perClipper].sort((a, b) => b.views - a.views);

  let intel = null;
  try {
    intel = await cycleIntel({
      cycle: { ...cycle, campaign_id: cycle.campaign_id },
      payouts: pay,
      series,
      clips: clips.map((c) => ({ ...c, status: 'approved', id: null })),
      includeMoney: showMoney,
    });
  } catch { /* the room renders fine without intel */ }

  // Weighted engagement across ALL approved clips with real like/comment data.
  const avgEngagement = Number(agg.eng_views) > 0 ? Number(agg.inter) / Number(agg.eng_views) : null;

  const tiles = [
    ['Total views', nf(pay.totalViews)],
    ['Approved clips', nf(agg.approved)],
    ['Clippers working', pay.perClipper.length],
    ...(avgEngagement != null ? [['Engagement', formatEngagement(avgEngagement)]] : []),
    ...(showMoney ? [['Invested', formatCents(pay.totalPayoutCents)]] : []),
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="topbar">
        <Brand />
        <span className="muted" style={{ fontSize: 13 }}>live campaign report</span>
        <span className="pilllive" style={{ marginLeft: 'auto' }}>● watching</span>
      </div>

      <div className="wrap grid" style={{ gap: 22, maxWidth: 1360 }}>
        <div>
          <div className="eyebrow">{cycle.campaign_name} {cycle.streamer_handle ? `· ${cycle.streamer_handle}` : ''}</div>
          <h1 style={{ fontSize: 30 }}>{cycle.name}</h1>
          <div className="muted" style={{ fontSize: 14 }}>{cycle.starts_on} → {cycle.ends_on} · powered by ClipHive 🐝</div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {tiles.map(([k, v]) => (
            <div key={k} className="card" style={{ padding: '16px 18px' }}>
              <div className="eyebrow" style={{ letterSpacing: '0.09em' }}>{k}</div>
              <div style={{ fontSize: 27, fontWeight: 740, marginTop: 5, fontVariantNumeric: 'tabular-nums', color: k === 'Total views' ? 'var(--honey)' : 'var(--text)' }}>{v}</div>
            </div>
          ))}
        </div>

        {intel?.facts && (() => {
          const f = intel.facts;
          const cases = [
            f.topPlatform && ['Top platform', PLAT[f.topPlatform.platform]?.split(' ').slice(1).join(' ') || f.topPlatform.platform, `${f.topPlatform.sharePct}% of all views`, '#2ad4c8'],
            f.bestClip && ['Breakout clip', `${nf(f.bestClip.views)} views`, f.bestClip.handle ? `@${f.bestClip.handle}` : f.bestClip.clipper, 'var(--violet)'],
            f.deltaPct != null && ['vs last cycle', `${f.deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(f.deltaPct)}%`, 'total reach', f.deltaPct >= 0 ? 'var(--good)' : 'var(--crit)'],
            showMoney && f.investedCents > 0 && ['Invested', formatCents(f.investedCents), f.costPer1kCents != null ? `${formatCents(f.costPer1kCents)} per 1k views` : null, 'var(--honey)'],
            showMoney && intel.roi?.multiple != null && intel.roi.multiple >= 1.5 && ['Ad-spend value', formatCents(intel.roi.adEquivalentCents), `${intel.roi.multiple}× cheaper than ads`, 'var(--good)'],
          ].filter(Boolean);
          if (!cases.length) return null;
          return (
            <div className="card" style={{ borderColor: 'rgba(240,182,74,.35)' }}>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                {cases.map(([k, v, sub, color]) => (
                  <div key={k} style={{ padding: '11px 14px', borderRadius: 11, background: 'var(--surface-2)', borderLeft: `3px solid ${color}`, minWidth: 0 }}>
                    <div className="eyebrow" style={{ letterSpacing: '0.08em', fontSize: 10.5 }}>{k}</div>
                    <div style={{ fontSize: 18, fontWeight: 720, marginTop: 3, fontVariantNumeric: 'tabular-nums', color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
                    {sub && <div className="muted" style={{ fontSize: 11.5, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {(series.length >= 1 || postedSeries.some((p) => p.value > 0)) && (
          <div className="grid watch-charts" style={{ gap: 14 }}>
            <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>Total views — day by day</h2>
              <TrendChart points={filledSeries} />
            </div>
            <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>Views gained each day</h2>
              <DayBars points={gainSeries} />
            </div>
            <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>Clips posted each day</h2>
              <DayBars points={postedSeries} color="var(--violet)" unit="clips" emptyNote="Bars appear as clips get posted." />
            </div>
          </div>
        )}

        {pay.perPlatform.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {pay.perPlatform.map((p) => (
              <div key={p.platform} className="card" style={{ padding: '13px 16px' }}>
                <div className="muted" style={{ fontSize: 13 }}>{PLAT[p.platform]} · {p.clips} clips</div>
                <div style={{ fontSize: 18, fontWeight: 680, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{nf(p.views)} views</div>
              </div>
            ))}
          </div>
        )}

        <div className="card grid" style={{ gap: 4 }}>
          <h2 style={{ margin: '0 0 6px' }}>Top clippers</h2>
          {leaderboard.map((c, i) => (
            <div key={c.clipperId} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 2px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <span style={{ fontFamily: 'var(--mono)', color: i < 3 ? 'var(--honey)' : 'var(--text-3)', width: 26 }}>#{i + 1}</span>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span className="muted" style={{ fontSize: 13 }}>{c.clipCount} clips</span>
              <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{nf(c.views)} views</span>
              {showMoney && <span style={{ color: 'var(--honey)', fontWeight: 650, minWidth: 78, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCents(c.payoutCents)}</span>}
            </div>
          ))}
        </div>

        {clips.length > 0 && (
          <WatchGallery code={params.code} clips={clips.map((c) => ({
            id: c.id, platform: c.platform, url: c.url, account_handle: c.account_handle,
            views: Number(c.views), likes: c.likes, comments: c.comments,
            engagement: c.engagement, thumbnail_url: c.thumbnail_url,
            caption: c.caption, posted_at: c.posted_at ? String(c.posted_at) : null,
            created_at: String(c.created_at), clipper_name: c.clipper_name,
          }))} />
        )}

        <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', padding: '10px 0 30px' }}>
          Read-only snapshot · <span className="brand">ClipHive</span> — where clips make money
        </div>
      </div>

      <style>{`
        .pilllive{font-size:12px;font-family:var(--mono);color:var(--good);border:1px solid rgba(92,217,140,.4);border-radius:999px;padding:3px 10px}
        .watch-charts{grid-template-columns:1fr}
        @media (min-width:1000px){.watch-charts{grid-template-columns:repeat(auto-fit,minmax(360px,1fr));align-items:start}}
      `}</style>
    </div>
  );
}
