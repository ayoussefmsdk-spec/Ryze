import { hasSession } from '../../../../../lib/auth.mjs';
import { query } from '../../../../../lib/db.mjs';
import { computeCyclePayouts } from '../../../../../lib/payouts.mjs';

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET — download the cycle's clips + payouts as a CSV file. */
export async function GET(_req, { params }) {
  if (!hasSession()) return new Response('unauthorized', { status: 401 });

  const p = await computeCyclePayouts(params.id);
  const { rows: clips } = await query(
    `select c.id, cl.name as clipper, c.platform, c.url, c.status, c.views, c.likes,
            c.comments, c.engagement, c.flags, c.posted_at, c.last_checked_at
       from clips c join clippers cl on cl.id = c.clipper_id
      where c.cycle_id = $1 order by cl.name, c.platform`,
    [params.id],
  );

  const lines = [];
  lines.push('CLIPS');
  lines.push('clipper,platform,url,status,views,likes,comments,engagement,payout_usd,flags,posted_at,last_checked_at');
  for (const c of clips) {
    const payout = p.clipPayouts[c.id] != null ? (p.clipPayouts[c.id] / 100).toFixed(2) : '';
    lines.push([
      c.clipper, c.platform, c.url, c.status, c.views, c.likes ?? '', c.comments ?? '',
      c.engagement ?? '', payout, (c.flags || []).join('|'), c.posted_at ?? '', c.last_checked_at ?? '',
    ].map(csvCell).join(','));
  }
  lines.push('');
  lines.push('PAYOUTS PER CLIPPER');
  lines.push('clipper,payment_handle,clips,views,payout_usd');
  for (const r of p.perClipper) {
    lines.push([r.name, r.paymentHandle ?? '', r.clipCount, r.views, (r.payoutCents / 100).toFixed(2)].map(csvCell).join(','));
  }
  lines.push('');
  lines.push(`total_views,${p.totalViews}`);
  lines.push(`total_payout_usd,${(p.totalPayoutCents / 100).toFixed(2)}`);

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="ryzex-cycle-${params.id.slice(0, 8)}.csv"`,
    },
  });
}
