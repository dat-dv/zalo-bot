---
metadata:
  agent-artifact:
    id: module-calendar-knowledge
    type: documentation
    depends_on:
      - apps/api/src/calendar/calendar.service.ts
      - apps/api/src/calendar/calendar.controller.ts
      - apps/api/src/calendar/calendar-event.mapper.ts
      - apps/api/src/calendar/dto/calendar-event.dto.ts
      - apps/api/src/database/entities/calendar-event.entity.ts
      - apps/api/src/database/migrations/1724870000000-CreateCalendarEvents.ts
      - apps/api/src/google/google-calendar.service.ts
      - apps/web/src/modules/calendar/api/calendar-api.ts
      - apps/web/src/modules/calendar/api/calendar-query.ts
      - apps/web/src/modules/calendar/model/calendar-date-utils.ts
      - apps/web/src/modules/calendar/presentation/components/calendar-grid.tsx
      - apps/web/src/modules/calendar/presentation/components/calendar-agenda.tsx
      - apps/web/src/modules/calendar/presentation/components/calendar-day-list.tsx
      - apps/web/src/modules/calendar/presentation/components/calendar-event-card.tsx
      - apps/web/src/modules/calendar/presentation/components/calendar-event-form.tsx
      - apps/web/src/modules/calendar/presentation/components/calendar-event-sheet.tsx
      - apps/web/src/modules/calendar/presentation/components/calendar-summary-strip.tsx
      - apps/web/src/modules/calendar/presentation/components/use-calendar-format.ts
      - apps/web/src/modules/dashboard/presentation/components/calendar-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/calendar-table.tsx
---

# Calendar Module

Owner: Core Engineering Team · Status: active

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/calendar/README.md)

## Purpose

Shared system calendar. Events live in the DB (`calendar_events`); Google Calendar only holds a copy. Before this, events existed only in Google (mostly the admin's shared account), so switching the Google account made them vanish from the dashboard and the bot.

- **Shared like the finance ledger**: every user sees every event; `created_by_user_id` / `created_by_name` / `source` / `source_chat_id` are display-only, never filters.
- **Google copy**: written to the `primary` calendar of `GoogleAuthService.getOAuth2Client(actorId)` (own token, else the shared account), keyed by `(google_account_email, google_event_id)`. Keeps phone reminders from Google Calendar.
- **No Google connected** → event still saved (`sync_status = local`).

## Data: `calendar_events` (migration `1724870000000-CreateCalendarEvents`)

`id` uuid, `title`, `description`, `location`, `start_at`, `end_at` (exclusive; all-day = local midnight after the last day, Google's convention), `all_day`, `time_zone` (default config `timezone`), `reminder_minutes` jsonb (default `[60,30,10,0]`), `created_by_user_id`, `created_by_name`, `source` (`zalo|dashboard|google`), `source_chat_id`, `google_event_id`, `google_account_email`, `sync_status` (`synced|pending|failed|local`), `synced_at`, `deleted_at` (soft delete), timestamps. Indexes: `start_at`, `deleted_at`, partial unique `(google_account_email, google_event_id) WHERE google_event_id IS NOT NULL`.

## Backend: `apps/api/src/calendar/`

`CalendarModule` (imports `GoogleModule` via `forwardRef`; imported by App, Reports, Zalo, Zca modules). `CalendarService` is the only reader/writer of events; `GoogleCalendarService` is a thin client (`listEventsInRange` with pagination up to 10×250, throws on overflow; `insertEvent`, `patchEvent`, `deleteEvent`).

- `createEvent(input, actor)`: save row (`pending` if Google authorized for actor, else `local`) → push copy → `synced` or `failed` (row kept either way).
- `updateEvent(id, patch, actorId)`: DB first, then patch the copy if its account is reachable (actor's client or shared client whose email matches); if unreachable (account switched), re-create the copy in the actor's current account. `''` clears description/location.
- `deleteEvent(id, actorId)`: soft delete; delete the Google copy when reachable (404/410 ignored).
- `resyncEvent(id, actorId)`: same push logic, for `failed`/`local`/old-account events.
- `getEvent(id)`: by uuid, or by `google_event_id` (bot delete actions queued in Redis before the DB move).
- `listEvents({ timeMin, timeMax?, query?, limit?, importForUserId? })`: overlap query (`end_at > timeMin AND start_at < timeMax`), ILIKE on title/location/description, ordered by start, default limit 500.
- **Import from Google** (when `importForUserId` set): for the viewer's account (needs authorization + known email). First time an account is seen: import ±365 days (flag `calendar:initial-import:<email>` in Redis, plus in-memory). Then per `(email, range)` at most every 5 min (in-memory), concurrent callers share one run. Upsert by `(email, google_event_id)`; rows deleted in zalobot are never resurrected; rows of that account starting inside the range that Google no longer returns are soft-deleted (deleted in Google). Written with `callListeners(false)` so bulk imports do not flood `audit_logs`; user writes go through `save()` and are audited.
- `toItems(rows, viewerId)`: `ICalendarEventItem` with creator name (current `users.first_name` wins over the snapshot), source chat name/type (`zca_thread_configs`), `sync { status, accountEmail, isCurrentAccount, syncedAt }` (`isCurrentAccount` = email is the viewer's or the shared account's).

### HTTP (`CalendarController`, Bearer dashboard token, any signed-in user)

| Method | Route (`API_ROUTES`) | Notes |
| --- | --- | --- |
| GET | `calendarEvents` `?timeMin&timeMax&query` | ISO dates; `timeMin < timeMax`; range ≤ 400 days; imports viewer's Google first |
| GET | `calendarEvent(id)` | |
| POST | `calendarEvents` | `CreateCalendarEventDto`: `summary`, `startDateTime`, `endDateTime` (exclusive), `description?`, `location?`, `timeZone?`, `allDay?`, `reminderMinutes?` (≤5 ints, 0–40320) |
| PATCH | `calendarEvent(id)` | all fields optional |
| DELETE | `calendarEvent(id)` | soft delete → `{ deleted: true }` |
| POST | `calendarEventResync(id)` | rewrite the Google copy |

Errors: unknown id → 404; Google failures never fail the request (reflected in `sync.status`).

### Other callers

- `GET /api/dashboard` `calendar`: next 7 days from `CalendarService` (limit 10), independent of Google connection.
- Bot: `/today`, `/week`, `LIST_CALENDAR_EVENTS` read the DB (with import); `DELETE_CALENDAR_EVENT` searches upcoming DB events; `CREATE_CALENDAR_EVENT` no longer requires Google. Confirm (`TransactionConfirmationService`) creates via `CalendarService` with `{ userId, chatId, source: 'zalo' }` and deletes by id. Tasks parts of `/today`, `/week` still need Google.

## Web: `apps/web/src/modules/calendar`

- `api/`: `getCalendarEvents`, `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`, `resyncCalendarEvent`; query keys `['calendarEvents', params]`; `useCalendarEventsQuery(params, enabled)` keeps previous data while navigating; every mutation invalidates all calendar ranges and `['dashboard']`.
- `model/calendar-date-utils.ts` (+ spec): grid range, `getDaysRange`, `getEventDateKeys` (all-day and 00:00 ends exclusive), `groupEventsByDate` (all-day first, then start), phase (`past|ongoing|upcoming`), duration, `isEventUnsynced` (status ≠ synced or other account), form draft (`createEmptyDraft`: next full hour today else 09:00, 1 h; `draftFromEvent`; `draftToRequest`: all-day inclusive last day → exclusive end, null when title empty or end ≤ start).
- Components (re-exported from `view/`): `CalendarGrid`, `CalendarAgenda`, `CalendarDayList` (+ `buildDayGroups`), `CalendarEventCard`, `CalendarEventForm`, `CalendarEventSheet`, `CalendarSummaryStrip`, hook `useCalendarFormat` (range/duration/reminder/sync/origin labels).

## UI (`CalendarScreen` in the dashboard module)

- **Header strip** `CalendarSummaryStrip`: Today, Next 7 days (from a separate today..+15d query), This month, Not on Google (month + upcoming, unique). The last tile toggles an "unsynced only" filter (amber banner with Clear). Counts ignore search/filter. 4 columns, 2 on phones.
- `calendar.localOnlyTip` banner when `dashboard.user.googleConnected === false`.
- **Toolbar** (one row on desktop): `‹ Month YYYY ›`, Today, segmented view switch, search (client-side over title/location/description/creator/chat), `+ Add event` (hidden ≤ 960px; `MobileActionBar` button instead).
- **Desktop/tablet views**: Month (default) or List (`CalendarTable` of the month; row Edit opens the sheet). Month = `CalendarGrid` + right column (300px, sticky above 1180px, stacked below): selected day (`CalendarDayList`) and "Upcoming · 14 days" (compact cards, days with events only).
- **Grid**: fixed cell height (112px, 96px ≤ 1180px, 52px phone); up to 3 chips (time + title; all-day = filled bar) then `+N` (selects the day); past events dimmed; today = filled circle; selected = sky tint. Phone cells show up to 3 dots.
- **Phone (≤ 640px)**: views Agenda (default) / Month. One toolbar row (`‹ month ›`, Today, search icon toggling the search field), segmented control full width. Agenda = week strip (prev/next week, 7 day buttons with up to 3 dots) + `CalendarDayList` from the selected day for 14 days (selected day always shown, empty = one dashed line; then only days with events) — never a blank screen. Agenda data = selected week's Monday + 21 days. Month view shows the selected day's list under the grid.
- **Event card**: 3px left bar by phase (emerald ongoing, sky upcoming, slate past + 70% opacity), time range + duration, "Happening now" tag, title, location, 2-line description (not in compact), creator · chat, sync badge only when not synced.
- **Sheet** `CalendarEventSheet` (`Modal`; phone bottom sheet, full screen while editing): details (when + duration, location, description, reminders, origin + created time), sync row (badge, Google account, `Sync again` when not OK), footer Delete / Edit. Edit & create share `CalendarEventForm` (title, all-day checkbox switching `datetime-local`/`date`, start/end, location, textarea description, reminder chips 0/10/30/60/1440 min). Delete confirms with the shared `ConfirmDialog`. Errors show inline in the sheet; success toasts via `TOAST_POSITION`.
