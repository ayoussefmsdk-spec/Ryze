import Link from 'next/link';
import Brand from '../../../components/Brand.jsx';
import { notFound } from 'next/navigation';
import { requireSession } from '../../../lib/auth.mjs';
import { query } from '../../../lib/db.mjs';
import { computeCyclePayouts } from '../../../lib/payouts.mjs';
import { formatCents, formatEngagement } from '../../../core/payout.mjs';
import CycleActions from '../../../components/CycleActions.jsx';
import MembersPanel from '../../../components/MembersPanel.jsx';
import AddClipForm from '../../../components/AddClipForm.jsx';
import TriageQueue from '../../../components/TriageQueue.jsx';
import TrendChart from '../../../components/TrendChart.jsx';
import DayBars from '../../../components/DayBars.jsx';
import { cycleDailySeries, clipsPostedPerDay, projectSpend } from '../../../lib/history.mjs';
import { fillDailySeries, zeroFillDaily, dailyGains, minIso } from '../../../core/series.mjs';
import Shell from '../../../components/Shell.jsx';
import ViewerCodePanel from '../../../components/ViewerCodePanel.jsx';
import ScanPanel from '../../../components/ScanPanel.jsx';
import IntelBand from '../../../components/IntelBand.jsx';
import { cycleIntel } from '../../../lib/intel.mjs';
import CycleSettings from '../../../components/CycleSettings.jsx';
import { gmtLabel } from '../../../lib/tz.mjs';
import ClipGallery from '../../../components/ClipGallery.jsx';

export const dynamic = 'force-dynamic';

const MODEL_LABEL = {
  cpm: 'CPM — pay per 1,000 views',
  pot_proportional: 'Pot — split by view share',
  pot_equal: 'Pot — equal split',
  placement: 'Placement prizes',
  flat_per_clip: 'Flat per clip',
};

const PLATFORM_ICON = { youtube: '▶', tiktok: '♪', instagram: '◎', twitter: '𝕏', other: '∙' };

function nfmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

const BAND_COLOR = { ok: 'var(--good)', warn: '#f6a64b', critical: '#f6a64b', over: 'var(--crit)' };

export default async function CyclePage({ params }) {
  requireSession();

  const cycleRow = (await query(
    `select cy.*, ca.name as campaign_name, ca.id as campaign_id,
            coalesce(cy.timezone, ca.timezone) as effective_tz
       from cycles cy join campaigns ca on ca.id = cy.campaign_id where cy.id = $1`,
    [params.id],
  )).rows[0];
  if (!cycleRow) notFound();

  const [payouts, membersRes, clipsRes, rosterRes, changesRes] = await Promise.all([
    computeCyclePayouts(params.id),
    query(
      `select cc.clipper_id, cc.submission_token, cc.token_revoked, cc.token_expires_at,
              cc.stats_token, cc.stats_token_revoked, cc.stats_token_expires_at,
              cc.stats_token_uses, cc.stats_token_last_used_at, cl.name
         from cycle_clippers cc join clippers cl on cl.id = cc.clipper_id
        where cc.cycle_id = $1 order by cl.name`,
      [params.id],
    ),
    query(
      `select c.*, cl.name as clipper_name
         from clips c join clippers cl on cl.id = c.clipper_id
        where c.cycle_id = $1
        order by cl.name, c.platform, c.created_at desc`,
      [params.id],
    ),
    query(`select id, name from clippers where not archived order by name`),
    query(
      `select field, old_value, new_value, note, changed_at
         from cycle_changes where cycle_id = $1 order by changed_at desc limit 30`,
      [params.id],
    ),
  ]);

  const members = membersRes.rows;
  // Linked accounts per member — powers the scan panel's account picker.
  const accountsByClipper = {};
  if (members.length) {
    const { rows: accRows } = await query(
      `select clipper_id, platform, handle from clipper_accounts
        where clipper_id = any($1) order by platform, handle`,
      [members.map((m) => m.clipper_id)],
    );
    for (const a of accRows) {
      (accountsByClipper[a.clipper_id] ??= []).push({ platform: a.platform, handle: a.handle });
    }
  }
  const clips = clipsRes.rows;
  const roster = rosterRes.rows;
  const changes = changesRes.rows;

  const series = await cycleDailySeries(params.id);
  // Charts run on real calendar days — cycle start through today (or its end).
  const todayIso = new Date().toISOString().slice(0, 10);
  const filledSeries = fillDailySeries(series, {
    from: String(cycleRow.starts_on),
    to: minIso(todayIso, String(cycleRow.ends_on)),
  });
  const gainSeries = dailyGains(filledSeries);
  // Posting cadence: clips per day by the PLATFORM's post date (posted_at).
  const postedSeries = zeroFillDaily(await clipsPostedPerDay({ cycleId: params.id }), {
    from: String(cycleRow.starts_on),
    to: minIso(todayIso, String(cycleRow.ends_on)),
  });
  const projectedCents = ['cpm', 'flat_per_clip'].includes(cycleRow.payout_model) && cycleRow.status !== 'frozen'
    ? projectSpend({ series, endsOn: cycleRow.ends_on, totalPayoutCents: payouts.totalPayoutCents, totalViews: payouts.totalViews })
    : null;
  const intel = await cycleIntel({ cycle: cycleRow, payouts, series, clips });
  const cpmMap = Object.fromEntries(
    (await query(`select platform, cpm_cents from cycle_cpm where cycle_id = $1`, [params.id]))
      .rows.map((r) => [r.platform, Number(r.cpm_cents)]),
  );

  const pending = clips.filter((c) => c.status === 'pending');
  const flagged = clips.filter((c) => c.flags?.length > 0 && c.status !== 'rejected');
  const isPot = ['pot_proportional', 'pot_equal', 'placement'].includes(cycleRow.payout_model);
  const frozen = cycleRow.status === 'frozen';
  const hasPaid = clips.some((c) => c.platform === 'tiktok' || c.platform === 'instagram');

  // Group clips: clipper -> platform -> clips.
  const byClipper = new Map();
  for (const c of clips) {
    if (!byClipper.has(c.clipper_id)) byClipper.set(c.clipper_id, { name: c.clipper_name, platforms: new Map() });
    const g = byClipper.get(c.clipper_id).platforms;
    if (!g.has(c.platform)) g.set(c.platform, []);
    g.get(c.platform).push(c);
  }

  const budgetPct = Math.min(payouts.budget.pct, 100);

  // Weighted engagement: (all likes + comments) / (all views), over approved
  // clips that actually have engagement data. Per-clipper version for the board.
  function weightedEngagement(list) {
    let inter = 0;
    let vws = 0;
    for (const c of list) {
      if (c.status !== 'approved') continue;
      if (c.likes == null && c.comments == null) continue;
      inter += Number(c.likes || 0) + Number(c.comments || 0);
      vws += Number(c.views || 0);
    }
    return vws > 0 ? inter / vws : null;
  }
  const cycleEngagement = weightedEngagement(clips);
  const engagementByClipper = new Map(
    [...byClipper.keys()].map((id) => [id, weightedEngagement(clips.filter((c) => c.clipper_id === id))]),
  );

  return (
    <Shell breadcrumb={<>
      <Link href={`/campaign/${cycleRow.campaign_id}`} className="muted" style={{ fontSize: 14 }}>{cycleRow.campaign_name}</Link>
      <span className="muted">›</span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{cycleRow.name}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
        <a href={`/api/cycles/${params.id}/export`} className="muted" style={{ fontSize: 13.5 }}>CSV</a>
        <Link href={`/cycle/${params.id}/report`} className="muted" style={{ fontSize: 13.5 }}>Report</Link>
      </div>
    </>}>
      <div className="grid" style={{ gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'start', flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">
              {cycleRow.starts_on} → {cycleRow.ends_on} · {gmtLabel(cycleRow.effective_tz)} · {MODEL_LABEL[cycleRow.payout_model]}
            </div>
            <h1 style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {cycleRow.name}
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', padding: '3px 10px', borderRadius: 999, border: '1px solid var(--line-2)', color: frozen ? 'var(--text-2)' : 'var(--good)' }}>
                {frozen ? 'TRACKING STOPPED' : 'active'}
              </span>
            </h1>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <CycleActions cycleId={cycleRow.id} status={cycleRow.status} hasPaidPlatforms={hasPaid} endsOn={String(cycleRow.ends_on)} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <CycleSettings cycle={cycleRow} cpm={cpmMap} />
              <ViewerCodePanel cycleId={cycleRow.id} />
            </div>
          </div>
        </div>

        {/* Alerts strip */}
        {(pending.length > 0 || flagged.length > 0 || payouts.budget.band !== 'ok') && (
          <div className="card" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '12px 16px', borderColor: payouts.budget.band === 'over' ? 'var(--crit)' : 'var(--line-2)' }}>
            {payouts.budget.band !== 'ok' && (
              <span style={{ fontSize: 14, color: BAND_COLOR[payouts.budget.band] }}>
                ● Budget {payouts.budget.pct}% {payouts.budget.over ? '— OVER the cap. Raise it or stop tracking.' : 'used'}
              </span>
            )}
            {pending.length > 0 && <span style={{ fontSize: 14 }}>◔ {pending.length} clip{pending.length > 1 ? 's' : ''} waiting for review</span>}
            {flagged.length > 0 && <span style={{ fontSize: 14, color: 'var(--crit)' }}>⚑ {flagged.length} flagged clip{flagged.length > 1 ? 's' : ''}</span>}
          </div>
        )}

        {/* Intelligence band — the ONE stats row: cases, pace, money pipeline */}
        <IntelBand
          facts={{
            ...(intel.facts ?? {
              totalViews: payouts.totalViews,
              clipCount: clips.filter((c) => c.status === 'approved').length,
              investedCents: payouts.totalPayoutCents,
              topPlatform: null, bestClip: null, costPer1kCents: null, deltaPct: null,
            }),
            engagement: cycleEngagement,
            roster: members.length,
            totalClips: clips.length,
            pendingCount: pending.length,
            isPot,
          }}
          pace={intel.pace}
          moneyStates={intel.moneyStates}
        />

        {/* Budget bar */}
        {Number(cycleRow.budget_cap_cents) > 0 && (
          <div className="card grid" style={{ gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span className="muted">{isPot ? 'Pot' : 'Budget'}: {formatCents(cycleRow.budget_cap_cents)}</span>
              <span style={{ color: BAND_COLOR[payouts.budget.band], fontVariantNumeric: 'tabular-nums' }}>
                {payouts.budget.pct}% {payouts.budget.over ? 'OVER' : ''}
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ width: `${budgetPct}%`, height: '100%', borderRadius: 999, background: BAND_COLOR[payouts.budget.band], transition: 'width .3s' }} />
            </div>
          </div>
        )}

        {/* Views growth: cumulative + gained-per-day, on real calendar dates */}
        {(series.length >= 1 || postedSeries.some((p) => p.value > 0)) && (
          <div className="grid chart-cols" style={{ gap: 16 }}>
            <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0 }}>Total views — day by day</h2>
                {projectedCents != null && (
                  <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
                    At this pace ≈ <strong style={{ color: 'var(--gold)' }}>{formatCents(projectedCents)}</strong> by {cycleRow.ends_on} (rough estimate)
                  </span>
                )}
              </div>
              <TrendChart points={filledSeries} />
            </div>
            <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
              <h2 style={{ margin: 0 }}>Views gained each day</h2>
              <DayBars points={gainSeries} />
            </div>
            <div className="card grid" style={{ gap: 10, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <h2 style={{ margin: 0 }}>Clips posted each day</h2>
                <span className="muted" style={{ fontSize: 11.5, marginLeft: 'auto', fontFamily: 'var(--mono)' }}>platform post date</span>
              </div>
              <DayBars points={postedSeries} color="var(--violet)" unit="clips" emptyNote="Bars appear as clips get posted across the cycle's days." />
            </div>
          </div>
        )}

        {/* Platform totals */}
        {payouts.perPlatform.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {payouts.perPlatform.map((p) => (
              <div key={p.platform} className="card" style={{ padding: '12px 16px' }}>
                <div className="muted" style={{ fontSize: 13, textTransform: 'capitalize' }}>
                  {PLATFORM_ICON[p.platform]} {p.platform} · {p.clips} clips · ♥ {formatEngagement(weightedEngagement(clips.filter((c) => c.platform === p.platform)))}
                </div>
                <div style={{ fontSize: 17, fontWeight: 650, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {nfmt(p.views)} views{!isPot && <span className="muted"> · {formatCents(p.payoutCents)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard */}
        <div className="card grid" style={{ gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h2 style={{ margin: 0 }}>Leaderboard</h2>
            {payouts.perClipper.length > 0 && (
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 12.5, fontFamily: 'var(--mono)' }}>
                share of {nfmt(payouts.totalViews)} views
              </span>
            )}
          </div>
          {payouts.perClipper.length === 0 && <div className="muted" style={{ fontSize: 14 }}>No approved clips yet — approve some below and check views.</div>}
          {payouts.perClipper.map((p, i) => {
            const MEDAL = ['#f0b64a', '#c8ccd6', '#cd8f57'];
            const rankColor = i < 3 ? MEDAL[i] : 'var(--text-3)';
            const share = payouts.totalViews > 0 ? p.views / payouts.totalViews : 0;
            return (
              <details key={p.clipperId} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '11px 4px 9px' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'var(--mono)', fontWeight: 700, fontSize: i < 3 ? 15 : 13,
                      color: rankColor, width: 30, textAlign: 'center', flexShrink: 0,
                      textShadow: i === 0 ? '0 0 12px rgba(240,182,74,0.5)' : 'none',
                    }}>#{i + 1}</span>
                    <Link href={`/cycle/${cycleRow.id}/clipper/${p.clipperId}`} style={{ color: 'inherit', fontWeight: 680, fontSize: 15 }}>{p.name}</Link>
                    <Link href={`/cycle/${cycleRow.id}/clipper/${p.clipperId}`} className="muted" style={{ fontSize: 12, border: '1px solid var(--line-2)', borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>
                      details ↗
                    </Link>
                    <span style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                      {Object.keys(p.byPlatform).map((plat) => (
                        <span key={plat} className="muted" title={plat} style={{ fontSize: 12, border: '1px solid var(--line)', borderRadius: 999, padding: '1px 7px' }}>
                          {PLATFORM_ICON[plat]} {p.byPlatform[plat].clips}
                        </span>
                      ))}
                    </span>
                    <span className="muted" style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }} title="engagement — (likes+comments)/views">
                      ♥ {formatEngagement(engagementByClipper.get(p.clipperId))}
                    </span>
                    <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {nfmt(p.views)} <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>({Math.round(share * 100)}%)</span>
                    </span>
                    <span style={{ fontWeight: 750, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums', minWidth: 84, textAlign: 'right', fontSize: 15 }}>{formatCents(p.payoutCents)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 8, marginLeft: 42 }}>
                    <div style={{ width: `${Math.max(2, share * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${rankColor}, color-mix(in srgb, ${rankColor} 45%, transparent))` }} />
                  </div>
                </summary>
                <div style={{ padding: '4px 4px 12px 42px' }} className="grid">
                  {Object.entries(p.byPlatform).map(([plat, d]) => (
                    <div key={plat} style={{ display: 'flex', gap: 12, fontSize: 13.5 }} className="muted">
                      <span style={{ textTransform: 'capitalize', width: 90 }}>{PLATFORM_ICON[plat]} {plat}</span>
                      <span>{d.clips} clips</span>
                      <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{nfmt(d.views)} views</span>
                      {!isPot && <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>{formatCents(d.payoutCents)}</span>}
                    </div>
                  ))}
                  {isPot && <div className="muted" style={{ fontSize: 12.5 }}>Pot/placement models pay per clipper, not per clip.</div>}
                  <div style={{ display: 'flex', gap: 14, fontSize: 12.5 }}>
                    <Link href={`/cycle/${cycleRow.id}/clipper/${p.clipperId}`}>Charts &amp; details for this cycle →</Link>
                    <Link href={`/clipper/${p.clipperId}`} className="muted">All-time profile →</Link>
                  </div>
                </div>
              </details>
            );
          })}
        </div>

        {/* Clippers in this cycle + submission links */}
        <div className="card grid" style={{ gap: 10 }}>
          <h2 style={{ margin: 0 }}>Clippers in this cycle</h2>
          <MembersPanel cycleId={cycleRow.id} members={members} roster={roster} />
        </div>

        {/* Add clip manually + account scan */}
        {!frozen && members.length > 0 && (
          <div className="card grid" style={{ gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>Add clips</h2>
              <div style={{ marginLeft: 'auto' }}>
                <ScanPanel cycleId={cycleRow.id} members={members} accountsByClipper={accountsByClipper} />
              </div>
            </div>
            <AddClipForm cycleId={cycleRow.id} members={members} />
          </div>
        )}

        {/* Pending queue — keyboard triage (j/k/a/r/o) */}
        {pending.length > 0 && <TriageQueue clips={pending} />}

        {/* All clips — filterable explorer */}
        <div className="card grid" style={{ gap: 6 }}>
          <h2 style={{ margin: '0 0 6px' }}>All clips</h2>
          {clips.length === 0
            ? <div className="muted" style={{ fontSize: 14 }}>No clips yet — add one above or send your clippers their submission links.</div>
            : <ClipGallery clips={clips} clipPayouts={payouts.clipPayouts} isPot={isPot} />}
        </div>

        {/* Change log */}
        {changes.length > 0 && (
          <details className="card">
            <summary style={{ cursor: 'pointer', fontWeight: 650 }}>Change log ({changes.length})</summary>
            <div className="grid" style={{ gap: 4, marginTop: 10 }}>
              {changes.map((ch, i) => (
                <div key={i} className="muted" style={{ fontSize: 13 }}>
                  {new Date(ch.changed_at).toLocaleString()} — <strong>{ch.field}</strong>
                  {ch.old_value ? ` ${ch.old_value} →` : ''} {ch.new_value} {ch.note ? `(${ch.note})` : ''}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <style>{`
        .chart-cols { grid-template-columns: 1fr; }
        @media (min-width: 1100px) { .chart-cols { grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); align-items: start; } }
      `}</style>
    </Shell>
  );
}
