'use client';

import { useId } from 'react';
import type { ThreadChatMemoryConfig } from '@zalobot/contracts';
import { Button } from '@/shared/ui/button';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { MODAL_FOOTER_TAP, MODAL_STICKY_FOOTER, Modal } from '@/shared/ui/modal';
import { listenStartedSections } from '../../../model/listen-started';

interface ListenStartedDialogProps {
  open: boolean;
  threadName: string;
  memory: ThreadChatMemoryConfig;
  onClose: () => void;
}

/**
 * Shown once after a save that turned listening on: the bot listens now and what it remembers,
 * from the saved memory switches, so admins who forget how it works can read it again.
 */
export function ListenStartedDialog({
  open,
  threadName,
  memory,
  onClose,
}: ListenStartedDialogProps) {
  const titleId = useId();
  return (
    <Modal
      open={open}
      onDismiss={onClose}
      dismissOnBackdrop
      labelledBy={titleId}
      panelClassName="max-w-lg rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100" id={titleId}>
          ✅ Bot đã bắt đầu lắng nghe
        </h3>
        <p className="mt-0.5 text-xs break-words text-slate-500 dark:text-slate-400">
          {threadName}
        </p>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {listenStartedSections(memory).map((section) => (
          <section key={section.title}>
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {section.title}
            </h4>
            <ul className="mt-1 grid list-disc gap-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
              {section.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div
        className={`${MODAL_STICKY_FOOTER} flex justify-end border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900`}
      >
        <Button
          className={`rounded px-4 py-1.5 text-sm font-medium ${BUTTON_TONE.primary} ${MODAL_FOOTER_TAP}`}
          onClick={onClose}
        >
          Đã hiểu
        </Button>
      </div>
    </Modal>
  );
}
