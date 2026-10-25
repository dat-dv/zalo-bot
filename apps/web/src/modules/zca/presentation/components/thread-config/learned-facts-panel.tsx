'use client';

import { useState } from 'react';
import type { IChannelLearnedFact } from '@zalobot/contracts';
import { Button } from '@/shared/ui/button';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import {
  useDeleteThreadLearnedFactMutation,
  useThreadLearnedFactsQuery,
  useThreadMemoryStatusQuery,
} from '../../../api/zca-query';
import { groupLearnedFacts, memoryStatusText } from '../../../model/channel-memory';

interface LearnedFactsPanelProps {
  threadId: string;
}

/** What the nightly job learned about the bot and the members; a deleted fact is not learned again. */
export function LearnedFactsPanel({ threadId }: LearnedFactsPanelProps) {
  const status = useThreadMemoryStatusQuery(threadId, true);
  const query = useThreadLearnedFactsQuery(threadId, true);
  const remove = useDeleteThreadLearnedFactMutation(threadId);
  const [deleting, setDeleting] = useState<IChannelLearnedFact | null>(null);
  const groups = groupLearnedFacts(query.data ?? []);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Bot đã học</p>
      {status.data && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {memoryStatusText(status.data)}
        </p>
      )}
      {query.isPending ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Đang tải…</p>
      ) : query.isError ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">Không tải được điều bot đã học.</p>
      ) : groups.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Chưa học được gì.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                {group.title}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {group.facts.map((fact) => (
                  <li className="flex items-start justify-between gap-2" key={fact.id}>
                    <span className="min-w-0 text-sm break-words text-slate-700 dark:text-slate-300">
                      {fact.fact}
                    </span>
                    <Button
                      aria-label={`Xoá "${fact.fact}"`}
                      className={`shrink-0 rounded-[3px] border px-2 py-0.5 text-xs ${BUTTON_TONE.dangerGhost}`}
                      onClick={() => setDeleting(fact)}
                    >
                      Xoá
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        confirmLabel="Xoá"
        isPending={remove.isPending}
        message={deleting ? `Bot sẽ quên "${deleting.fact}" và không học lại điều này.` : ''}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSettled: () => setDeleting(null) });
        }}
        open={deleting !== null}
        pendingLabel="Đang xoá…"
        title="Xoá điều bot đã học?"
      />
    </div>
  );
}
