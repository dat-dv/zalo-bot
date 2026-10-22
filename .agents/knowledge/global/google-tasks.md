---
metadata:
  agent-artifact:
    id: global-google-tasks-knowledge
    type: documentation
    depends_on:
      - apps/api/src/zca/text/text-tool.definitions.ts
      - apps/api/src/zca/text/strategies/create-task-tool.strategy.ts
      - apps/api/src/zca/text/strategies/tasks-quick-tool.strategy.ts
      - apps/api/src/zca/text/text-tool.factory.ts
      - apps/api/src/google/google-tasks.service.ts
      - apps/api/src/tasks/tasks.service.ts
      - apps/api/src/tasks/task-title.util.ts
      - apps/api/src/zca/text/strategies/complete-task-tool.strategy.ts
      - apps/api/src/zca/text/strategies/list-tasks-tool.strategy.ts
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
---

# Task Commands (Google Tasks copy)

Tasks live in the shared `tasks` table; Google Tasks holds a copy (see [`modules/tasks/README.md`](../modules/tasks/README.md)).

## LLM Tools

- `CREATE_TASK` creates exactly one task per call: `title` (required), `notes` (optional), `due` (optional RFC 3339 / ISO 8601). There is no batch/multi-task tool.
- `LIST_TASKS` and `COMPLETE_TASK` (confirmation-gated via `createPendingCompleteTask`) complete the set.
- No task tool requires Google: without a linked account the task is saved app-only (`sync_status = local`).

## Create Flow

1. `CreateTaskToolStrategy` rejects an empty title.
2. Duplicate check: `TasksService.findPotentialDuplicateTasks` loads up to 200 open DB tasks (after a throttled Google import) and matches titles after `normalizeTaskTitle` (`apps/api/src/tasks/task-title.util.ts`) (strip diacritics, `đ`→`d`, lowercase, non-alphanumerics → single space). A match is an exact normalized title, or the shorter title (≥2 words) contained in the longer. Errors in this check are ignored.
3. A pending action `CREATE_TASK` (3-digit code, standard confirmation) is created with `{ title, due, notes }`. If duplicates were found, a separate warning message lists them; the user may still confirm.
4. On confirmation `TasksService.createTask` saves the row with `{ userId, chatId, source: 'zalo' }` and copies it to the `@default` list when Google is connected; the bot replies with the task card and a `/tasks` hint.

## Fast-Path Commands

- `/tasks`, `/task`, `/viec` (and `/tasks ...`, `/viec ...`) route to `TasksQuickToolStrategy` and list up to 15 open DB tasks with due date (`dd/MM`) and notes.
- `/task <content>` creates a task with that title immediately (`TasksService.createTask`, sender name recorded), without confirmation or duplicate check; the reply notes when the task did not reach Google.

## Complete Flow

`CompleteTaskToolStrategy` matches `taskId` (row id or Google copy id) or `taskTitle` (`arePotentialDuplicateTaskTitles`) against up to 200 open DB tasks, then queues `COMPLETE_TASK` with the row id. On confirmation `TasksService.completeTask` accepts a uuid or a legacy Google task id (actions queued before the DB move).
