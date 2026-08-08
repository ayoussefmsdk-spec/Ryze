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
import ClipActions from '../../../components/ClipActions.jsx';
import FlagBadges from '../../../components/FlagBadges.jsx';
import TrendChart from '../../../components/TrendChart.jsx';
import { cycleDailySeries, projectSpend } from '../../../lib/history.mjs';
import Shell from '../../../components/Shell.jsx';
import ViewerCodePanel from '../../../components/ViewerCodePanel.jsx';
import ScanPanel from '../../../components/ScanPanel.jsx';
import IntelBand from '../../../components/IntelBand.jsx';
import { cycleIntel } from '../../../lib/intel.mjs';

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
      `select cc.clipper_id, cc.submission_token, cl.name
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
  const clips = clipsRes.rows;
  const roster = rosterRes.rows;
  const changes = changesRes.rows;

  const series = await cycleDailySeries(params.id);
  const projectedCents = ['cpm', 'flat_per_clip'].includes(cycleRow.payout_model) && cycleRow.status !== 'frozen'
    ? projectSpend({ series, endsOn: cycleRow.ends_on, totalPayoutCents: payouts.totalPayoutCents, totalViews: payouts.totalViews })
    : null;
  const intel = await cycleIntel({ cycle: cycleRow, payouts, series, clips });

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
              {cycleRow.starts_on} → {cycleRow.ends_on} · {cycleRow.effective_tz} · {MODEL_LABEL[cycleRow.payout_model]}
            </div>
            <h1 style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {cycleRow.name}
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', padding: '3px 10px', borderRadius: 999, border: '1px solid var(--line-2)', color: frozen ? 'var(--text-2)' : 'var(--good)' }}>
                {frozen ? 'TRACKING STOPPED' : 'active'}
              </span>
            </h1>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <CycleActions cycleId={cycleRow.id} status={cycleRow.status} hasPaidPlatforms={hasPaid} />
            <ViewerCodePanel cycleId={cycleRow.id} />
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

        {/* Intelligence band: recap, ROI proof, pace, money pipeline */}
        <IntelBand recap={intel.recap} roi={intel.roi} pace={intel.pace} moneyStates={intel.moneyStates} />

        {/* Summary ticker */}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {[
            ['Total views', nfmt(payouts.totalViews)],
            [isPot ? 'Distributed' : 'Total payout', formatCents(payouts.totalPayoutCents)],
            ['Clippers', members.length],
            ['Clips', clips.length],
          ].map(([k, v]) => (
            <div key={k} className="card" style={{ padding: '14px 16px' }}>
              <div className="eyebrow" style={{ letterSpacing: '0.08em' }}>{k}</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

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

        {/* Views growth chart + projection */}
        {series.length >= 2 && (
          <div className="card grid" style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>Views over time</h2>
              {projectedCents != null && (
                <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
                  At this pace ≈ <strong style={{ color: 'var(--gold)' }}>{formatCents(projectedCents)}</strong> by {cycleRow.ends_on} (rough estimate)
                </span>
              )}
            </div>
            <TrendChart points={series} />
          </div>
        )}

        {/* Platform totals */}
        {payouts.perPlatform.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {payouts.perPlatform.map((p) => (
              <div key={p.platform} className="card" style={{ padding: '12px 16px' }}>
                <div className="muted" style={{ fontSize: 13, textTransform: 'capitalize' }}>{PLATFORM_ICON[p.platform]} {p.platform} · {p.clips} clips</div>
                <div style={{ fontSize: 17, fontWeight: 650, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {nfmt(p.views)} views{!isPot && <span className="muted"> · {formatCents(p.payoutCents)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leaderboard */}
        <div className="card grid" style={{ gap: 4 }}>
          <h2 style={{ margin: '0 0 8px' }}>Leaderboard</h2>
          {payouts.perClipper.length === 0 && <div className="muted" style={{ fontSize: 14 }}>No approved clips yet — approve some below and check views.</div>}
          {payouts.perClipper.map((p, i) => (
            <details key={p.clipperId} style={{ borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <summary style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 4px', cursor: 'pointer', listStyle: 'none' }}>
                <span style={{ fontFamily: 'var(--mono)', color: i < 3 ? 'var(--gold)' : 'var(--text-3)', width: 26 }}>#{i + 1}</span>
                <Link href={`/clipper/${p.clipperId}`} style={{ color: 'inherit', fontWeight: 650 }}>{p.name}</Link>
                <span className="muted" style={{ fontSize: 13 }}>{p.clipCount} clips</span>
                <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{nfmt(p.views)} views</span>
                <span style={{ fontWeight: 700, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums', minWidth: 84, textAlign: 'right' }}>{formatCents(p.payoutCents)}</span>
              </summary>
              <div style={{ padding: '2px 4px 12px 38px' }} className="grid">
                {Object.entries(p.byPlatform).map(([plat, d]) => (
                  <div key={plat} style={{ display: 'flex', gap: 12, fontSize: 13.5 }} className="muted">
                    <span style={{ textTransform: 'capitalize', width: 90 }}>{PLATFORM_ICON[plat]} {plat}</span>
                    <span>{d.clips} clips</span>
                    <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{nfmt(d.views)} views</span>
                    {!isPot && <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>{formatCents(d.payoutCents)}</span>}
                  </div>
                ))}
                {isPot && <div className="muted" style={{ fontSize: 12.5 }}>Pot/placement models pay per clipper, not per clip.</div>}
              </div>
            </details>
          ))}
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
                <ScanPanel cycleId={cycleRow.id} members={members} />
              </div>
            </div>
            <AddClipForm cycleId={cycleRow.id} members={members} />
          </div>
        )}

        {/* Pending queue */}
        {pending.length > 0 && (
          <div className="card grid" style={{ gap: 12 }}>
            <h2 style={{ margin: 0 }}>Pending review ({pending.length})</h2>
            {pending.map((c) => (
              <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                {c.thumbnail_url && <img src={c.thumbnail_url} alt="" style={{ width: 52, height: 70, objectFit: 'cover', borderRadius: 8 }} />}
                <div className="grid" style={{ gap: 3, flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <strong>{c.clipper_name}</strong>
                    <span className="muted" style={{ fontSize: 13, textTransform: 'capitalize' }}>{PLATFORM_ICON[c.platform]} {c.platform}</span>
                    {c.account_handle && <span className="muted" style={{ fontSize: 13 }}>@{c.account_handle}</span>}
                    <FlagBadges flags={c.flags} />
                  </div>
                  <a href={c.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, wordBreak: 'break-all' }}>{c.url}</a>
                  <div className="muted" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                    {nfmt(c.views)} views · {c.likes == null ? '—' : nfmt(c.likes)} likes · {c.comments == null ? '—' : nfmt(c.comments)} comments · {formatEngagement(c.engagement)}
                  </div>
                </div>
                <ClipActions clip={c} compact />
              </div>
            ))}
          </div>
        )}

        {/* All clips, grouped clipper -> platform */}
        <div className="card grid" style={{ gap: 6 }}>
          <h2 style={{ margin: '0 0 6px' }}>All clips</h2>
          {clips.length === 0 && <div className="muted" style={{ fontSize: 14 }}>No clips yet — add one above or send your clippers their submission links.</div>}
          {[...byClipper.entries()].map(([clipperId, g]) => (
            <details key={clipperId} open>
              <summary style={{ cursor: 'pointer', padding: '8px 0', fontWeight: 650, listStyle: 'none' }}>
                {g.name} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>· {[...g.platforms.values()].flat().length} clips</span>
              </summary>
              <div className="grid" style={{ gap: 6, paddingLeft: 10 }}>
                {[...g.platforms.entries()].map(([plat, platClips]) => (
                  <details key={plat} open>
                    <summary style={{ cursor: 'pointer', padding: '4px 0', fontSize: 14, color: 'var(--text-2)', listStyle: 'none', textTransform: 'capitalize' }}>
                      {PLATFORM_ICON[plat]} {plat} ({platClips.length})
                    </summary>
                    <div className="grid" style={{ gap: 10, padding: '4px 0 10px 14px' }}>
                      {platClips.map((c) => (
                        <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', opacity: c.status === 'rejected' ? 0.45 : 1 }}>
                          {c.thumbnail_url && <img src={c.thumbnail_url} alt="" style={{ width: 40, height: 54, objectFit: 'cover', borderRadius: 6 }} />}
                          <div className="grid" style={{ gap: 2, flex: 1, minWidth: 200 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 13.5 }}>
                              <a href={c.url} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
                                {c.account_handle ? `@${c.account_handle}` : c.url.slice(0, 46)}
                              </a>
                              <span className="muted" style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>{c.status}</span>
                              {c.manual_override && <span className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)', border: '1px solid var(--line-2)', borderRadius: 999, padding: '0 6px' }}>manual</span>}
                              <FlagBadges flags={c.flags} />
                            </div>
                            <div className="muted" style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                              {nfmt(c.views)} views · {c.likes == null ? '—' : nfmt(c.likes)} likes · {c.comments == null ? '—' : nfmt(c.comments)} comments · {formatEngagement(c.engagement)}
                              {payouts.clipPayouts[c.id] != null && c.status === 'approved' && (
                                <span style={{ color: 'var(--gold)' }}> · {formatCents(payouts.clipPayouts[c.id])}</span>
                              )}
                              {c.last_checked_at && <span> · checked {new Date(c.last_checked_at).toLocaleString()}</span>}
                            </div>
                          </div>
                          <ClipActions clip={c} />
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
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
    </Shell>
  );
}
