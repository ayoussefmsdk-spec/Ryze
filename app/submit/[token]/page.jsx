import { resolveToken } from '../../../lib/clips.mjs';
import SubmitForm from '../../../components/SubmitForm.jsx';

export const dynamic = 'force-dynamic';

/** PUBLIC page — what a clipper sees when they open their private link. */
export default async function SubmitPage({ params }) {
  const resolved = await resolveToken(params.token);

  if (!resolved) {
    return (
      <div className="center-screen">
        <div className="card" style={{ maxWidth: 380 }}>
          <h2>Link not valid</h2>
          <p className="muted">This submission link doesn’t work anymore. Ask the campaign manager for a fresh one.</p>
        </div>
      </div>
    );
  }

  const { cycle, clipperName } = resolved;
  const closed = cycle.status !== 'active';

  return (
    <div className="center-screen">
      <div className="card grid" style={{ width: 420, maxWidth: '94vw', gap: 14 }}>
        <div>
          <div className="brand" style={{ fontSize: 18 }}>▲ RYZE</div>
          <h2 style={{ margin: '10px 0 2px' }}>Hey {clipperName} 👋</h2>
          <div className="muted" style={{ fontSize: 14 }}>
            Drop your clip links for <strong>{cycle.name}</strong>
            {' '}({String(cycle.starts_on).slice(0, 10)} → {String(cycle.ends_on).slice(0, 10)}).
          </div>
        </div>

        {closed ? (
          <div className="muted">Submissions are closed for this cycle.</div>
        ) : (
          <SubmitForm token={params.token} />
        )}

        <div className="muted" style={{ fontSize: 12.5 }}>
          Paste one link at a time — TikTok, YouTube, Instagram or X. Your submissions go to the manager for review.
        </div>
      </div>
    </div>
  );
}
