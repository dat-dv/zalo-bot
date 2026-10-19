# Google Tasks Web Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/tasks/README.md)

## Purpose

Dashboard view of the user's Google Tasks with inline editing. Backend rules (creation via chat, confirmation, duplicate warning, batch create) are in [`global/google-tasks.md`](../../global/google-tasks.md).

## Code ownership

- `apps/web/src/modules/tasks` contains only `api/`:
  - `tasks-api.ts`: `getTasks`, `updateTask`, `deleteTask` → `API_ROUTES.tasks` (`/api/tasks`, `/api/tasks/:id`).
  - `tasks-query.ts`: `tasksQueryKeys.list()` (`['tasks']`), `useTasksQuery`, `useUpdateTaskMutation`, `useDeleteTaskMutation`. Mutations invalidate `['tasks']` and `['dashboard']`.
- Screen and table live in the dashboard module: `TasksScreen` and `TasksTable` (`apps/web/src/modules/dashboard/presentation/components/tasks-screen.tsx`, `tasks-table.tsx`), re-exported by `dashboard/view/tasks-screen.tsx`, routed by `apps/web/app/(private)/tasks/page.tsx`.

## Web UI (`TasksScreen`)

- Data: `useTasksQuery`; when it returns an empty list, falls back to `dashboard.data.tasks`. If Google is not connected (`dashboard.data.user.googleConnected` false), the panel shows `dashboard.connectGoogleTip`.
- Period filter: `usePeriodFilter('month')` (default **month**) + `PeriodFilterToolbar` with grains `day`, `week`, `month`, `quarter`, `year`, `all`. A task is in period by `dueAt`, else `updatedAt`.
- Summary cards for the selected period: total, pending, completed, overdue (not completed and `dueAt < now`).
- Status filter buttons `all` / `needsAction` (default) / `completed` (no count badges); client search on title and notes.
- Table columns: `status` (checkbox toggles completed/needsAction + badge), `title`, `notes`, `dueAt` (date input in edit mode), `updatedAt`, `actions` (Edit/Delete; Save/Cancel when editing).
- Inline edit: double-click a cell or Edit; `Enter` saves, `Escape` cancels. Delete asks `window.confirm`. Toasts on save/delete. Error state: alert with Retry.

## Integration seams

- Backend: `GoogleResourcesController` (`apps/api/src/google/google-resources.controller.ts`) `GET /api/tasks`, `GET /api/tasks/:id`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`, backed by `GoogleTasksService`. `GET /api/tasks` defaults to `showCompleted=true` and `showHidden=showCompleted` (overridable by query).
- Google fields `due`, `updated`, `completed` are normalized to `ITaskListItem.dueAt`, `updatedAt`, `completedAt`.
- Contracts: `ITaskListItem`, `IUpdateTaskRequest` (`@zalobot/contracts`).
