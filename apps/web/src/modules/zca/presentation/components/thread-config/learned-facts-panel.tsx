'use client';

import { useState } from 'react';
import type { IChannelLearnedFact } from '@zalobot/contracts';
import { Button } from '@/shared/ui/button';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import {
  useDeleteThreadLearnedFactMutation,
  useThreadLearnedFactsQuery,
} from '../../../api/zca-query';
import { groupLearnedFacts } from '../../../model/channel-memory';

interface LearnedFactsPanelProps {
  threadId: string;
}

/**
 * Facts learned earlier about the bot and the members (the nightly LLM job that learned them was
 * removed). They are still used in replies; shown only when there are some, so they can be deleted.
 */
export function LearnedFactsPanel({ threadId }: LearnedFactsPanelProps) {
  const query = useThreadLearnedFactsQuery(threadId, true);
  const remove = useDeleteThreadLearnedFactMutation(threadId);
  const [deleting, setDeleting] = useState<IChannelLearnedFact | null>(null);
  const groups = groupLearnedFacts(query.data ?? []);
  if (query.isPending || (query.isSuccess && groups.length === 0)) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        Điều bot đã học trước đây
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Bot không tự học thêm nữa. Chỉ điều về chính bot còn được dùng khi trả lời; điều về thành
        viên chỉ để xem và xoá.
      </p>
      {query.isError ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">Không tải được điều bot đã học.</p>
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
        message={deleting ? `Bot sẽ quên "${deleting.fact}".` : ''}
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
