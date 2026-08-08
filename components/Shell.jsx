'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Brand, { BrandMark } from './Brand.jsx';
import CommandPalette from './CommandPalette.jsx';

const NAV = [
  { group: 'Operate', items: [
    { href: '/', label: 'Dashboard', icon: 'grid' },
    { href: '/campaigns', label: 'Campaigns', icon: 'folder' },
    { href: '/roster', label: 'Clippers', icon: 'users' },
  ] },
  { group: 'Money', items: [
    { href: '/payouts', label: 'Payouts', icon: 'cash' },
    { href: '/analytics', label: 'Performance', icon: 'chart' },
    { href: '/fraud', label: 'Fraud radar', icon: 'shield' },
  ] },
];

function Icon({ name }) {
  const p = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    folder: <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.2H19.5A1.5 1.5 0 0 1 21 8.7v9.8A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5Z" />,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M16 6.5a3 3 0 0 1 0 5.6M17.5 19c0-2.2-1-3.8-2.4-4.6" /></>,
    cash: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /></>,
    chart: <><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16l3.5-4 3 2.5L20 8" /></>,
    shield: <><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9.5-4-2-7-5-7-9.5V6z" /><path d="M9.5 12l2 2 3.5-4" /></>,
  }[name];
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  );
}

export default function Shell({ children, breadcrumb }) {
  const path = usePathname() || '/';
  const isActive = (href) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <div className="shell">
      <CommandPalette />
      <aside className="side">
        <div className="side-brand">
          <Brand size={16} />
          <div className="muted" style={{ fontSize: 11, fontFamily: 'var(--mono)', marginTop: 8, opacity: 0.7 }}>⌘K to jump anywhere</div>
        </div>
        <nav className="side-nav">
          {NAV.map((sec) => (
            <div key={sec.group} className="side-group">
              <div className="side-glabel">{sec.group}</div>
              {sec.items.map((it) => (
                <Link key={it.href} href={it.href} className={`side-link${isActive(it.href) ? ' active' : ''}`}>
                  <Icon name={it.icon} />
                  <span>{it.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <form action="/api/logout" method="post" className="side-foot">
          <button className="side-link" type="submit" style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ display: 'inline-flex', width: 18, justifyContent: 'center' }}>⎋</span>
            <span>Log out</span>
          </button>
        </form>
      </aside>

      <main className="main">
        <div className="main-top">
          <Link href="/" className="main-top-mark" aria-label="ClipHive home"><BrandMark size={20} /></Link>
          {breadcrumb}
        </div>
        <div className="main-body">{children}</div>
      </main>

      <style>{`
        .shell { display: grid; grid-template-columns: 232px 1fr; min-height: 100vh; }
        .side {
          position: sticky; top: 0; align-self: start; height: 100vh;
          display: flex; flex-direction: column; gap: 6px;
          border-right: 1px solid var(--line);
          background: linear-gradient(180deg, var(--surface), var(--bg));
          padding: 16px 12px;
        }
        .side-brand { padding: 6px 8px 14px; border-bottom: 1px solid var(--line); margin-bottom: 8px; }
        .side-nav { display: flex; flex-direction: column; gap: 16px; flex: 1; }
        .side-group { display: flex; flex-direction: column; gap: 2px; }
        .side-glabel { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-3); padding: 4px 10px 6px; }
        .side-link {
          display: flex; align-items: center; gap: 11px;
          padding: 9px 11px; border-radius: 9px;
          color: var(--text-2); font-size: 14.5px; font-weight: 550;
          text-decoration: none; transition: background 0.14s, color 0.14s;
        }
        .side-link:hover { background: var(--surface-2); color: var(--text); text-decoration: none; }
        .side-link.active {
          color: var(--honey); background: var(--honey-soft);
          box-shadow: inset 2px 0 0 var(--honey);
        }
        .side-link.active svg { color: var(--honey); }
        .side-foot { border-top: 1px solid var(--line); padding-top: 8px; }
        .main { display: flex; flex-direction: column; min-width: 0; }
        .main-top {
          position: sticky; top: 0; z-index: 15;
          display: flex; align-items: center; gap: 12px;
          height: 54px; padding: 0 22px;
          border-bottom: 1px solid var(--line);
          background: color-mix(in srgb, var(--bg) 84%, transparent);
          backdrop-filter: blur(10px);
        }
        .main-top-mark { display: none; }
        .main-body { padding: 24px 22px 64px; max-width: 1100px; width: 100%; }
        @media (max-width: 760px) {
          .shell { grid-template-columns: 1fr; }
          .side {
            position: sticky; height: auto; flex-direction: row; align-items: center;
            gap: 4px; overflow-x: auto; padding: 8px 10px; border-right: 0; border-bottom: 1px solid var(--line);
          }
          .side-brand, .side-glabel, .side-foot { display: none; }
          .side-nav { flex-direction: row; gap: 4px; }
          .side-group { flex-direction: row; gap: 4px; }
          .side-link span:last-child { display: none; }
          .side-link { padding: 10px; }
          .main-top-mark { display: inline-flex; }
        }
      `}</style>
    </div>
  );
}
