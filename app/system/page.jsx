import Link from 'next/link';
import { requireSession } from '../../lib/auth.mjs';
import { getSystemStatus } from '../../lib/system.mjs';
import Shell from '../../components/Shell.jsx';
import ApifyCapEditor from '../../components/ApifyCapEditor.jsx';

export const dynamic = 'force-dynamic';

function Dot({ ok, label, warn }) {
  const color = warn ? 'var(--warn)' : ok ? 'var(--good)' : 'var(--crit)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', borderTop: '1px solid var(--line)' }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: color, flexShrink: 0 }} />
      <span>{label}</span>
      <span style={{ marginLeft: 'auto', color, fontFamily: 'var(--mono)', fontSize: 13 }}>
        {warn ? 'check' : ok ? 'connected' : 'missing'}
      </span>
    </div>
  );
}

export default async function SystemPage() {
  requireSession();
  let s = null; let error = null;
  try { s = await getSystemStatus(); } catch (e) { error = e.message; }

  const capPct = s ? Math.min(100, Math.round((s.paidChecksToday / Math.max(1, s.apifyDailyCap)) * 100)) : 0;

  return (
    <Shell breadcrumb={<span style={{ fontSize: 14, fontWeight: 600 }}>System</span>}>
      <div className="grid" style={{ gap: 20, maxWidth: 720 }}>
        <div>
          <div className="eyebrow">Health &amp; controls</div>
          <h1>System</h1>
          <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>Integrations, spend guard, and the automatic checker at a glance.</p>
        </div>

        {error && <div className="card" style={{ borderColor: 'var(--crit)' }}><p className="muted">{error}</p></div>}

        {s && (
          <>
            <div className="card grid" style={{ gap: 0 }}>
              <h2 style={{ margin: '0 0 4px' }}>Integrations</h2>
              <Dot ok={s.dbOk} label="Database (Postgres)" />
              <Dot ok={s.youtubeKey} label="YouTube Data API key" />
              <Dot ok={s.apifyToken} label="Apify token (TikTok / Instagram)" />
            </div>

            <div className="card grid" style={{ gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0 }}>Apify spend guard</h2>
                <span className="muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{s.paidChecksToday} / {s.apifyDailyCap} paid checks today</span>
              </div>
              <div style={{ height: 9, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ width: `${capPct}%`, height: '100%', background: capPct >= 90 ? 'var(--crit)' : 'var(--honey)' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="muted" style={{ fontSize: 13 }}>Daily cap (hard stop on paid TikTok/IG checks):</span>
                <ApifyCapEditor current={s.apifyDailyCap} />
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {[
                ['Active cycles', s.activeCycles],
                ['On auto-check', s.scheduledCycles],
                ['Live viewer codes', s.liveViewerCodes],
                ['Last check', s.lastCheckAt ? new Date(s.lastCheckAt).toLocaleString() : 'never'],
              ].map(([k, v]) => (
                <div key={k} className="card" style={{ padding: '13px 16px' }}>
                  <div className="eyebrow" style={{ letterSpacing: '0.08em' }}>{k}</div>
                  <div style={{ fontSize: 18, fontWeight: 680, marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <h2 style={{ margin: '0 0 6px' }}>Automatic checker</h2>
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>
                Runs inside the app every 5 minutes, firing each active cycle's schedule in its own timezone —
                YouTube on its (free) cadence, TikTok/Instagram on their paid cadence. Frozen cycles are skipped.
                Set the schedule per cycle in <Link href="/campaigns">its settings</Link>.
              </p>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
