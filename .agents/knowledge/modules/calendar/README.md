# Calendar Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/calendar/README.md)

## Purpose

`apps/web/src/modules/calendar` provides the Google Calendar data layer, date utilities, the presentational month grid and the phone agenda for the authenticated user's events. The routed page (`/calendar`) is `CalendarScreen` in the dashboard module (`modules/dashboard/presentation/components/calendar-screen.tsx`), which owns view toggle, month navigation, search, edit state, and the list view (`CalendarTable`).

## Files

- `api/calendar-api.ts`: `getCalendarEvents(params)` → `GET API_ROUTES.calendarEvents` with `ICalendarEventsQuery` (`timeMin`, `timeMax`); `updateCalendarEvent(id, data)` → `PATCH /api/calendar/events/:id` (`IUpdateCalendarEventRequest`); `deleteCalendarEvent(id)` → `DELETE /api/calendar/events/:id`.
- `api/calendar-query.ts`: keys `['calendarEvents']` (all) and `['calendarEvents', params]` (range); `useCalendarEventsQuery(params)`, `useUpdateCalendarEventMutation`, `useDeleteCalendarEventMutation`. Both mutations invalidate all `calendarEvents` ranges and `['dashboard']`.
- `model/calendar-date-utils.ts` (+ spec):
  - `getCalendarGridRange(month)`: Monday-first grid covering leading/trailing padding days; returns ISO `timeMin`/`timeMax` (end exclusive, local midnight after last cell).
  - `getEventDateKeys(event)`: local `YYYY-MM-DD` keys for every covered day. Date-only (all-day) ends and timed ends at exactly 00:00 are exclusive.
  - `toDateKey(date)`, `addDays(date, n)` (local midnight), `getWeekDays(anchor)` (Mon–Sun week, same layout as the grid), `formatEventTime(value, localeTag)` (`HH:mm` 24h; empty for all-day/invalid), type `CalendarEventDraft`.
- `presentation/components/calendar-grid.tsx` (re-exported by `view/calendar-grid.tsx`): `CalendarGrid`.
- `presentation/components/calendar-agenda.tsx` (re-exported by `view/calendar-agenda.tsx`): `CalendarAgenda` (phone view). Each day section is keyed by date and uses `animate-row-in`, so a newly picked day eases in; event rows are `data-press="none"` (background press state, no shrink). Month-grid count badge and event chip use `rounded-[2px]` (no pills).
- `presentation/components/calendar-event-fields.tsx`: `CalendarEventFields`, the edit inputs shared by the grid day panel and the agenda sheet (`autoFocusTitle` prop; inputs 40px full width at phone).

## `CalendarGrid` (controlled component)

- Props: `events`, `currentDate`, `selectedDate`, `onSelectDate`, edit state (`editingId`, `editDraft`, `onEditDraftChange`, `onSaveEdit`, `onCancelEdit`), `onEdit`, `onDelete`, `isSaving`, `isDeleting`. It holds no server or edit state itself.
- 7-column grid Mon–Sun with localized weekday headers; padding days dimmed; today highlighted; selected day outlined; per-day event count badge.
- Every event of the day renders as a chip (start time + title). Titles are single-line and truncated (`truncate`); full text is in the chip `title` tooltip and the detail panel.
- Selected-day panel lists that day's events with Edit / Delete; inline edit fields: title (required), start, end, location, description.
- Phone (<= 640px): cells shrink to 52px min height; text chips and the count badge are hidden, replaced by up to 3 dots per busy day (cells are ~50px wide). Day-panel cards stack, Edit/Delete/Save/Cancel become 40px.

## `CalendarAgenda` (phone default, controlled)

Why: a 7-column month grid at 375px cannot show event text, so phones start on a list.

- Same edit/delete props as the grid plus `selectedDate`, `onSelectDate`, `loading`.
- Week strip: prev-week / next-week buttons (40px) and 7 day buttons (40px tall: weekday, day number, dot when the day has events); today tinted, selected filled sky. Prev/next shift the selected date by 7 days.
- List: the selected day first (always shown; empty → `calendar.noEventsOnDay`), then later days of the same week that have events, each under a day heading. Rows are flat `border-b` buttons, min 52px: time range (`calendar.allDay` for all-day) + title, location · description on line 2. Loading: 3 skeleton rows.
- Tap a row → `Modal` bottom sheet: time, location, description; sticky footer Delete / Edit. Edit swaps the body to `CalendarEventFields` (no autofocus) with Cancel / Save. Closing the sheet while editing cancels the edit; the sheet closes when its event leaves the list.

## Behavior owned by `CalendarScreen` (dashboard module)

- View toggle grid/table (default grid), Today / previous / next month, localized month-year label, client-side search over title/location/description.
- Phone (`useIsPhone`): an extra Agenda toggle appears and is the default until the user picks another view (a chosen Agenda falls back to grid above 640px). In agenda mode, previous/next month also move the selected date to the 1st of that month, and picking a day in another month moves `currentMonth` (the query range always covers the selected week). Toolbar at phone: Today/prev/next 40px, view chips in one sideways-scrolling row (`MOBILE_TOOLBAR_ROW`), search full width 40px.
- `CalendarTable` list mode (<= 960px): primary title, trailing start (`dd/MM HH:mm`, `dd/MM` for all-day), secondary location · description; edit via the row sheet's Edit button (title input does not autofocus on compact).
- Queries `useCalendarEventsQuery(getCalendarGridRange(currentMonth))`; each month is its own cache entry. Empty result stays empty (no fallback to the dashboard calendar summary).
- Delete asks `window.confirm`. Retry/refresh invalidates all calendar ranges and the dashboard key.
- Shows the "connect Google" hint when `dashboard.user.googleConnected` is false.

## Backend seam

`GoogleResourcesController` (`apps/api/src/google/google-resources.controller.ts`): `GET/POST /api/calendar/events`, `GET/PATCH/DELETE /api/calendar/events/:id`. List returns `{ data: [] }` when the user has no Google authorization or Google errors; rejects `timeMin >= timeMax` (400); default `maxResults` 100. Items map to `ICalendarEventItem` (`id`, `title`, `description`, `location`, `startAt`, `endAt`, ...).
