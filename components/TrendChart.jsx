// Server-rendered SVG line chart — no client JS. points: [{label, value}].
export default function TrendChart({ points, height = 120, color = 'var(--gold)' }) {
  if (!points || points.length < 2) {
    return <div className="muted" style={{ fontSize: 13 }}>Not enough history yet — the chart appears after a couple of checks on different days.</div>;
  }
  const W = 640;
  const H = height;
  const PAD = 6;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i) => PAD + (i * (W - PAD * 2)) / (points.length - 1);
  const y = (v) => H - PAD - ((v - min) * (H - PAD * 2)) / span;
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${PAD},${H - PAD} ${line} ${(W - PAD).toFixed(1)},${H - PAD}`;
  const last = points[points.length - 1];
  const first = points[0];

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }} role="img" aria-label="views over time">
        <polygon points={area} fill={color} opacity="0.12" />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r="3.5" fill={color} />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }} className="muted">
        <span>{first.label} · {Number(first.value).toLocaleString('en-US')}</span>
        <span>{last.label} · <strong style={{ color: 'var(--text)' }}>{Number(last.value).toLocaleString('en-US')}</strong></span>
      </div>
    </div>
  );
}
