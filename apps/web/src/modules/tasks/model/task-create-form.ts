import type { ICreateTaskRequest } from '@zalobot/contracts';
import { dueDateToIso } from '@/shared/lib/local-date-input';

export interface TaskCreateDraft {
  title: string;
  notes: string;
  /** `date` value; empty = no due date. */
  due: string;
}

export type TaskCreateResult =
  { ok: true; request: ICreateTaskRequest } | { ok: false; error: 'titleRequired' };

export const emptyTaskDraft = (): TaskCreateDraft => ({ title: '', notes: '', due: '' });

export function buildCreateTaskRequest(draft: TaskCreateDraft): TaskCreateResult {
  const title = draft.title.trim();
  if (!title) return { ok: false, error: 'titleRequired' };
  return {
    ok: true,
    request: { title, notes: draft.notes.trim() || undefined, due: dueDateToIso(draft.due) },
  };
}
