import { headers } from 'next/headers';
import { resolveClipperCode } from '../../../lib/clipperlink.mjs';
import { limited, clientIp } from '../../../lib/ratelimit.mjs';
import { query } from '../../../lib/db.mjs';
import { clipperDailySeries, clipsPostedPerDay } from '../../../lib/history.mjs';
import { fillDailySeries, zeroFillDaily, dailyGains } from '../../../core/series.mjs';
import { formatCents, formatEngagement } from '../../../core/payout.mjs';
import Brand, { BRAND, BeeMascot } from '../../../components/Brand.jsx';
import TrendChart from '../../../components/TrendChart.jsx';
import DayBars from '../../../components/DayBars.jsx';

export const dynamic = 'force-dynamic';

const nf = (n) => Number(n || 0).toLocaleString('en-US');
const PLAT = { youtube: '▶ YouTube', tiktok: '♪ TikTok', instagram: '◎ Instagram', twitter: '𝕏 X', other: '∙ Other' };
const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|twitterbot|linkedin|skype|pinterest|vkshare|embedly|quora|snapchat|applebot/i;

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

/** PUBLIC — a clipper's personal LIVE stats room. Renders fresh on every open. */
export default async function ClipperStatsPage({ params }) {
  const h = headers();
  if (BOT_UA.test(h.get('user-agent') || '')) {
    return <Gate title="Your clipper stats" msg="A private, always-live stats page. Open the link to see your numbers." />;
  }
  const ip = clientIp(h);
  if (limited(`me:${ip}`, { max: 120, windowMs: 15 * 60 * 1000 })) {
    return <Gate title="Slow down" msg="Too many opens from your network — try again in a few minutes." />;
  }

  let res;
  try { res = await resolveClipperCode(params.code); }
  catch { return <Gate title="Something went wrong" msg="Try the link again in a moment." />; }
  if (!res.ok) {
    const map = {
      notfound: ['Invalid link', 'This stats link doesn’t exist. Ask the manager for a fresh one.'],
      revoked: ['Access ended', 'This stats link was turned off by the manager.'],
      expired: ['Link expired', 'This stats link has expired. Ask the manager for a new one.'],
    };
    const [t, m] = map[res.reason] || ['Unavailable', 'This link can’t be opened.'];
    return <Gate title={t} msg={m} />;
  }

  const { clipper, showMoney } = res;

  const [cyclesRes, paidRow, platRes, sparse, postedSparse] = await Promise.all([
    query(
      `select cy.id as cycle_id, cy.name as cycle_name, cy.status, cy.starts_on, cy.ends_on,
              ca.name as campaign_name,
              coalesce(sum(c.views) filter (where c.status='approved'),0)::bigint as views,
              count(c.id) filter (where c.status='approved')::int as clips,
              (select coalesce(sum(p.amount_cents),0) from payouts p
                where p.cycle_id = cy.id and p.clipper_id = $1)::bigint as paid
         from clips c
         join cycles cy on cy.id = c.cycle_id
         join campaigns ca on ca.id = cy.campaign_id
        where c.clipper_id = $1
        group by cy.id, ca.name
        order by cy.starts_on desc`,
      [clipper.id],
    ),
    query(`select coalesce(sum(amount_cents),0)::bigint as paid from payouts where clipper_id = $1`, [clipper.id]),
    query(
      `select platform, coalesce(sum(views),0)::bigint as views, count(*)::int as clips
         from clips where clipper_id = $1 and status = 'approved'
        group by platform order by views desc`,
      [clipper.id],
    ),
    clipperDailySeries(clipper.id),
    clipsPostedPerDay({ clipperId: clipper.id }),
  ]);

  const cycles = cyclesRes.rows;
  const lifetimeViews = cycles.reduce((a, r) => a + Number(r.views), 0);
  const lifetimeClips = cycles.reduce((a, r) => a + Number(r.clips), 0);
  const paidAll = Number(paidRow.rows[0].paid);

  const { rows: engRows } = await query(
    `select coalesce(sum(likes),0)::bigint as l, coalesce(sum(comments),0)::bigint as c,
            coalesce(sum(views) filter (where likes is not null or comments is not null),0)::bigint as v
       from clips where clipper_id = $1 and status = 'approved'`,
    [clipper.id],
  );
  const engagement = Number(engRows[0].v) > 0 ? (Number(engRows[0].l) + Number(engRows[0].c)) / Number(engRows[0].v) : null;

  const today = new Date().toISOString().slice(0, 10);
  const filled = fillDailySeries(sparse, { to: today });
  const gains = dailyGains(filled);
  const posted = zeroFillDaily(postedSparse);

  const tiles = [
    ['Lifetime views', nf(lifetimeViews), true],
    ['Clips live', nf(lifetimeClips)],
    ['Engagement', formatEngagement(engagement)],
    ...(showMoney ? [['Paid all-time', formatCents(paidAll), true]] : []),
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="topbar">
        <Brand />
        <span className="muted" style={{ fontSize: 13 }}>your live stats</span>
        <span className="melive" style={{ marginLeft: 'auto' }}>● live</span>
      </div>

      <div className="wrap grid" style={{ gap: 20, maxWidth: 1200 }}>
        <div>
          <h1 style={{ fontSize: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
            <BeeMascot size={34} /> Hey {clipper.name} 👋
          </h1>
          <div className="muted" style={{ fontSize: 14 }}>
            Your numbers across every campaign — always current, refresh any time.
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {tiles.map(([k, v, accent]) => (
            <div key={k} className="card" style={{ padding: '15px 17px' }}>
              <div className="eyebrow" style={{ letterSpacing: '0.09em' }}>{k}</div>
              <div style={{ fontSize: 25, fontWeight: 730, marginTop: 4, fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--honey)' : 'var(--text)' }}>{v}</div>
            </div>
          ))}
        </div>

        {(filled.length >= 2 || posted.some((p) => p.value > 0)) && (
          <div className="grid me-charts" style={{ gap: 14 }}>
            <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>Total views — day by day</h2>
              <TrendChart points={filled} />
            </div>
            <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>Views gained each day</h2>
              <DayBars points={gains} />
            </div>
            <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>Clips posted each day</h2>
              <DayBars points={posted} color="var(--violet)" unit="clips" emptyNote="Bars appear as your clips get posted." />
            </div>
          </div>
        )}

        {platRes.rows.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            {platRes.rows.map((p) => (
              <div key={p.platform} className="card" style={{ padding: '13px 16px' }}>
                <div className="muted" style={{ fontSize: 13 }}>{PLAT[p.platform] || p.platform} · {p.clips} clips</div>
                <div style={{ fontSize: 18, fontWeight: 680, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{nf(p.views)} views</div>
              </div>
            ))}
          </div>
        )}

        <div className="card grid" style={{ gap: 4 }}>
          <h2 style={{ margin: '0 0 8px' }}>Your cycles</h2>
          {cycles.length === 0 && <div className="muted" style={{ fontSize: 14 }}>No clips in any cycle yet — go post some 🍯</div>}
          {cycles.map((r, i) => (
            <div key={r.cycle_id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '9px 2px', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 14 }}>
              <span style={{ fontWeight: 650 }}>{r.campaign_name}</span>
              <span className="muted">{r.cycle_name}</span>
              <span className="muted" style={{ fontSize: 12.5 }}>{String(r.starts_on).slice(0, 10)} → {String(r.ends_on).slice(0, 10)}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: r.status === 'active' ? 'var(--good)' : 'var(--text-3)', border: '1px solid var(--line-2)', borderRadius: 999, padding: '1px 9px' }}>{r.status}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontVariantNumeric: 'tabular-nums' }}>
                <span>{nf(r.views)} views</span>
                <span className="muted">{r.clips} clips</span>
                {showMoney && Number(r.paid) > 0 && <span style={{ color: 'var(--honey)', fontWeight: 650 }}>{formatCents(r.paid)}</span>}
              </span>
            </div>
          ))}
        </div>

        <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', padding: '10px 0 30px' }}>
          {BRAND.taglineFun} 🍯 · <span className="brand">ClipHive</span>
        </div>
      </div>

      <style>{`
        .melive{font-size:12px;font-family:var(--mono);color:var(--good);border:1px solid rgba(92,217,140,.4);border-radius:999px;padding:3px 10px}
        .me-charts{grid-template-columns:1fr}
        @media (min-width:1000px){.me-charts{grid-template-columns:repeat(auto-fit,minmax(340px,1fr));align-items:start}}
      `}</style>
    </div>
  );
}
