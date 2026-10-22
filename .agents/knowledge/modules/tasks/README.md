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
      - apps/api/src/google/google-copy.util.ts
      - apps/web/src/modules/tasks/api/tasks-api.ts
      - apps/web/src/modules/tasks/api/tasks-query.ts
      - apps/web/src/modules/dashboard/presentation/components/tasks-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/tasks-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/create-task-dialog.tsx
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

Columns: `id` uuid, `title`, `notes`, `due_at` (a calendar day stored as `<date>T23:59:59.000Z`), `status` (`needsAction|completed`), `completed_at`, `created_by_user_id`, `created_by_name`, `source` (`zalo|dashboard`), `source_chat_id`, `deleted_at` (soft delete), timestamps. Indexes: `(status, due_at)`, `deleted_at`. Audited by `AuditLogSubscriber` (table label `table.entity.tasks`).

## Backend: `apps/api/src/tasks/`

`TasksModule` (no Google dependency; imported by App, Reports, Zalo, Zca modules). `TasksService` is the only reader/writer.

- `createTask(input, actor)`: trims title (empty → `Không có tiêu đề`), empty notes → null, saves with creator and source.
- `updateTask(id, patch)`: `notes: ''` and `dueAt: null` clear; omitted fields stay. Completing sets `completed_at` (kept on later edits of a completed task); re-opening clears it.
- `completeTask(id)` = `updateTask(id, { status: 'completed' })`.
- `deleteTask(id)`: soft delete (`deleted_at`).
- `getTask(id)`: live row by uuid; anything else → 404.
- `listTasks({ status?, query?, limit? })`: live rows, ILIKE on title/notes, open first then by `due_at ASC NULLS LAST`, `created_at DESC`; default limit 500.
- `findPotentialDuplicateTasks(titles)`: against up to 200 open tasks, `arePotentialDuplicateTaskTitles` (`task-title.util.ts`).
- `toItems(rows)`: `ITaskListItem` with creator name and source chat name/type (via `loadRecordOriginLookups` from `google/google-copy.util.ts`, called without `googleAuth`).
- `task.types.ts`: `CreateTaskOptions` (`title`, `notes?`, `due?`), the bot `CREATE_TASK` pending-action payload used by the confirmation utils.

### HTTP (`TasksController`, Bearer dashboard token, any signed-in user)

| Method | Route (`API_ROUTES`) | Notes |
| --- | --- | --- |
| GET | `tasks` `?status&query&limit` | limit 1–1000 (default 500) |
| GET | `task(id)` | |
| POST | `tasks` | `CreateTaskDto`: `title`, `notes?`, `due?` (ISO); `source: 'dashboard'` |
| PATCH | `task(id)` | `title?`, `notes?` (`''` clears), `due?` (ISO, `''` clears), `status?` |
| DELETE | `task(id)` | soft delete → `{ deleted: true }` |

Errors: unknown id → 404.

### Other callers

- `GET /api/dashboard` `tasks`: up to 50 from `TasksService`, independent of Google.
- Bot: `/tasks`, `LIST_TASKS`, `COMPLETE_TASK` lookup (by row id), `/today`, `/week` read the DB; `/task <title>` creates via `TasksService` with `{ userId, name, chatId, source: 'zalo' }`. Confirm (`TransactionConfirmationService`) `CREATE_TASK` creates with `{ userId, chatId, source: 'zalo' }`; `COMPLETE_TASK` completes by row id. Bot copy (help, start, login, status) no longer mentions Google Tasks.
- Google OAuth (`GOOGLE_SCOPES`) no longer requests `https://www.googleapis.com/auth/tasks`; tokens granted earlier keep working.

## Web

- `apps/web/src/modules/tasks/api/`: `getTasks`, `createTask` (`POST API_ROUTES.tasks`, `ICreateTaskRequest`), `updateTask`, `deleteTask` (`API_ROUTES.tasks`, `task(id)`); `tasksQueryKeys.list()` (`['tasks']`), `useTasksQuery`, `useCreateTaskMutation`, `useUpdateTaskMutation`, `useDeleteTaskMutation`. Every mutation invalidates `['tasks']` and `['dashboard']`.
- `apps/web/src/modules/tasks/model/task-create-form.ts` (pure, unit-tested): `emptyTaskDraft`, `buildCreateTaskRequest` (trimmed title required; empty notes → omitted; due `date` → `<date>T23:59:59.000Z` via shared `dueDateToIso`).
- Screen, table and `CreateTaskDialog` live in the dashboard module: `TasksScreen`, `TasksTable` (`apps/web/src/modules/dashboard/presentation/components/`), routed by `apps/web/app/(private)/tasks/page.tsx`.
- Contracts: `ITaskListItem` has no `sync`; `TaskSource = 'zalo' | 'dashboard'`; `API_ROUTES.taskResync` removed.

## UI (`TasksScreen`)

- Data: `useTasksQuery` only (no fallback to the dashboard payload).
- Period filter: `usePeriodFilter('month')` + `PeriodFilterToolbar` (`day`, `week`, `month`, `quarter`, `year`, `all`). A task is in period by `dueAt`, else `updatedAt`.
- Summary cards for the period: total, pending, completed, overdue.
- Status filter `all` / `needsAction` (default) / `completed`; client search on title and notes.
- Table (`showOrigin` on this page only; the Home panel keeps the short table): `status` (checkbox + badge), `title`, `notes`, `dueAt`, `updatedAt`, `origin` (creator name or source label, `in <chat>`), `actions` (Edit/Delete; Save/Cancel).
- Inline edit: double-click or Edit; `Enter` saves, `Escape` cancels; saving sends `notes: ''` / `due: ''` to clear. Delete asks the shared `ConfirmDialog` (`tasks.delete.title` / `tasks.delete.message`). Toasts on create/save/delete.
- Create: `+ Add task` toolbar button (desktop, `max-[960px]:hidden`) / `MobileActionBar` (compact) opens `CreateTaskDialog` (shared `FormDialog`): title, notes, due date. API errors stay in the dialog; on success the dialog closes, a `completed` status filter switches to `needsAction` so the new task is visible, and a toast shows.
