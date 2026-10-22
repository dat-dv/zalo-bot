---
metadata:
  agent-artifact:
    id: module-tasks-knowledge
    type: documentation
    depends_on:
      - apps/api/src/tasks/tasks.service.ts
      - apps/api/src/tasks/tasks.controller.ts
      - apps/api/src/tasks/task.mapper.ts
      - apps/api/src/tasks/task.types.ts
      - apps/api/src/tasks/task-title.util.ts
      - apps/api/src/tasks/dto/task.dto.ts
      - apps/api/src/database/entities/task.entity.ts
      - apps/api/src/database/migrations/1724880000000-CreateTasks.ts
      - apps/api/src/database/migrations/1724890000000-DropTaskGoogleCopy.ts
      - apps/api/src/database/migrations/1724910000000-AddReminderToTasks.ts
      - apps/api/src/tasks/task-reminder-scheduler.service.ts
      - apps/api/src/tasks/tasks.module.ts
      - apps/api/src/users/dashboard-owner.ts
      - apps/api/src/zca/zca-messenger.service.ts
      - apps/api/src/google/google-copy.util.ts
      - apps/web/src/modules/tasks/api/tasks-api.ts
      - apps/web/src/modules/tasks/api/tasks-query.ts
      - apps/web/src/modules/dashboard/presentation/components/tasks-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/tasks-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/create-task-dialog.tsx
      - apps/web/src/modules/dashboard/presentation/components/reminder-target-fields.tsx
      - apps/web/src/modules/dashboard/presentation/components/reminder-target-summary.tsx
      - apps/api/src/reminders/reminder-target.service.ts
      - apps/api/src/database/migrations/1724930000000-AddReminderTargets.ts
      - apps/web/src/modules/tasks/model/task-create-form.ts
---

# Tasks Module

Owner: Core Engineering Team · Status: active

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/tasks/README.md)

## Purpose

Shared task list (to-dos), stored **only** in the zalobot DB (`tasks`). No Google Tasks copy, no import from Google, no Google connection needed.

- **Shared like the finance ledger**: every user sees every task; `created_by_user_id` / `created_by_name` / `source` / `source_chat_id` are display-only, never filters.
- **Why not Google Tasks**: the Tasks API drops the time of a due date (no on-time phone reminder), the copy lived in one Google account only, and Zalo reminders already cover timed alerts. Syncing added five sync states, an import on every read and a Google call on every write. The calendar keeps its Google copy ([`calendar/README.md`](../calendar/README.md)).
- No one-off import from Google Tasks. Rows already imported by commit `637487f` (if it ran) are kept as `dashboard` tasks; tasks that exist only in the Google Tasks app stay there.

Chat creation, confirmation and duplicate warning: [`global/google-tasks.md`](../../global/google-tasks.md).

## Data: `tasks`

Migration `1724880000000-CreateTasks` created the table; `1724890000000-DropTaskGoogleCopy` dropped the Google-copy columns (`google_task_id`, `google_task_list_id`, `google_account_email`, `sync_status`, `synced_at`, index `IDX_tasks_google_copy`) and turned `source = 'google'` rows into `dashboard`.

Migration `1724910000000-AddReminderToTasks` added the reminder columns and index `(status, remind_at)`; `1724930000000-AddReminderTargets` added `remind_users` (jsonb `[{ id, name }]`, default `[]`) and `remind_mode` (`mention|direct`, default `mention`).

Columns: `id` uuid, `title`, `notes`, `due_at` (a calendar day stored as `<date>T23:59:59.000Z`), `status` (`needsAction|completed`), `completed_at`, `created_by_user_id`, `created_by_name`, `source` (`zalo|dashboard`), `source_chat_id`, `remind_at` (timestamptz, with time), `remind_chat_id` (Zalo thread id or private-chat uid), `remind_users`, `remind_mode`, `reminded_at`, `deleted_at` (soft delete), timestamps. Indexes: `(status, due_at)`, `(status, remind_at)`, `deleted_at`. Audited by `AuditLogSubscriber` (table label `table.entity.tasks`).

## Task reminders

One-off reminder per task: at `remind_at` the bot sends the task to its **reminder target** (chat `remind_chat_id`, people `remind_users`, mode `remind_mode`) while the task is still open. The target (chat rules, people, tag vs private message, delivery) is shared with personal reminders: [`reminders/README.md`](../reminders/README.md#reminder-targets). Kept on the task row, not in `reminders`: that table is per-user (`user_id`, DM, repeat/snooze/call) while tasks are shared; on the row, completing or deleting a task ends its reminder with no second table to sync, and `/reminders` stays personal.

Rules (`TasksService.resolveReminder` → `ReminderTargetService.resolve(…, 'origin')`, applied by create and by updates that touch a reminder field; other edits keep the reminder untouched):

- `remindAt` set ⇒ a target. Chat = the one sent, else the one already on the row, else the actor's default: the chat the bot was asked in (`actor.chatId`), else the dashboard user's own private chat (`users.id`). `dashboard-owner` (`DASHBOARD_OWNER_USER_ID`, `users/dashboard-owner.ts`) has no Zalo account ⇒ no default ⇒ 400 `Chọn kênh Zalo nhận nhắc.` People: dashboard `remindUserIds` (members of the group) or bot `remindUsers` (tagged in the message); mode `remindMode`.
- A newly chosen chat must be the actor's own private chat, the chat the bot was asked in, or a listened thread ⇒ else 400.
- A changed time must not be in the past (1-minute tolerance, the dashboard picks by the minute) ⇒ else 400. Unchanged reminders are not re-validated (editing the title of a task whose reminder passed works).
- Changing the time or the target (chat, set of people, mode; `isSameTarget`) clears `reminded_at` (re-armed). Clearing `remindAt` (`null` / PATCH `''`) clears `remind_chat_id`, `remind_users`, `remind_mode` and `reminded_at`.
- Re-opening a completed task does not clear `reminded_at`.

Scheduler `TaskReminderSchedulerService` (cron every 30 s, in `TasksModule`, which imports `forwardRef` `RemindersModule` (for `ReminderTargetService`) + `UsersModule` + `ZcaModule`):

1. Skip the tick while ZCA is logged out (`ZcaMessengerService.isConnected()`): reminders wait and go out after the next login.
2. `getDueTaskReminders(now)`: `deleted_at IS NULL`, `status = 'needsAction'`, `remind_at <= now`, `reminded_at IS NULL`, `remind_chat_id IS NOT NULL`, oldest first, 50 per tick.
3. Per task: `markTaskReminded(id)` (conditional update on `reminded_at IS NULL`; only the first caller wins, so overlapping ticks never send twice), then `ReminderTargetService.deliver(target, formatTaskReminderMessage(task, locale), locale)` (locale = creator's preferred locale): skips groups the admin stopped listening to (stays marked), tags or privately messages the people per mode. A failed send is logged and not retried.
- Message (`task.mapper.ts`, i18n `task.reminder.*`; `{ header, body }` so the tag line goes between): header, `📌 title`, `⏳ due dd/MM` (if any), `📝 notes` (≤200 chars, if any), hint to tell the bot `xong <title>`.

## Backend: `apps/api/src/tasks/`

`TasksModule` (no Google dependency; imported by App, Reports, Zalo, Zca modules). `TasksService` is the only reader/writer.

- `createTask(input, actor)`: trims title (empty → `Không có tiêu đề`), empty notes → null, saves with creator and source.
- `updateTask(id, patch)`: `notes: ''` and `dueAt: null` clear; omitted fields stay. Completing sets `completed_at` (kept on later edits of a completed task); re-opening clears it.
- `completeTask(id)` = `updateTask(id, { status: 'completed' })`.
- `deleteTask(id)`: soft delete (`deleted_at`).
- `getTask(id)`: live row by uuid; anything else → 404.
- `listTasks({ status?, query?, limit? })`: live rows, ILIKE on title/notes, open first then by `due_at ASC NULLS LAST`, `created_at DESC`; default limit 500.
- `findPotentialDuplicateTasks(titles)`: against up to 200 open tasks, `arePotentialDuplicateTaskTitles` (`task-title.util.ts`).
- `toItems(rows)`: `ITaskListItem` with creator name, source chat name/type and `remindChatName` (via `loadRecordOriginLookups` from `google/google-copy.util.ts`, called without `googleAuth`; the reminder chat is looked up as a thread, else as a user name).
- Reminder chats and members are listed by `ReminderTargetService` (`/api/reminder-targets/…`), not by `TasksService`.
- `getDueTaskReminders`, `markTaskReminded`: used by the scheduler above.
- `task.types.ts`: `CreateTaskOptions` (`title`, `notes?`, `due?`, `remindAt?`, `remindUsers?`, `remindMode?`), the bot `CREATE_TASK` pending-action payload used by the confirmation utils.

### HTTP (`TasksController`, Bearer dashboard token, any signed-in user)

| Method | Route (`API_ROUTES`) | Notes |
| --- | --- | --- |
| GET | `tasks` `?status&query&limit` | limit 1–1000 (default 500) |
| GET | `task(id)` | |
| POST | `tasks` | `CreateTaskDto`: `title`, `notes?`, `due?` (ISO), `remindAt?` (ISO), `remindChatId?`, `remindUserIds?` (≤10), `remindMode?`; `source: 'dashboard'` |
| PATCH | `task(id)` | `title?`, `notes?` (`''` clears), `due?` (ISO, `''` clears), `status?`, `remindAt?` (ISO, `''` clears), `remindChatId?`, `remindUserIds?` (`[]` clears), `remindMode?` |
| DELETE | `task(id)` | soft delete → `{ deleted: true }` |

Errors: unknown id → 404; reminder rule violations → 400 with a Vietnamese message. Chats and members for the picker: `ReminderTargetsController` ([`reminders/README.md`](../reminders/README.md#reminder-targets)).

### Other callers

- `GET /api/dashboard` `tasks`: up to 50 from `TasksService`, independent of Google.
- Bot: `/tasks`, `LIST_TASKS`, `COMPLETE_TASK` lookup (by row id), `/today`, `/week` read the DB; `/task <title>` creates via `TasksService` with `{ userId, name, chatId, source: 'zalo' }`. Confirm (`TransactionConfirmationService`) `CREATE_TASK` creates with `{ userId, chatId, source: 'zalo' }` and `remindAt = toValidTaskRemindAt(payload.remindAt)` (unparseable or already past at approval time ⇒ no reminder, the task is still created), so the reminder goes to the chat the bot was asked in, tagging `remindUsers` (`parseTargetUsers`) per `remindMode`; `COMPLETE_TASK` completes by row id. Bot copy (help, start, login, status) no longer mentions Google Tasks.
- Google OAuth (`GOOGLE_SCOPES`) no longer requests `https://www.googleapis.com/auth/tasks`; tokens granted earlier keep working.

## Web

- `apps/web/src/modules/tasks/api/`: `getTasks`, `createTask` (`POST API_ROUTES.tasks`, `ICreateTaskRequest`), `updateTask`, `deleteTask` (`API_ROUTES.tasks`, `task(id)`); `tasksQueryKeys.list()` (`['tasks']`), `useTasksQuery`, `useCreateTaskMutation`, `useUpdateTaskMutation`, `useDeleteTaskMutation`. Every mutation invalidates `['tasks']` and `['dashboard']`. Reminder chats/members and `reminderApiErrorMessage` come from `apps/web/src/modules/reminders/api/reminder-targets-*.ts`.
- `apps/web/src/modules/tasks/model/task-create-form.ts` (pure, unit-tested): `emptyTaskDraft` (with `remindTarget: ReminderTargetDraft`), `buildCreateTaskRequest(draft, channels, now)` (trimmed title required; empty notes → omitted; due `date` → `<date>T23:59:59.000Z` via shared `dueDateToIso`; optional `remindAt` `datetime-local` must not be in the past (`remindPastTime`) and needs a chat via `buildReminderTargetFields`: picked, else the `isSelf` channel, else `remindChannelRequired`; `remindUserIds`/`remindMode` only for a group with people), `reminderInputToIso`.
- Target UI: `ReminderTargetFields` / `ReminderTargetSummary` (dashboard components, shared with reminders; see [`reminders/README.md`](../reminders/README.md)).
- Screen, table and `CreateTaskDialog` live in the dashboard module: `TasksScreen`, `TasksTable` (`apps/web/src/modules/dashboard/presentation/components/`), routed by `apps/web/app/(private)/tasks/page.tsx`.
- Contracts: `ITaskListItem` has no `sync` and has `remindAt?`, `remindChatId?`, `remindChatName?`, `remindUsers?`, `remindMode?`, `remindedAt?`; `ICreateTaskRequest` / `IUpdateTaskRequest` take `remindAt?`, `remindChatId?`, `remindUserIds?`, `remindMode?`; `IReminderTargetChannel`, `IReminderTargetUser`, `ReminderTargetMode`, `REMINDER_TARGET_MODES`, `REMINDER_TARGET_LIMITS`; `TaskSource = 'zalo' | 'dashboard'`; `API_ROUTES.reminderTargetChannels`, `reminderTargetMembers(chatId)` (the task-only `taskReminderChannels` is gone); `API_ROUTES.taskResync` removed.

## UI (`TasksScreen`)

- Data: `useTasksQuery` only (no fallback to the dashboard payload).
- Period filter: `usePeriodFilter('month')` + `PeriodFilterToolbar` (`day`, `week`, `month`, `quarter`, `year`, `all`). A task is in period by `dueAt`, else `updatedAt`.
- Summary cards for the period: total, pending, completed, overdue.
- Status filter `all` / `needsAction` (default) / `completed`; client search on title and notes.
- Table (`showOrigin` and `showReminder` on this page only; the Home panel keeps the short table): `status` (checkbox + badge), `title`, `notes`, `dueAt`, `remindAt` (`🔔 <date time>` + `ReminderTargetSummary`: chat · 👤 people · Private message; muted with `· Đã nhắc` once `remindedAt` is set; `—` when none), `updatedAt`, `origin` (creator name or source label, `in <chat>`), `actions` (Edit/Delete; Save/Cancel).
- Inline edit: double-click or Edit; `Enter` saves, `Escape` cancels; saving sends `notes: ''` / `due: ''` to clear. The `remindAt` cell edits a `datetime-local` plus, when a time is set, a compact `ReminderTargetFields` (current chat, else the private chat preselected; a current chat no longer listed stays selectable; people and mode for a group). Reminder fields are sent only when edited (`isTargetChanged`; a task without a reminder always sends its target; `remindAt: ''` clears), so an untouched past reminder is not re-validated; a past new time shows the `tasks.remind.pastTime` toast, an API rejection shows its message (`tasks.inlineEdit.error` fallback) and keeps the edit open. Delete asks the shared `ConfirmDialog` (`tasks.delete.title` / `tasks.delete.message`). Toasts on create/save/delete.
- Create: `+ Add task` toolbar button (desktop, `max-[960px]:hidden`) / `MobileActionBar` (compact) opens `CreateTaskDialog` (shared `FormDialog`): title, notes, due date, **Remind at** (`datetime-local`, optional; past → inline `tasks.remind.pastTime`) and, once a time is set, `ReminderTargetFields`: **Send reminder to** (private chat preselected for Zalo users; required with a placeholder for `dashboard-owner`; `reminderTarget.noChannels` when nothing is listened) → **Who to remind** (group only) → **How to remind** (with people). The request is rebuilt against the clock at submit. API errors (their `message`) stay in the dialog; on success the dialog closes, a `completed` status filter switches to `needsAction` so the new task is visible, and a toast shows.
