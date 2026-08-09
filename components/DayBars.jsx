// Server-rendered SVG bar chart: one bar per calendar day. No client JS.
// points: [{label:'YYYY-MM-DD', value}] — hover a bar for its exact numbers.
import { formatCents } from '../core/payout.mjs';

const nf = (n) => Number(n || 0).toLocaleString('en-US');

export default function DayBars({ points, height = 110, color = 'var(--gold)', unit = 'views', emptyNote = null, money = false }) {
  const fmt = (v) => (money ? formatCents(v) : `${nf(v)} ${unit}`);
  if (!points || points.length < 2) {
    return <div className="muted" style={{ fontSize: 13 }}>{emptyNote || 'Day-by-day bars appear once there is data on at least two days.'}</div>;
  }
  const W = 640;
  const H = height;
  const PAD = 6;
  const max = Math.max(...points.map((p) => p.value));
  const best = points.reduce((a, p) => (p.value > a.value ? p : a), points[0]);
  if (max <= 0) {
    return <div className="muted" style={{ fontSize: 13 }}>{emptyNote || 'Nothing in this window yet.'}</div>;
  }
  const innerW = W - PAD * 2;
  const gap = points.length > 60 ? 0.5 : 1.5;
  const bw = Math.max(1, innerW / points.length - gap);
  const x = (i) => PAD + (i * innerW) / points.length;
  const h = (v) => (v <= 0 ? 0 : Math.max(1.5, ((H - PAD * 2) * v) / max));

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }} role="img" aria-label={`${unit} per day`}>
        {points.map((p, i) => (
          <rect
            key={p.label}
            x={x(i).toFixed(1)}
            y={(H - PAD - h(p.value)).toFixed(1)}
            width={bw.toFixed(1)}
            height={h(p.value).toFixed(1)}
            rx="1"
            fill={color}
            opacity={p.value === best.value ? 1 : 0.55}
          >
            <title>{`${p.label} — ${fmt(p.value)}`}</title>
          </rect>
        ))}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--line-2)" strokeWidth="1" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }} className="muted">
        <span>{points[0].label}</span>
        <span>best day: <strong style={{ color: 'var(--text)' }}>{best.label}</strong> · {fmt(best.value)}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
