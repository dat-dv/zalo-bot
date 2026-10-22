'use client';

import { useEffect } from 'react';

// Ref-counted so stacked overlays (drawer + dialog, nested dialogs) only unlock
// the page once the last one closes.
let activeLocks = 0;
let lockedScrollY = 0;

// iOS Safari (and the installed app) still scrolls the page under an overlay when only
// `overflow: hidden` is set: a touch on the backdrop, or on a sheet too short to scroll,
// chains to the document. Pinning the body with `position: fixed` stops that; the offset
// keeps the page where it was and the scroll position is restored on unlock.
function lockDocumentScroll(): void {
  activeLocks += 1;
  if (activeLocks > 1) return;
  lockedScrollY = window.scrollY;
  const { body } = document;
  document.documentElement.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${lockedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
}

function unlockDocumentScroll(): void {
  activeLocks = Math.max(0, activeLocks - 1);
  if (activeLocks > 0) return;
  const { body } = document;
  document.documentElement.style.overflow = '';
  body.style.overflow = '';
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  window.scrollTo({ top: lockedScrollY, behavior: 'instant' });
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
