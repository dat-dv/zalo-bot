export type CalendarViewMode = 'agenda' | 'month' | 'list';

/** Phones offer Agenda / Month, larger screens Month / List, so each layout remembers its own. */
export type CalendarViewLayout = 'phone' | 'desktop';

const VIEW_MODES_BY_LAYOUT = {
  phone: ['agenda', 'month'],
  desktop: ['month', 'list'],
} as const satisfies Record<CalendarViewLayout, readonly CalendarViewMode[]>;

export function calendarViewStorageKey(layout: CalendarViewLayout): string {
  return `zalobot:calendar-view:${layout}`;
}

/** A stored view mode, or null when the value is missing or not offered on that layout. */
export function parseCalendarViewMode(
  value: string | null,
  layout: CalendarViewLayout,
): CalendarViewMode | null {
  const allowed: readonly CalendarViewMode[] = VIEW_MODES_BY_LAYOUT[layout];
  return allowed.find((mode) => mode === value) ?? null;
}
