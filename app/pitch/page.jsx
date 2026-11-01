import Link from 'next/link';
import { requireSession } from '../../lib/auth.mjs';
import { query } from '../../lib/db.mjs';
import { cycleDailySeries, clipsPostedPerDay } from '../../lib/history.mjs';
import { fillDailySeries, dailyGains, minIso } from '../../core/series.mjs';
import Brand, { BrandMark } from '../../components/Brand.jsx';
import TrendChart from '../../components/TrendChart.jsx';
import DayBars from '../../components/DayBars.jsx';

export const dynamic = 'force-dynamic';

// Pitch Kit — manager-only page of screenshot-ready "poster" cards.
// EVERY number is real; NOTHING identifies a client: no campaign names, no
// streamer handles, no clipper names, no account handles, no money.

const nf = (n) => Number(n || 0).toLocaleString('en-US');
const nfc = (n) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n || 0));
const PLAT = {
  tiktok: { label: 'TikTok', glyph: '♪', color: '#2ad4c8' },
  youtube: { label: 'YouTube', glyph: '▶', color: '#f6524f' },
  instagram: { label: 'Instagram', glyph: '◎', color: '#e1568f' },
  twitter: { label: 'X', glyph: '𝕏', color: '#9aa0aa' },
  other: { label: 'Other', glyph: '∙', color: '#9aa0aa' },
};

/** One screenshot-ready poster card: branded corner, big number, sub-line. */
function Poster({ eyebrow, children, accent = 'var(--honey)', wide = false }) {
  return (
    <div className="poster" style={{ gridColumn: wide ? '1 / -1' : 'auto', borderColor: `color-mix(in srgb, ${accent} 35%, var(--line-2))` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="eyebrow" style={{ letterSpacing: '0.1em', fontSize: 11, color: accent }}>{eyebrow}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.9 }}>
          <BrandMark size={15} /><span style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.02em' }}>ClipHive</span>
        </span>
      </div>
      {children}
    </div>
  );
}

export default async function PitchPage() {
  requireSession();

  const [totals, topCycles, bestClip, platSplit] = await Promise.all([
    query(`
      select
        (select coalesce(sum(views),0) from clips where status='approved')::bigint as views,
        (select count(*) from clips where status='approved') as clips,
        (select count(*) from campaigns) as campaigns,
        (select count(*) from clippers where not archived) as clippers,
        (select count(distinct platform) from clips where status='approved') as platforms,
        (select count(*) from cycles) as cycles
    `),
    query(`
      select cy.id, cy.starts_on, cy.ends_on,
             coalesce(sum(c.views),0)::bigint as views,
             count(c.id)::int as clips,
             count(distinct c.clipper_id)::int as clippers
        from cycles cy join clips c on c.cycle_id = cy.id and c.status='approved'
       group by cy.id
       order by views desc limit 3`),
    query(`select platform, views from clips where status='approved' order by views desc limit 1`),
    query(`
      select platform, coalesce(sum(views),0)::bigint as views, count(*)::int as clips
        from clips where status='approved' group by platform order by views desc`),
  ]);

  const t = totals.rows[0];
  const cycles = topCycles.rows;
  const today = new Date().toISOString().slice(0, 10);

  // Top cycle: chart + best single day, all from real history.
  let topSeries = [];
  let topGains = [];
  let bestDay = null;
  let topDays = 0;
  if (cycles[0]) {
    const cy = cycles[0];
    const sparse = await cycleDailySeries(cy.id);
    topSeries = fillDailySeries(sparse, { from: String(cy.starts_on), to: minIso(today, String(cy.ends_on)) });
    topGains = dailyGains(topSeries);
    bestDay = topGains.reduce((a, p) => (p.value > (a?.value ?? 0) ? p : a), null);
    topDays = topSeries.length;
  }

  // Busiest posting day across everything.
  const postedAll = await clipsPostedPerDay({});
  const busiest = postedAll.reduce((a, p) => (p.value > (a?.value ?? 0) ? p : a), null);

  const platTotal = platSplit.rows.reduce((a, r) => a + Number(r.views), 0);
  const LETTER = ['A', 'B', 'C'];

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="topbar">
        <Brand />
        <span className="muted" style={{ fontSize: 13 }}>pitch kit</span>
        <Link href="/" className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>← back to dashboard</Link>
      </div>

      <div className="wrap grid" style={{ gap: 18, maxWidth: 1150 }}>
        <div>
          <div className="eyebrow">Show, don&apos;t tell</div>
          <h1>Pitch kit</h1>
          <p className="muted" style={{ fontSize: 14, margin: '4px 0 0', maxWidth: 640 }}>
            Screenshot any card and drop it in a DM or deck. Every number is your real, live data —
            and none of it identifies a client: no names, no handles, no money. Safe to send to anyone.
          </p>
        </div>

        <div className="grid pitch-grid" style={{ gap: 14 }}>
          {/* HERO */}
          <Poster eyebrow="Delivered to date" wide>
            <div style={{ fontSize: 'clamp(40px, 7vw, 74px)', fontWeight: 800, lineHeight: 1.05, color: 'var(--honey)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              {nf(t.views)} <span style={{ fontSize: 'clamp(18px, 2.4vw, 26px)', fontWeight: 600, color: 'var(--text)' }}>views</span>
            </div>
            <div className="muted" style={{ fontSize: 15.5, marginTop: 8 }}>
              {nf(t.clips)} clips · {nf(t.campaigns)} streamer campaign{Number(t.campaigns) === 1 ? '' : 's'} · a network of {nf(t.clippers)} clippers · {t.platforms} platforms — tracked automatically, checked for fraud, paid on time.
            </div>
          </Poster>

          {/* BEST CYCLE + chart */}
          {cycles[0] && (
            <Poster eyebrow="One campaign, one month" accent="var(--honey)">
              <div style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 780, color: 'var(--honey)', fontVariantNumeric: 'tabular-nums' }}>
                {nfc(cycles[0].views)} views <span style={{ fontSize: 18, color: 'var(--text)', fontWeight: 600 }}>in {topDays} days</span>
              </div>
              <div className="muted" style={{ fontSize: 14, margin: '4px 0 10px' }}>
                one streamer · {nf(cycles[0].clips)} clips · {cycles[0].clippers} clippers working daily
              </div>
              <TrendChart points={topSeries} />
            </Poster>
          )}

          {/* BEST DAY + bars */}
          {bestDay && bestDay.value > 0 && (
            <Poster eyebrow="Peak single day" accent="var(--good)">
              <div style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 780, color: 'var(--good)', fontVariantNumeric: 'tabular-nums' }}>
                +{nf(bestDay.value)} <span style={{ fontSize: 18, color: 'var(--text)', fontWeight: 600 }}>views in 24h</span>
              </div>
              <div className="muted" style={{ fontSize: 14, margin: '4px 0 10px' }}>same campaign — views gained each day</div>
              <DayBars points={topGains} color="var(--good)" />
            </Poster>
          )}

          {/* BREAKOUT CLIP */}
          {bestClip.rows[0] && (
            <Poster eyebrow="Breakout clip" accent="var(--violet)">
              <div style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 780, color: 'var(--violet)', fontVariantNumeric: 'tabular-nums' }}>
                {nf(bestClip.rows[0].views)} <span style={{ fontSize: 18, color: 'var(--text)', fontWeight: 600 }}>views · one clip</span>
              </div>
              <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                found the moment, cut it right, posted on {(PLAT[bestClip.rows[0].platform] || PLAT.other).label} at the right hour.
              </div>
            </Poster>
          )}

          {/* VOLUME */}
          {busiest && busiest.value > 0 && (
            <Poster eyebrow="Output, not luck" accent="#2ad4c8">
              <div style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 780, color: '#2ad4c8', fontVariantNumeric: 'tabular-nums' }}>
                {busiest.value} <span style={{ fontSize: 18, color: 'var(--text)', fontWeight: 600 }}>clips posted in one day</span>
              </div>
              <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                a coordinated clipper team posts every single day — one viral clip is luck, {nf(t.clips)} clips is a system.
              </div>
            </Poster>
          )}

          {/* PLATFORM SPLIT */}
          {platSplit.rows.length > 0 && (
            <Poster eyebrow="Everywhere your audience is" wide>
              <div className="grid" style={{ gap: 9, marginTop: 6 }}>
                {platSplit.rows.map((r) => {
                  const p = PLAT[r.platform] || PLAT.other;
                  const share = platTotal > 0 ? Number(r.views) / platTotal : 0;
                  return (
                    <div key={r.platform}>
                      <div style={{ display: 'flex', gap: 10, fontSize: 14, alignItems: 'baseline' }}>
                        <span style={{ width: 110, fontWeight: 650 }}><span style={{ color: p.color }}>{p.glyph}</span> {p.label}</span>
                        <span className="muted" style={{ fontSize: 12.5 }}>{nf(r.clips)} clips</span>
                        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{nf(r.views)} views</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 4 }}>
                        <div style={{ width: `${Math.max(1, Math.round(share * 100))}%`, height: '100%', background: p.color, opacity: 0.85 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Poster>
          )}

          {/* RUNNER-UP CYCLES — anonymized case list */}
          {cycles.length > 1 && (
            <Poster eyebrow="Recent campaigns" wide accent="var(--text-2)">
              <div className="grid" style={{ gap: 6, marginTop: 4 }}>
                {cycles.map((cy, i) => (
                  <div key={cy.id} style={{ display: 'flex', gap: 12, fontSize: 15, alignItems: 'baseline', borderTop: i ? '1px solid var(--line)' : 'none', paddingTop: i ? 8 : 0 }}>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--honey)', fontWeight: 700 }}>Streamer {LETTER[i]}</span>
                    <span className="muted" style={{ fontSize: 13 }}>{cy.clips} clips · {cy.clippers} clippers</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{nf(cy.views)} views</span>
                  </div>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>identities private — that&apos;s how yours will be treated too.</div>
            </Poster>
          )}

          {/* THE MACHINE */}
          <Poster eyebrow="What you get" wide accent="var(--honey)">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginTop: 6 }}>
              {[
                ['🎯', 'A managed clipper team', 'recruited, briefed, and coordinated for your content'],
                ['📡', 'Automatic view tracking', 'every clip checked on schedule across all platforms'],
                ['🛡', 'Anti-fraud radar', 'bought views, recycled clips and fake accounts get flagged'],
                ['📊', 'A private live dashboard', 'watch your reach climb in real time, day by day'],
              ].map(([ic, k, v]) => (
                <div key={k} style={{ background: 'var(--surface-2)', borderRadius: 11, padding: '12px 14px' }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{ic} {k}</div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{v}</div>
                </div>
              ))}
            </div>
          </Poster>
        </div>

        <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', padding: '6px 0 30px' }}>
          Tip: screenshot one card at a time — they&apos;re composed to stand alone.
        </div>
      </div>

      <style>{`
        .pitch-grid { grid-template-columns: 1fr; }
        @media (min-width: 900px) { .pitch-grid { grid-template-columns: 1fr 1fr; } }
        .poster {
          background: linear-gradient(160deg, var(--surface) 0%, color-mix(in srgb, var(--honey) 4%, var(--surface)) 100%);
          border: 1px solid var(--line-2); border-radius: 16px; padding: 22px 24px;
          display: grid; gap: 4px; align-content: start; min-width: 0;
        }
      `}</style>
    </div>
  );
}
