'use client';

import { useEffect } from 'react';

// Ref-counted so stacked overlays (drawer + dialog, nested dialogs) only unlock
// the page once the last one closes.
let activeLocks = 0;

function lockDocumentScroll(): void {
  activeLocks += 1;
  if (activeLocks > 1) return;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
}

function unlockDocumentScroll(): void {
  activeLocks = Math.max(0, activeLocks - 1);
  if (activeLocks > 0) return;
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
}

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockDocumentScroll();
    return unlockDocumentScroll;
  }, [active]);
}
