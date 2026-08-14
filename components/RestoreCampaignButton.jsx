'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** One-click restore for an archived campaign — brings it back everywhere. */
export default function RestoreCampaignButton({ campaignId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restore() {
    setBusy(true);
    await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ archived: false }),
    }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  return (
    <button className="btn secondary" style={{ padding: '4px 12px', fontSize: 12.5 }} disabled={busy} onClick={restore}>
      {busy ? '…' : '↩ Restore'}
    </button>
  );
}
