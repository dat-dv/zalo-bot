'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  calendarViewStorageKey,
  parseCalendarViewMode,
  type CalendarViewLayout,
  type CalendarViewMode,
} from '../../model/calendar-view-mode';

const listeners = new Set<() => void>();
// Fallback when localStorage is unavailable (private mode, blocked site data): the choice
// still holds for this page load.
const memory = new Map<CalendarViewLayout, CalendarViewMode>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changing the view updates this one too.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readViewMode(layout: CalendarViewLayout): CalendarViewMode | null {
  try {
    const stored = parseCalendarViewMode(
      window.localStorage.getItem(calendarViewStorageKey(layout)),
      layout,
    );
    if (stored) return stored;
  } catch {
    // Fall through to the in-memory choice.
  }
  return memory.get(layout) ?? null;
}

/**
 * The calendar view last chosen on this layout, remembered in localStorage across reloads.
 * Null until chosen (and while prerendering, so the static HTML and hydration match).
 */
export function useStoredCalendarViewMode(
  layout: CalendarViewLayout,
): [CalendarViewMode | null, (mode: CalendarViewMode) => void] {
  const storedViewMode = useSyncExternalStore(
    subscribe,
    () => readViewMode(layout),
    () => null,
  );
  const saveViewMode = useCallback(
    (mode: CalendarViewMode) => {
      memory.set(layout, mode);
      try {
        window.localStorage.setItem(calendarViewStorageKey(layout), mode);
      } catch {
        // Keep the in-memory choice when storage is unavailable.
      }
      listeners.forEach((listener) => listener());
    },
    [layout],
  );
  return [storedViewMode, saveViewMode];
}
