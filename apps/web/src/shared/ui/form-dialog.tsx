'use client';

import { type FormEvent, type ReactNode, useId } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import {
  MODAL_CLOSE_TAP,
  MODAL_FOOTER_TAP,
  MODAL_STICKY_FOOTER,
  MODAL_STICKY_HEADER,
  Modal,
} from './modal';

/** Field and label styling shared by the create dialogs (same as the calendar event form). */
export const FORM_FIELD =
  'h-8 min-h-8 w-full rounded-[3px] border border-slate-300 bg-white px-2 text-[12.5px] text-slate-900 outline-none focus:border-sky-600 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500 max-[640px]:h-10 max-[640px]:min-h-10 max-[640px]:text-[15px]';
export const FORM_LABEL = 'text-[11px] font-semibold text-slate-600 dark:text-slate-300';
export const FORM_HINT = 'text-[11px] text-slate-500 dark:text-slate-400';
export const FORM_ERROR_TEXT = 'text-[11px] text-rose-600 dark:text-rose-400';

const FOOTER_BUTTON = `inline-flex min-h-8 cursor-pointer items-center justify-center rounded-[3px] border px-3 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-50 ${MODAL_FOOTER_TAP}`;
const PRIMARY = `${FOOTER_BUTTON} border-slate-900 bg-slate-900 font-semibold text-white hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200`;
const SECONDARY = `${FOOTER_BUTTON} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;

interface FormDialogProps {
  open: boolean;
  title: string;
  description?: string;
  submitLabel: string;
  /** Disables the submit button on top of `isPending`. */
  submitDisabled?: boolean;
  isPending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}

/**
 * Create form in a dialog: centered card on desktop, full-screen sheet on phones so the
 * fields stay above the keyboard. Not dismissible while saving; the backdrop never closes
 * it so a stray tap does not lose what was typed.
 */
export function FormDialog({
  open,
  title,
  description,
  submitLabel,
  submitDisabled = false,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
  children,
}: FormDialogProps) {
  const { t } = useLocale();
  const titleId = useId();
  const descId = useId();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isPending && !submitDisabled) onSubmit();
  };

  return (
    <Modal
      open={open}
      onDismiss={isPending ? undefined : onClose}
      labelledBy={titleId}
      describedBy={description ? descId : undefined}
      phoneLayout="fullscreen"
      panelClassName="max-w-md rounded-[3px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <form onSubmit={handleSubmit} noValidate>
        <header
          className={`${MODAL_STICKY_HEADER} flex items-start gap-2 border-b border-slate-200 bg-white py-1 pr-1 pl-3 dark:border-slate-800 dark:bg-slate-900 max-sm:pt-3`}
        >
          <div className="min-w-0 flex-1 py-1">
            <h2
              id={titleId}
              className="m-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {title}
            </h2>
            {description && (
              <p id={descId} className={`m-0 ${FORM_HINT}`}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className={`inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-0 !bg-transparent text-lg text-slate-500 hover:!bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:!bg-slate-800 dark:hover:text-slate-100 ${MODAL_CLOSE_TAP}`}
            onClick={onClose}
            disabled={isPending}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </header>

        {errorMessage && (
          <p
            role="alert"
            className="m-3 mb-0 rounded-[3px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
          >
            {errorMessage}
          </p>
        )}

        <div className="grid gap-3 px-3 py-3">{children}</div>

        <footer
          className={`${MODAL_STICKY_FOOTER} flex justify-end gap-2 border-t border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900`}
        >
          <button type="button" className={SECONDARY} onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </button>
          <button type="submit" className={PRIMARY} disabled={isPending || submitDisabled}>
            {isPending ? t('common.saving') : submitLabel}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
