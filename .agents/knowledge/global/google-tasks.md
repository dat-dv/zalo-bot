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
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
---

# Google Tasks Commands

## LLM Tools

- `CREATE_TASK` creates exactly one task per call: `title` (required), `notes` (optional), `due` (optional RFC 3339 / ISO 8601). There is no batch/multi-task tool.
- `LIST_TASKS` and `COMPLETE_TASK` (confirmation-gated via `createPendingCompleteTask`) complete the set.
- All task tools require a linked Google account; otherwise the bot asks the user to run `/login`.

## Create Flow

1. `CreateTaskToolStrategy` rejects an empty title.
2. Duplicate check: `findPotentialDuplicateTasks` loads up to 50 incomplete tasks and matches titles after `normalizeTaskTitle` (strip diacritics, `đ`→`d`, lowercase, non-alphanumerics → single space). A match is an exact normalized title, or the shorter title (≥2 words) contained in the longer. Errors in this check are ignored.
3. A pending action `CREATE_TASK` (3-digit code, standard confirmation) is created with `{ title, due, notes }`. If duplicates were found, a separate warning message lists them; the user may still confirm.
4. On confirmation `GoogleTasksService.createTask` inserts into the `@default` list and the bot replies with the task card and a `/tasks` hint.

## Fast-Path Commands

- `/tasks`, `/task`, `/viec` (and `/tasks ...`, `/viec ...`) route to `TasksQuickToolStrategy` and list up to 15 incomplete tasks with due date and notes.
- `/task <content>` creates a task with that title immediately, without confirmation or duplicate check.
