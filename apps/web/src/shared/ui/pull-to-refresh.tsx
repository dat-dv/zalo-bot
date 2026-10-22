'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { isDocumentScrollLocked } from '@/shared/hooks/use-body-scroll-lock';
import { useIsCompact, useMediaQuery } from '@/shared/hooks/use-media-query';
import { useLocale } from '@/shared/providers/locale-provider';

/** Pull distance (after resistance) that triggers a refresh on release. */
const TRIGGER_PX = 64;
const MAX_PULL_PX = 96;
// The page moves at half the finger speed, like native pull-to-refresh.
const RESISTANCE = 0.5;

/**
 * Pull-to-refresh for the installed app only: iOS standalone apps have no browser
 * pull-to-refresh, while a browser tab already has its own. Refreshing does what the
 * topbar ↻ button does (refetch every query) and holds the spinner until queries settle.
 */
export function PullToRefresh() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const isCompact = useIsCompact();
  const isStandalone = useMediaQuery('(display-mode: standalone)');
  const enabled = isCompact && isStandalone;
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let startY: number | null = null;

    const setPullDistance = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };

    const handleStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      const pageAtTop = window.scrollY <= 0;
      if (!touch || event.touches.length !== 1 || !pageAtTop) return;
      if (refreshingRef.current || isDocumentScrollLocked()) return;
      startY = touch.clientY;
    };

    const handleMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (startY === null || !touch) return;
      const delta = touch.clientY - startY;
      if (delta <= 0 || window.scrollY > 0) {
        startY = null;
        setPullDistance(0);
        return;
      }
      event.preventDefault();
      setPullDistance(Math.min(MAX_PULL_PX, delta * RESISTANCE));
    };

    const handleEnd = () => {
      if (startY === null) return;
      startY = null;
      if (pullRef.current < TRIGGER_PX) {
        setPullDistance(0);
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
      setPullDistance(TRIGGER_PX);
      void queryClient.invalidateQueries().finally(() => {
        refreshingRef.current = false;
        setRefreshing(false);
        setPullDistance(0);
      });
    };

    window.addEventListener('touchstart', handleStart, { passive: true });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
    return () => {
      window.removeEventListener('touchstart', handleStart);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [enabled, queryClient]);

  if (!enabled || (pull === 0 && !refreshing)) return null;

  const progress = Math.min(1, pull / TRIGGER_PX);
  const label = refreshing
    ? t('pullToRefresh.refreshing')
    : progress >= 1
      ? t('pullToRefresh.release')
      : t('pullToRefresh.pull');

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.5rem)] z-40 flex justify-center"
      style={{ transform: `translateY(${pull - TRIGGER_PX / 2}px)`, opacity: progress }}
    >
      <span className="inline-flex h-8 items-center gap-2 rounded-[3px] border border-slate-200 bg-white px-3 text-[11.5px] font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <span
          aria-hidden="true"
          className={`inline-block text-sm leading-none ${refreshing ? 'animate-spin' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        >
          ↻
        </span>
        {label}
      </span>
    </div>
  );
}
