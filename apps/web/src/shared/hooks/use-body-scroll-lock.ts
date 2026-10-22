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

/** True while a drawer or dialog holds the page still (gestures on the page should stand down). */
export function isDocumentScrollLocked(): boolean {
  return activeLocks > 0;
}

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockDocumentScroll();
    return unlockDocumentScroll;
  }, [active]);
}
