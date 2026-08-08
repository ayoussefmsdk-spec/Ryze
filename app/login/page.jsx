'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      router.replace('/');
      router.refresh();
    } else {
      setError('Wrong password. Try again.');
    }
  }

  return (
    <div className="center-screen">
      <form className="card grid" style={{ width: 340, gap: 16 }} onSubmit={submit}>
        <div>
          <div className="brand" style={{ fontSize: 20 }}>▲ RyZeX</div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Enter your password to continue.</div>
        </div>
        <input
          className="field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div style={{ color: 'var(--crit)', fontSize: 14 }}>{error}</div>}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
