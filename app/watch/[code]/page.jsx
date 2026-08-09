import { headers } from 'next/headers';
import { resolveViewerCode } from '../../../lib/viewer.mjs';
import { limited, clientIp } from '../../../lib/ratelimit.mjs';
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
  const [pay, series, clipsRes] = await Promise.all([
    computeCyclePayouts(cycle.id),
    cycleDailySeries(cycle.id),
    query(
      `select c.platform, c.url, c.account_handle, c.views, c.likes, c.comments, c.engagement,
              c.thumbnail_url, cl.name as clipper_name
         from clips c join clippers cl on cl.id = c.clipper_id
        where c.cycle_id = $1 and c.status = 'approved'
        order by c.views desc limit 60`,
      [cycle.id],
    ),
  ]);
  const clips = clipsRes.rows;
  const leaderboard = [...pay.perClipper].sort((a, b) => b.views - a.views);

  let intel = null;
  try {
    intel = await cycleIntel({
      cycle: { ...cycle, campaign_id: cycle.campaign_id },
      payouts: pay,
      series,
      clips: clips.map((c) => ({ ...c, status: 'approved', id: null })),
    });
  } catch { /* the room renders fine without intel */ }

  // Weighted engagement across clips that have real like/comment data.
  let engInter = 0;
  let engViews = 0;
  for (const c of clips) {
    if (c.likes == null && c.comments == null) continue;
    engInter += Number(c.likes || 0) + Number(c.comments || 0);
    engViews += Number(c.views || 0);
  }
  const avgEngagement = engViews > 0 ? engInter / engViews : null;

  const tiles = [
    ['Total views', nf(pay.totalViews)],
    ['Approved clips', clips.length],
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

      <div className="wrap grid" style={{ gap: 22, maxWidth: 980 }}>
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

        {intel?.recap && (
          <div className="card" style={{ borderColor: 'rgba(240,182,74,.35)' }}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>{intel.recap}</p>
            {showMoney && intel.roi?.multiple != null && intel.roi.multiple >= 1.5 && (
              <p style={{ margin: '10px 0 0', fontSize: 14 }}>
                💰 The same reach would cost roughly <b style={{ color: 'var(--honey)' }}>{formatCents(intel.roi.adEquivalentCents)}</b> in
                paid ads — this campaign delivered it <b style={{ color: 'var(--good)' }}>{intel.roi.multiple}× cheaper</b>.
              </p>
            )}
          </div>
        )}

        {series.length >= 2 && (
          <div className="card grid" style={{ gap: 10 }}>
            <h2 style={{ margin: 0 }}>Views over time</h2>
            <TrendChart points={series} />
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
          <div>
            <h2 style={{ margin: '0 0 12px' }}>The clips</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              {clips.map((c, i) => (
                <a key={i} href={c.url} target="_blank" rel="noreferrer" className="card" style={{ padding: 0, overflow: 'hidden', color: 'inherit', display: 'block' }}>
                  {c.thumbnail_url
                    ? <img loading="lazy" src={c.thumbnail_url} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', aspectRatio: '3/4', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>{PLAT[c.platform]?.split(' ')[0]}</div>}
                  <div style={{ padding: '9px 11px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.account_handle ? `@${c.account_handle}` : c.clipper_name}</div>
                    <div className="muted" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>👁 {nf(c.views)} · {formatEngagement(c.engagement)}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', padding: '10px 0 30px' }}>
          Read-only snapshot · <span className="brand">ClipHive</span> — where clips make money
        </div>
      </div>

      <style>{`.pilllive{font-size:12px;font-family:var(--mono);color:var(--good);border:1px solid rgba(92,217,140,.4);border-radius:999px;padding:3px 10px}`}</style>
    </div>
  );
}
