'use client';

import { useId } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from './button-styles';
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
          className={`inline-flex min-h-[30px] items-center justify-center rounded-[3px] border px-3 text-xs font-medium ${BUTTON_TONE.secondary} ${MODAL_FOOTER_TAP}`}
          disabled={isPending}
          onClick={onCancel}
          type="button"
        >
          {t('common.cancel')}
        </button>
        <button
          className={`inline-flex min-h-[30px] items-center justify-center rounded-[3px] border px-3 text-xs font-semibold ${BUTTON_TONE.danger} ${MODAL_FOOTER_TAP}`}
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
