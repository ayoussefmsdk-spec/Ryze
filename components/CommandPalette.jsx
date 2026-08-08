'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const PAGES = [
  { type: 'page', label: 'Dashboard', href: '/' },
  { type: 'page', label: 'Campaigns', href: '/campaigns' },
  { type: 'page', label: 'Clippers', href: '/roster' },
  { type: 'page', label: 'Payouts', href: '/payouts' },
  { type: 'page', label: 'Performance', href: '/analytics' },
  { type: 'page', label: 'Fraud radar', href: '/fraud' },
];

const TYPE_ICON = { page: '⌂', campaign: '📁', cycle: '🐝', clipper: '👤' };

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(PAGES);
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setResults(PAGES);
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const search = useCallback((value) => {
    setQ(value);
    setSel(0);
    clearTimeout(timer.current);
    const pages = PAGES.filter((p) => p.label.toLowerCase().includes(value.toLowerCase()));
    if (!value.trim()) { setResults(PAGES); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const d = await r.json();
        setResults([...pages, ...(d.results || [])]);
      } catch { setResults(pages); }
    }, 140);
  }, []);

  function go(item) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[sel]); }
  }

  if (!open) return null;

  return (
    <div className="cp-overlay" onClick={() => setOpen(false)}>
      <div className="cp" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cp-input"
          placeholder="Jump to a campaign, cycle, clipper…"
          value={q}
          onChange={(e) => search(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="cp-list">
          {results.length === 0 && <div className="cp-empty">Nothing found for “{q}”</div>}
          {results.map((r, i) => (
            <button key={`${r.type}-${r.href}-${i}`} className={`cp-item${i === sel ? ' sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
              <span className="cp-icon">{TYPE_ICON[r.type] || '·'}</span>
              <span>{r.label}</span>
              <span className="cp-type">{r.type}</span>
            </button>
          ))}
        </div>
        <div className="cp-hint">↑↓ navigate · Enter open · Esc close</div>
      </div>
      <style>{`
        .cp-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(8,7,5,.6); backdrop-filter: blur(4px); display: flex; justify-content: center; padding-top: 14vh; }
        .cp { width: min(560px, 92vw); align-self: flex-start; background: var(--surface); border: 1px solid var(--line-2); border-radius: 14px; overflow: hidden; box-shadow: 0 30px 80px -20px rgba(0,0,0,.7), 0 0 0 1px var(--honey-soft); }
        .cp-input { width: 100%; background: transparent; border: 0; padding: 16px 18px; font-size: 16px; color: var(--text); outline: none; border-bottom: 1px solid var(--line); }
        .cp-list { max-height: 320px; overflow-y: auto; padding: 6px; }
        .cp-item { display: flex; align-items: center; gap: 11px; width: 100%; padding: 10px 12px; border: 0; border-radius: 9px; background: none; color: var(--text); font-size: 14.5px; text-align: left; cursor: pointer; }
        .cp-item.sel { background: var(--honey-soft); color: var(--honey); }
        .cp-icon { width: 20px; text-align: center; }
        .cp-type { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: .08em; }
        .cp-empty { padding: 18px; color: var(--text-3); font-size: 14px; text-align: center; }
        .cp-hint { padding: 9px 16px; border-top: 1px solid var(--line); font-family: var(--mono); font-size: 11px; color: var(--text-3); }
      `}</style>
    </div>
  );
}
