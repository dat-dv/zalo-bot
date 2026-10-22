---
metadata:
  agent-artifact:
    id: module-tasks-knowledge
    type: documentation
    depends_on:
      - apps/api/src/tasks/tasks.service.ts
      - apps/api/src/tasks/tasks.controller.ts
      - apps/api/src/tasks/task.mapper.ts
      - apps/api/src/tasks/task-title.util.ts
      - apps/api/src/tasks/dto/task.dto.ts
      - apps/api/src/database/entities/task.entity.ts
      - apps/api/src/database/migrations/1724880000000-CreateTasks.ts
      - apps/api/src/google/google-tasks.service.ts
      - apps/api/src/google/google-copy.util.ts
      - apps/web/src/modules/tasks/api/tasks-api.ts
      - apps/web/src/modules/tasks/api/tasks-query.ts
      - apps/web/src/modules/dashboard/presentation/components/tasks-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/tasks-table.tsx
      - apps/web/src/shared/ui/google-sync.ts
---

# Tasks Module

Owner: Core Engineering Team · Status: active

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/tasks/README.md)

## Purpose

Shared task list (to-dos). Tasks live in the DB (`tasks`); Google Tasks only holds a copy. Before this, tasks existed only in Google (mostly the admin's shared account), so switching the Google account made them vanish from the dashboard and the bot. Same model as the calendar ([`calendar/README.md`](../calendar/README.md)).

- **Shared like the finance ledger and the calendar**: every user sees every task; `created_by_user_id` / `created_by_name` / `source` / `source_chat_id` are display-only, never filters.
- **Google copy**: inserted into the `@default` list of `GoogleAuthService.getOAuth2Client(actorId)` (own token, else the shared account), keyed by `(google_account_email, google_task_id)`.
- **No Google connected** → task still saved (`sync_status = local`). Chat creation and listing no longer require Google.

Chat creation, confirmation and duplicate warning: [`global/google-tasks.md`](../../global/google-tasks.md).

## Data: `tasks` (migration `1724880000000-CreateTasks`)

`id` uuid, `title`, `notes`, `due_at` (Google keeps only the date), `status` (`needsAction|completed`), `completed_at`, `created_by_user_id`, `created_by_name`, `source` (`zalo|dashboard|google`), `source_chat_id`, `google_task_id`, `google_task_list_id` (`@default` until an import learns the real id), `google_account_email`, `sync_status` (`synced|pending|failed|local`), `synced_at`, `deleted_at` (soft delete), timestamps. Indexes: `(status, due_at)`, `deleted_at`, partial unique `(google_account_email, google_task_id) WHERE google_task_id IS NOT NULL`. Audited by `AuditLogSubscriber` (table label `table.entity.tasks`).

## Backend: `apps/api/src/tasks/`

`TasksModule` (imports `GoogleModule` via `forwardRef`; imported by App, Reports, Zalo, Zca modules). `TasksService` is the only reader/writer; `GoogleTasksService` is a thin client (`listTaskLists`, `listAllTasks` = every list, completed + hidden, paginated, throws on any page error; `insertTask`, `patchTask`, `deleteTask`).

- `createTask(input, actor)`: save row (`pending` if Google authorized for actor, else `local`) → push copy → `synced` or `failed` (row kept either way).
- `updateTask(id, patch, actorId)`: DB first, then patch the copy if its account is reachable; if unreachable (account switched), re-create the copy in the actor's current account. `notes: ''` and `dueAt: null` clear. Completing sets `completed_at`; re-opening clears it and sends `completed: null` to Google.
- `completeTask(id, actorId)` = `updateTask(id, { status: 'completed' })`.
- `deleteTask(id, actorId)`: soft delete; delete the Google copy when reachable (404/410 ignored).
- `resyncTask(id, actorId)`: same push logic, for `failed`/`local`/old-account tasks.
- `getTask(id)`: by uuid, or by `google_task_id` (bot `COMPLETE_TASK` actions queued in Redis before the DB move).
- `listTasks({ status?, query?, limit?, importForUserId? })`: live rows, ILIKE on title/notes, open first then by `due_at ASC NULLS LAST`, `created_at DESC`; default limit 500.
- `findPotentialDuplicateTasks(titles, viewerId?)`: against up to 200 open DB tasks, `arePotentialDuplicateTaskTitles` (`task-title.util.ts`).
- **Import from Google** (when `importForUserId` set): the viewer's account (needs authorization + known email), at most every 5 min per account (in-memory), concurrent callers share one run. Upsert by `(email, google_task_id)`; rows deleted in zalobot are never resurrected; rows with a local change not yet on Google (`pending`/`failed`) are not overwritten; this account's `synced` rows that Google no longer returns are soft-deleted (deleted in Google). `callListeners(false)` so imports do not flood `audit_logs`. Due dates are compared by UTC day (Google drops the time).
- `toItems(rows, viewerId)`: `ITaskListItem` with creator name, source chat name/type, `sync` (`IGoogleCopySync`).

Shared with the calendar (`apps/api/src/google/google-copy.util.ts`): `googleErrorStatus`, `errorMessage`, `resolveGoogleCopyTarget` (actor's or shared client whose email matches), `connectedGoogleEmails`, `loadRecordOriginLookups`, `creatorDisplayName`, `toGoogleCopySync`.

### HTTP (`TasksController`, Bearer dashboard token, any signed-in user)

| Method | Route (`API_ROUTES`) | Notes |
| --- | --- | --- |
| GET | `tasks` `?status&query&limit` | limit 1–1000 (default 500); imports viewer's Google first |
| GET | `task(id)` | |
| POST | `tasks` | `CreateTaskDto`: `title`, `notes?`, `due?` (ISO) |
| PATCH | `task(id)` | `title?`, `notes?` (`''` clears), `due?` (ISO, `''` clears), `status?` |
| DELETE | `task(id)` | soft delete → `{ deleted: true }` |
| POST | `taskResync(id)` | rewrite the Google copy |

Errors: unknown id → 404; Google failures never fail the request (reflected in `sync.status`). The old Google-direct routes in `GoogleResourcesController` were removed.

### Other callers

- `GET /api/dashboard` `tasks`: up to 50 from `TasksService` (with import), independent of Google connection.
- Bot: `/tasks`, `LIST_TASKS`, `COMPLETE_TASK` lookup, `/today`, `/week` read the DB (with import); `/task <title>` creates via `TasksService` with `{ userId, name, chatId, source: 'zalo' }` and says when the task is not on Google. Confirm (`TransactionConfirmationService`) `CREATE_TASK` creates with `{ userId, chatId, source: 'zalo' }`; `COMPLETE_TASK` completes by id (uuid or legacy Google id).

## Web

- `apps/web/src/modules/tasks/api/`: `getTasks`, `updateTask`, `deleteTask`, `resyncTask` (`API_ROUTES.tasks`, `task(id)`, `taskResync(id)`); `tasksQueryKeys.list()` (`['tasks']`), `useTasksQuery`, `useUpdateTaskMutation`, `useDeleteTaskMutation`, `useResyncTaskMutation`. Every mutation invalidates `['tasks']` and `['dashboard']`.
- Screen and table live in the dashboard module: `TasksScreen`, `TasksTable` (`apps/web/src/modules/dashboard/presentation/components/`), routed by `apps/web/app/(private)/tasks/page.tsx`.
- `apps/web/src/shared/ui/google-sync.ts`: `SYNC_TONE_CLASS`, `googleSyncState(sync)` → `synced|pending|failed|local|otherAccount` + tone; also used by calendar cards/sheet.

## UI (`TasksScreen`)

- Data: `useTasksQuery` only (no fallback to the dashboard payload). `tasks.localOnlyTip` in the panel description when `dashboard.user.googleConnected === false`.
- Period filter: `usePeriodFilter('month')` + `PeriodFilterToolbar` (`day`, `week`, `month`, `quarter`, `year`, `all`). A task is in period by `dueAt`, else `updatedAt`.
- Summary cards for the period: total, pending, completed, overdue, **Not on Google** (`failed`, `local` or other account; a button toggling an "unsynced only" filter, shown as an amber chip with ✕ in the toolbar).
- Status filter `all` / `needsAction` (default) / `completed`; client search on title and notes.
- Table (`showOrigin` on this page only; the Home panel keeps the short table): `status` (checkbox + badge), `title`, `notes`, `dueAt`, `updatedAt`, `origin` (creator name or source label, `in <chat>`), `sync` (badge, Google account in its tooltip, `Sync again` button unless synced/pending), `actions` (Edit/Delete; Save/Cancel). Phone list: `sync` is a secondary item shown only when the task is not synced.
- Inline edit: double-click or Edit; `Enter` saves, `Escape` cancels; saving sends `notes: ''` / `due: ''` to clear. Delete asks the shared `ConfirmDialog` (`tasks.delete.title` / `tasks.delete.message`). Toasts on save/delete/resync.
