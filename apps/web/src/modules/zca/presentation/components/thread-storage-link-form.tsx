'use client';

import { useId, type FormEvent } from 'react';
import {
  CHANNEL_STORAGE_LINK_HOSTS,
  CHANNEL_STORAGE_LINK_LIMITS,
  type ChannelStorageLinkKind,
  type ChannelStorageLinkUpdateError,
  type ChannelStorageLinkUpdateErrors,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';

export interface StorageLinkDraft {
  displayName: string;
  url: string;
  googleEmail: string;
}

type StorageLinkField = keyof StorageLinkDraft;

interface StorageLinkFormProps {
  kind: ChannelStorageLinkKind;
  draft: StorageLinkDraft;
  onDraftChange: (draft: StorageLinkDraft) => void;
  /** From the shared contracts validator (or a 409), so most mistakes never reach the server. */
  errors: ChannelStorageLinkUpdateErrors;
  displayNamePlaceholder: string;
  urlPlaceholder?: string;
  /** The link in use: uploads rewrite its URL, so the field is read-only. */
  urlLocked?: boolean;
  /** Adding starts from the link, the only required field; editing usually renames. */
  urlFirst?: boolean;
  hint?: string;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  serverError?: string;
  ariaLabel?: string;
  onSubmit: () => void;
  onCancel: () => void;
}

type Translate = ReturnType<typeof useLocale>['t'];

const INPUT_CLASS =
  'mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-red-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900 max-sm:h-10';
export const STORAGE_LINK_ACTION_BUTTON_CLASS =
  'inline-flex min-h-8 items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-10 max-sm:px-3';
export const STORAGE_LINK_SECONDARY_BUTTON_CLASS = `${STORAGE_LINK_ACTION_BUTTON_CLASS} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700`;
const PRIMARY_BUTTON_CLASS = `${STORAGE_LINK_ACTION_BUTTON_CLASS} border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500`;

function storageLinkErrorMessage(
  t: Translate,
  kind: ChannelStorageLinkKind,
  code: ChannelStorageLinkUpdateError,
): string {
  switch (code) {
    case 'display_name_too_long':
      return t('zca.storageLinks.errors.displayNameTooLong', {
        max: CHANNEL_STORAGE_LINK_LIMITS.DISPLAY_NAME_MAX_LENGTH,
      });
    case 'url_required':
      return t('zca.storageLinks.errors.urlRequired');
    case 'url_invalid':
      return t('zca.storageLinks.errors.urlInvalid');
    case 'url_wrong_host':
      return t('zca.storageLinks.errors.urlWrongHost', {
        hosts: CHANNEL_STORAGE_LINK_HOSTS[kind].join(', '),
      });
    case 'url_duplicate':
      return t('zca.storageLinks.errors.urlDuplicate');
    case 'email_invalid':
      return t('zca.storageLinks.errors.emailInvalid');
  }
}

/** Display name, URL and Google email of a Drive/Photos link; shared by Add and Edit. */
export function StorageLinkForm({
  kind,
  draft,
  onDraftChange,
  errors,
  displayNamePlaceholder,
  urlPlaceholder,
  urlLocked = false,
  urlFirst = false,
  hint,
  submitLabel,
  pendingLabel,
  isPending,
  serverError,
  ariaLabel,
  onSubmit,
  onCancel,
}: StorageLinkFormProps) {
  const { t } = useLocale();
  const fieldId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const fieldsByKey: Record<
    StorageLinkField,
    {
      label: string;
      placeholder?: string;
      hint?: string;
      type: 'text' | 'url' | 'email';
      disabled?: boolean;
    }
  > = {
    displayName: {
      label: t('zca.storageLinks.displayNameLabel'),
      placeholder: displayNamePlaceholder,
      type: 'text',
    },
    url: {
      label: t('zca.storageLinks.urlLabel'),
      placeholder: urlPlaceholder,
      hint: urlLocked ? t('zca.storageLinks.urlLockedHint') : undefined,
      type: 'url',
      disabled: urlLocked,
    },
    googleEmail: {
      label: t('zca.storageLinks.emailLabel'),
      placeholder: t('zca.storageLinks.emailPlaceholder'),
      type: 'email',
    },
  };
  const order: StorageLinkField[] = urlFirst
    ? ['url', 'displayName', 'googleEmail']
    : ['displayName', 'url', 'googleEmail'];

  return (
    <form aria-label={ariaLabel} className="space-y-2.5" noValidate onSubmit={handleSubmit}>
      {order.map((key, index) => {
        const field = fieldsByKey[key];
        const inputId = `${fieldId}-${key}`;
        const error = errors[key];
        const describedBy = error ? `${inputId}-error` : field.hint ? `${inputId}-hint` : undefined;
        return (
          <div key={key}>
            <label
              className="text-[11px] font-medium text-slate-600 dark:text-slate-400"
              htmlFor={inputId}
            >
              {field.label}
            </label>
            <input
              aria-describedby={describedBy}
              aria-invalid={Boolean(error)}
              autoFocus={urlFirst && index === 0}
              className={INPUT_CLASS}
              disabled={field.disabled || isPending}
              id={inputId}
              onChange={(event) => onDraftChange({ ...draft, [key]: event.target.value })}
              placeholder={field.placeholder}
              type={field.type}
              value={draft[key]}
            />
            {error ? (
              <p
                className="mt-0.5 text-[11px] text-red-600 dark:text-red-400"
                id={`${inputId}-error`}
              >
                {storageLinkErrorMessage(t, kind, error)}
              </p>
            ) : field.hint ? (
              <p
                className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400"
                id={`${inputId}-hint`}
              >
                {field.hint}
              </p>
            ) : null}
          </div>
        );
      })}
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
      {serverError && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {serverError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
        <button
          className={STORAGE_LINK_SECONDARY_BUTTON_CLASS}
          disabled={isPending}
          onClick={onCancel}
          type="button"
        >
          {t('zca.storageLinks.cancel')}
        </button>
        <button className={PRIMARY_BUTTON_CLASS} disabled={isPending} type="submit">
          {isPending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
