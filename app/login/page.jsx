'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Brand, { BRAND, BrandMark } from '../../components/Brand.jsx';

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
    <div className="center-screen login-scene">
      <div className="login-glow" aria-hidden="true" />
      <div className="login-comb" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="login-cell" style={{ animationDelay: `${i * 0.7}s` }}>
            <BrandMark size={[46, 30, 62, 26, 38][i]} />
          </span>
        ))}
      </div>

      <form className="card grid login-card" style={{ gap: 18 }} onSubmit={submit}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <Brand size={24} />
          </div>
          <div style={{ fontSize: 13.5, letterSpacing: '0.05em', color: 'var(--honey)', marginTop: 6 }}>{BRAND.tagline}</div>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 12 }}>Manager access — enter your password.</div>
        </div>
        <input
          className="field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div style={{ color: 'var(--crit)', fontSize: 14, textAlign: 'center' }}>{error}</div>}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Enter the hive'}
        </button>
        <div className="muted" style={{ fontSize: 11.5, textAlign: 'center', fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>
          {BRAND.name.toUpperCase()} · PRIVATE OPS
        </div>
      </form>

      <style>{`
        .login-scene { position: relative; overflow: hidden; }
        .login-card { width: min(360px, calc(100vw - 32px)); position: relative; z-index: 2; box-shadow: 0 24px 80px rgba(0,0,0,0.45); }
        .login-glow {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(520px 340px at 50% 38%, color-mix(in srgb, var(--honey) 9%, transparent), transparent 70%),
            radial-gradient(900px 500px at 85% 90%, color-mix(in srgb, var(--honey) 4%, transparent), transparent 70%);
        }
        .login-comb { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
        .login-cell { position: absolute; opacity: 0.12; animation: cellfloat 9s ease-in-out infinite; }
        .login-cell:nth-child(1) { top: 12%; left: 12%; }
        .login-cell:nth-child(2) { top: 22%; right: 16%; }
        .login-cell:nth-child(3) { bottom: 14%; left: 18%; }
        .login-cell:nth-child(4) { top: 55%; right: 10%; }
        .login-cell:nth-child(5) { bottom: 28%; right: 28%; }
        @keyframes cellfloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(4deg); }
        }
        @media (prefers-reduced-motion: reduce) { .login-cell { animation: none; } }
      `}</style>
    </div>
  );
}
