# Calendar Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/calendar/README.md)

## Purpose

`apps/web/src/modules/calendar` provides the Google Calendar data layer, date utilities, and the presentational month grid for the authenticated user's events. The routed page (`/calendar`) is `CalendarScreen` in the dashboard module (`modules/dashboard/presentation/components/calendar-screen.tsx`), which owns view toggle, month navigation, search, edit state, and the list view (`CalendarTable`).

## Files

- `api/calendar-api.ts`: `getCalendarEvents(params)` → `GET API_ROUTES.calendarEvents` with `ICalendarEventsQuery` (`timeMin`, `timeMax`); `updateCalendarEvent(id, data)` → `PATCH /api/calendar/events/:id` (`IUpdateCalendarEventRequest`); `deleteCalendarEvent(id)` → `DELETE /api/calendar/events/:id`.
- `api/calendar-query.ts`: keys `['calendarEvents']` (all) and `['calendarEvents', params]` (range); `useCalendarEventsQuery(params)`, `useUpdateCalendarEventMutation`, `useDeleteCalendarEventMutation`. Both mutations invalidate all `calendarEvents` ranges and `['dashboard']`.
- `model/calendar-date-utils.ts` (+ spec):
  - `getCalendarGridRange(month)`: Monday-first grid covering leading/trailing padding days; returns ISO `timeMin`/`timeMax` (end exclusive, local midnight after last cell).
  - `getEventDateKeys(event)`: local `YYYY-MM-DD` keys for every covered day. Date-only (all-day) ends and timed ends at exactly 00:00 are exclusive.
- `presentation/components/calendar-grid.tsx` (re-exported by `view/calendar-grid.tsx`): `CalendarGrid`.

## `CalendarGrid` (controlled component)

- Props: `events`, `currentDate`, `selectedDate`, `onSelectDate`, edit state (`editingId`, `editDraft`, `onEditDraftChange`, `onSaveEdit`, `onCancelEdit`), `onEdit`, `onDelete`, `isSaving`, `isDeleting`. It holds no server or edit state itself.
- 7-column grid Mon–Sun with localized weekday headers; padding days dimmed; today highlighted; selected day outlined; per-day event count badge.
- Every event of the day renders as a chip (start time + title). Titles are single-line and truncated (`truncate`); full text is in the chip `title` tooltip and the detail panel.
- Selected-day panel lists that day's events with Edit / Delete; inline edit fields: title (required), start, end, location, description.

## Behavior owned by `CalendarScreen` (dashboard module)

- View toggle grid/table (default grid), Today / previous / next month, localized month-year label, client-side search over title/location/description.
- Queries `useCalendarEventsQuery(getCalendarGridRange(currentMonth))`; each month is its own cache entry. Empty result stays empty (no fallback to the dashboard calendar summary).
- Delete asks `window.confirm`. Retry/refresh invalidates all calendar ranges and the dashboard key.
- Shows the "connect Google" hint when `dashboard.user.googleConnected` is false.

## Backend seam

`GoogleResourcesController` (`apps/api/src/google/google-resources.controller.ts`): `GET/POST /api/calendar/events`, `GET/PATCH/DELETE /api/calendar/events/:id`. List returns `{ data: [] }` when the user has no Google authorization or Google errors; rejects `timeMin >= timeMax` (400); default `maxResults` 100. Items map to `ICalendarEventItem` (`id`, `title`, `description`, `location`, `startAt`, `endAt`, ...).
