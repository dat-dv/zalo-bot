# Google Tasks Web Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/tasks/README.md)

## Purpose

`apps/web/src/modules/tasks` provides the web dashboard client API, TanStack Query integration, and full inline editing data table for Google Tasks.

## UI and Inline Editing

- **UI Styling**: Fully styled with 100% Tailwind CSS utility classes supporting dark mode (`dark:`) and compact responsive layouts.
- **Table Columns**:
  - `status`: Interactive completion checkbox + status badge (`needsAction` vs `completed`).
  - `title`: Primary title with double-click inline text editing (`Enter` to save, `Escape` to cancel).
  - `notes`: Detailed task notes with double-click inline editing.
  - `dueAt`: Localized due date with inline date picker input.
  - `updatedAt`: Localized timestamp of last update.
  - `actions`: Inline Save/Cancel buttons when editing; Edit and Delete buttons in view mode.
- **Controls & Filters**:
  - Multi-grain period filter toolbar (`day`, `week`, `month`, `quarter`, `year`, `all`) with bidirectional period navigation.
  - Quick status filter tabs (`all`, `needsAction`, `completed`) with real-time count badges (defaults to `needsAction`).
  - Instant client search by title and notes.
  - Toast notifications confirming saved edits and deletions.

## State and Integration Seams

- **API & Hooks**: `tasks-api.ts` (`getTasks`, `updateTask`, `deleteTask`) and `tasks-query.ts` (`useTasksQuery`, `useUpdateTaskMutation`, `useDeleteTaskMutation`).
- **Backend Service & Controller**: `GoogleResourcesController` (`GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`) and `GoogleTasksService`. Mappings ensure raw Google Tasks fields (`due`, `updated`, `completed`) are normalized to `ITaskListItem` (`dueAt`, `updatedAt`, `completedAt`), and both active and completed tasks are fetched (`showCompleted: true`, `showHidden: true`).
- **Contracts**: Shared DTOs `ITaskListItem` and `IUpdateTaskRequest` from `@zalobot/contracts`.
- **Cache Invalidation**: Mutations automatically invalidate `['tasks']` and `['dashboard']` TanStack query caches.
