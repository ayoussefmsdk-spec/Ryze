'use client';

/**
 * Per-cycle check schedule editor. Two groups: YouTube (free) and TikTok/IG
 * (paid, ~0.16¢ per clip per check). For each: how many checks per day and at
 * which local times (cycle timezone). value/onChange speak the schedule JSON:
 * { free: {mode:'daily'|'manual', atLocal:[]}, paid: {...} }.
 */

/** n times spread evenly across the day, starting 06:00. */
function evenTimes(n) {
  const out = [];
  const step = (24 * 60) / n;
  for (let i = 0; i < n; i++) {
    const mins = Math.round((6 * 60 + i * step) % (24 * 60));
    out.push(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);
  }
  return [...new Set(out)].sort();
}

const parseTimes = (text) => [...new Set(
  String(text).split(/[,\s]+/).map((t) => t.trim()).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)),
)].sort();

function Group({ label, hint, g, onChange }) {
  const manual = g?.mode === 'manual';
  const times = g?.atLocal || [];

  return (
    <div className="grid" style={{ gap: 7, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13.5 }}>{label}</strong>
        <span className="muted" style={{ fontSize: 11.5 }}>{hint}</span>
        <label style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
          <input type="checkbox" checked={manual}
            onChange={(e) => onChange(e.target.checked ? { mode: 'manual' } : { mode: 'daily', atLocal: evenTimes(1) })} />
          manual only
        </label>
      </div>
      {!manual && (
        <>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12.5 }}>Checks per day:</span>
            <input className="field" style={{ width: 64, padding: '5px 9px' }} inputMode="numeric"
              value={times.length}
              onChange={(e) => {
                const n = Math.min(48, Math.max(1, Math.trunc(Number(e.target.value)) || 1));
                onChange({ mode: 'daily', atLocal: evenTimes(n) });
              }} />
            {[1, 2, 4, 10].map((n) => (
              <button key={n} type="button" className="btn secondary" style={{ padding: '3px 9px', fontSize: 12, borderColor: times.length === n ? 'var(--honey)' : 'var(--line-2)', color: times.length === n ? 'var(--honey)' : 'var(--text-2)' }}
                onClick={() => onChange({ mode: 'daily', atLocal: evenTimes(n) })}>
                {n}×
              </button>
            ))}
          </div>
          <label className="grid" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: 11.5 }}>At these times (cycle timezone) — edit freely, comma-separated HH:MM:</span>
            <input className="field" style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: 12.5 }}
              defaultValue={times.join(', ')}
              key={times.join(',')}
              onBlur={(e) => {
                const t = parseTimes(e.target.value);
                if (t.length) onChange({ mode: 'daily', atLocal: t });
                else e.target.value = times.join(', ');
              }} />
          </label>
        </>
      )}
    </div>
  );
}

export default function ScheduleEditor({ value, onChange }) {
  const v = value || {};
  return (
    <div className="grid" style={{ gap: 8 }}>
      <Group label="▶ YouTube" hint="free — check as often as you like"
        g={v.free} onChange={(g) => onChange({ ...v, free: g })} />
      <Group label="♪ TikTok + ◎ Instagram" hint="paid — ~0.16¢ per clip per check"
        g={v.paid} onChange={(g) => onChange({ ...v, paid: g })} />
    </div>
  );
}
