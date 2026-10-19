'use client';

import { useEffect, useRef, useState } from 'react';

export interface ChatRowMenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  tone?: 'default' | 'danger';
}

/** Small "⋯" overflow menu for secondary per-row user actions. */
export function ChatRowMenu({ items, label }: { items: ChatRowMenuItem[]; label: string }) {
  // The menu is fixed-positioned so the table's overflow-x wrapper cannot clip it.
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const isOpen = position !== null;
  const setIsOpen = (open: boolean) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setPosition(
      open && rect ? { top: rect.bottom + 4, right: window.innerWidth - rect.right } : null,
    );
  };
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setPosition(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={label}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        onClick={() => setIsOpen(!isOpen)}
        title={label}
        type="button"
      >
        ⋯
      </button>
      {position && (
        <div
          className="fixed z-40 min-w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-left shadow-lg dark:border-slate-700 dark:bg-slate-900"
          role="menu"
          style={{ top: position.top, right: position.right }}
        >
          {items.map((item) => (
            <button
              className={`block w-full px-3 py-1.5 text-left text-xs font-medium ${
                item.tone === 'danger'
                  ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
              key={item.key}
              onClick={() => {
                setIsOpen(false);
                item.onSelect();
              }}
              role="menuitem"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
