// Server-safe. Per-platform cards for one clipper, each broken down further by
// the posting ACCOUNT: every linked handle with its live clip count, its views,
// and its share of that platform's reach.
import { formatCents } from '../core/payout.mjs';

const PLAT = {
  tiktok: { label: 'TikTok', glyph: '♪', color: '#2ad4c8' },
  youtube: { label: 'YouTube', glyph: '▶', color: '#f6524f' },
  instagram: { label: 'Instagram', glyph: '◎', color: '#e1568f' },
  facebook: { label: 'Facebook', glyph: 'ⓕ', color: '#4c8bf5' },
  twitter: { label: 'X', glyph: '𝕏', color: '#9aa0aa' },
  other: { label: 'Other', glyph: '∙', color: '#9aa0aa' },
};
const nf = (n) => Number(n || 0).toLocaleString('en-US');

/**
 * clips: rows with { platform, account_handle, views, status } (any statuses —
 * only approved count toward views; pending shows as a count).
 * byPlatform (optional): payout map { [platform]: { payoutCents } } for a money
 * line in each platform header. showMoney gates it (clipper-facing pages).
 */
export default function AccountBreakdown({ clips, byPlatform = {}, showMoney = true }) {
  const platforms = new Map();
  for (const c of clips || []) {
    if (c.status === 'rejected') continue;
    const g = platforms.get(c.platform) || { views: 0, live: 0, pending: 0, accounts: new Map() };
    const handle = String(c.account_handle || '').toLowerCase();
    const a = g.accounts.get(handle) || { views: 0, live: 0, pending: 0 };
    if (c.status === 'approved') {
      g.views += Number(c.views || 0); g.live += 1;
      a.views += Number(c.views || 0); a.live += 1;
    } else { g.pending += 1; a.pending += 1; }
    g.accounts.set(handle, a);
    platforms.set(c.platform, g);
  }
  const groups = [...platforms.entries()].sort((a, b) => b[1].views - a[1].views);
  if (!groups.length) return null;

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, alignItems: 'start' }}>
      {groups.map(([platform, g]) => {
        const p = PLAT[platform] || PLAT.other;
        const pay = byPlatform[platform]?.payoutCents ?? 0;
        const accounts = [...g.accounts.entries()].sort((a, b) => b[1].views - a[1].views);
        return (
          <div key={platform} className="card" style={{ padding: '13px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, fontSize: 13.5, fontWeight: 650 }}>
              <span style={{ color: p.color }}>{p.glyph}</span> {p.label}
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400 }}>
                {g.live} live{g.pending ? ` · ${g.pending} in review` : ''}
              </span>
            </div>
            <div style={{ fontSize: 19, fontWeight: 720, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {nf(g.views)} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-2)' }}>views</span>
              {showMoney && pay > 0 && <span style={{ fontSize: 13.5, color: 'var(--honey)', marginLeft: 8 }}>{formatCents(pay)}</span>}
            </div>
            <div className="grid" style={{ gap: 6, marginTop: 10 }}>
              {accounts.map(([handle, a]) => {
                const share = g.views > 0 ? a.views / g.views : 0;
                return (
                  <div key={handle || '?'}>
                    <div style={{ display: 'flex', gap: 8, fontSize: 12.5, alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {handle ? `@${handle}` : <span className="muted">account unknown</span>}
                      </span>
                      <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                        {a.live} clip{a.live === 1 ? '' : 's'}{a.pending ? ` +${a.pending}` : ''}
                      </span>
                      <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 650, whiteSpace: 'nowrap' }}>{nf(a.views)}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 3 }}>
                      <div style={{ width: `${Math.round(share * 100)}%`, height: '100%', background: p.color, opacity: 0.75 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
