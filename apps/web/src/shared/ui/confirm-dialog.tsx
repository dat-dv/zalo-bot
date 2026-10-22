'use client';

import { useId } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import { MODAL_FOOTER_TAP, Modal } from './modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Shown on the confirm button while `isPending`. */
  pendingLabel?: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * In-app replacement for `window.confirm` on destructive actions: centered card on desktop,
 * bottom sheet on phones (PWA included), stacked above any dialog it was opened from.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  pendingLabel,
  isPending,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useLocale();
  const titleId = useId();
  const messageId = useId();

  return (
    <Modal
      open={open}
      // Not dismissible while the action is in flight.
      onDismiss={isPending ? undefined : onCancel}
      dismissOnBackdrop
      role="alertdialog"
      labelledBy={titleId}
      describedBy={messageId}
      panelClassName="max-w-sm rounded-[3px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="grid gap-1.5 px-4 pt-4 pb-3 max-sm:pt-6">
        <h2 id={titleId} className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        <p id={messageId} className="m-0 text-xs text-slate-600 dark:text-slate-300">
          {message}
        </p>
      </div>
      <footer className="flex justify-end gap-2 px-4 pb-4">
        <button
          className={`inline-flex min-h-[30px] items-center justify-center rounded-[3px] border border-slate-300 !bg-white px-3 text-xs font-medium !text-slate-700 hover:!bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:!bg-slate-800 dark:!text-slate-200 dark:hover:!bg-slate-700 ${MODAL_FOOTER_TAP}`}
          disabled={isPending}
          onClick={onCancel}
          type="button"
        >
          {t('common.cancel')}
        </button>
        <button
          className={`inline-flex min-h-[30px] items-center justify-center rounded-[3px] border border-rose-700 !bg-rose-700 px-3 text-xs font-semibold !text-white hover:!bg-rose-800 disabled:opacity-60 dark:border-rose-600 dark:!bg-rose-600 dark:hover:!bg-rose-700 ${MODAL_FOOTER_TAP}`}
          disabled={isPending}
          onClick={onConfirm}
          type="button"
        >
          {isPending && pendingLabel ? pendingLabel : confirmLabel}
        </button>
      </footer>
    </Modal>
  );
}
