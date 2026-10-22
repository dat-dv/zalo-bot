# Reminders Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/reminders/README.md)

## Purpose

Scheduled reminders delivered to the user as a Zalo message. Reminders are created from chat (LLM tool `SET_REMINDER`, confirmation-gated) or from the dashboard, listed/edited there, and fired by a backend cron.

## Code ownership

- `apps/web/src/modules/reminders` contains `api/` and `model/`:
  - `reminders-api.ts`: `getReminders`, `createReminder` (`POST`), `updateReminder`, `deleteReminder` → `API_ROUTES.reminders` (`/api/reminders`, `/api/reminders/:id`).
  - `reminders-query.ts`: `remindersQueryKeys.list()` (`['reminders']`), `useRemindersQuery`, `useCreateReminderMutation`, `useUpdateReminderMutation`, `useDeleteReminderMutation`. Mutations invalidate `['reminders']` and `['dashboard']`.
  - `model/reminder-create-form.ts` (pure, unit-tested): `REMINDER_NOTIFY_TYPES`, `REMINDER_REPEAT_TYPES`, `createReminderDraft` (default now + 1h, `text`, `none`), `buildCreateReminderRequest` (errors `titleRequired` | `remindAtRequired` | `pastTime`; the current minute still counts as valid).
- The screen lives in the dashboard module: `RemindersScreen` (`apps/web/src/modules/dashboard/presentation/components/reminders-screen.tsx`, re-exported by `dashboard/view/reminders-screen.tsx`, routed by `apps/web/app/(private)/reminders/page.tsx`) `RemindersTable` (`reminders-table.tsx`) and `CreateReminderDialog` (`create-reminder-dialog.tsx`, on the shared `FormDialog`), same folder.
- Backend: `apps/api/src/reminders` (`RemindersController`, `RemindersService`, `ReminderSchedulerService`), entity `ReminderEntity` (`apps/api/src/database/entities/reminder.entity.ts`).

## Web UI (`RemindersScreen`)

- Data source: `useRemindersQuery`; when it returns an empty list, falls back to `dashboard.data.reminders` (`useDashboardQuery`).
- `DataPanel` with row counter and client search by title.
- Create: `+ Add reminder` toolbar button (desktop, `max-[960px]:hidden`) / `MobileActionBar` (compact) opens `CreateReminderDialog` with title, `remindAt` (`datetime-local`, local time → ISO), notify type, repeat type. Save is disabled while invalid or in the past; validity is re-checked against the clock on submit. API errors stay in the dialog; success closes it with a toast.
- Columns: title, notify type (`text` / `call`), schedule (`remindAt`), repeat (`none` / `daily` / `weekly`), actions.
- Inline edit (title, `remindAt` datetime, notify type, repeat type) with Save/Cancel; Snooze = PATCH `remindAt` + 15 minutes; Delete asks `window.confirm`. Toasts on save/snooze/delete.
- Error state: alert strip with Retry (invalidates reminders + dashboard caches). Loading is passed to the table.

## Backend API (`RemindersController`, `@Controller('reminders')`)

All endpoints are scoped to the dashboard user (`getDashboardUserId`).

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/reminders` | `getUserUpcomingReminders`: rows with `isTriggered = false`, ordered by `remindAt` ASC |
| GET | `/api/reminders/:id` | One reminder of the user, 404 otherwise |
| POST | `/api/reminders` | Requires `title`, valid `remindAt`; optional `notifyType` (`text`/`call`), `repeatType` (`none`/`daily`/`weekly`) |
| PATCH | `/api/reminders/:id` | Updates `title`, `remindAt`, `notifyType`, `repeatType`. Changing `remindAt` resets `isTriggered=false`, `status='pending'` |
| DELETE | `/api/reminders/:id` | Returns `{ deleted: true }`, 404 if not found |

Contracts: `IReminderListItem`, `ICreateReminderRequest`, `IUpdateReminderRequest` (`@zalobot/contracts`). The controller ignores `status`/`snoozeCount`/`snoozedUntil` from the request body.

## Scheduler (`ReminderSchedulerService`)

- `@Cron(CronExpression.EVERY_30_SECONDS)`: `getDueReminders()` = `remindAt <= now` and `isTriggered = false`.
- For each due reminder: format time in `Asia/Ho_Chi_Minh` with the user's `preferredLocale`, send `reminder.header.text` + title + time via `ZcaMessengerService.sendMessage(userId, text)`, then `markTriggered`.
- `markTriggered`: `daily` → `remindAt + 24h`, `weekly` → `remindAt + 7d` (stays pending); `none` → `isTriggered=true`, `status='completed'`, `completedAt`.
- Known gap: `notifyType = 'call'` is stored and displayed, but the scheduler always sends a text message (no call path; `reminder.header.call` is unused).

## Chat creation & confirmation

- `SET_REMINDER` is an LLM tool (`ZALO_TOOL_DEFINITIONS`); in ZCA groups it is reachable only from messages that mention the bot or use a thread prefix.
- The pending action is stored in Redis as JSON; on confirm, `parseReminderPayload` (`apps/api/src/zca/confirmation/transaction-confirmation.service.ts`) revives `remindAt` from ISO string into a `Date` (`toValidReminderDate` in `reminders.service.ts`) before `RemindersService.createReminder`.
- Fast-path `/reminders` (`RemindersQuickToolStrategy`) lists upcoming reminders in chat.
