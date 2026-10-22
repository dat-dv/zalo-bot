'use client';

import { type FormEvent, useState } from 'react';
import {
  APP_ROUTES,
  isDashboardAccessCode,
  normalizeDashboardAccessCode,
  type TranslationKey,
} from '@zalobot/contracts';
import {
  getAccessCodeErrorKind,
  type AccessCodeErrorKind,
} from '@/modules/auth/api/access-code-api';
import { useAccessCodeSignInMutation } from '@/modules/auth/api/access-code-query';
import { setAccessToken } from '@/modules/auth/client/auth-storage';
import { useLocale } from '@/shared/providers/locale-provider';
import { Button } from '@/shared/ui/button';

const ERROR_MESSAGE_KEYS: Record<AccessCodeErrorKind | 'invalidFormat', TranslationKey> = {
  invalidFormat: 'auth.accessCode.invalidFormat',
  rejected: 'auth.accessCode.rejected',
  tooManyAttempts: 'auth.accessCode.tooManyAttempts',
  failed: 'auth.accessCode.failed',
};

/**
 * Sign-in for the installed app: on iOS it has its own storage, so the one-time link opened
 * from Zalo signs in Safari, not the app. The bot sends this code next to the link.
 */
export function AccessCodeForm() {
  const { t } = useLocale();
  const [code, setCode] = useState('');
  const [error, setError] = useState<AccessCodeErrorKind | 'invalidFormat' | null>(null);
  const signIn = useAccessCodeSignInMutation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeDashboardAccessCode(code);
    if (!isDashboardAccessCode(normalized)) {
      setError('invalidFormat');
      return;
    }
    setError(null);
    signIn.mutate(
      { code: normalized },
      {
        onSuccess: ({ accessToken }) => {
          setAccessToken(accessToken);
          // Full load so every query starts again with the new session.
          window.location.assign(APP_ROUTES.dashboard);
        },
        onError: (mutationError) => setError(getAccessCodeErrorKind(mutationError)),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="w-full text-left" noValidate>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {t('auth.accessCode.title')}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {t('auth.accessCode.desc')}
      </p>
      <label
        htmlFor="dashboard-access-code"
        className="mt-3 block text-xs font-medium text-slate-700 dark:text-slate-300"
      >
        {t('auth.accessCode.label')}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="dashboard-access-code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={t('auth.accessCode.placeholder')}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={16}
          aria-invalid={error !== null}
          aria-describedby={error ? 'dashboard-access-code-error' : undefined}
          className="min-h-[42px] min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 font-mono text-base tracking-widest text-slate-900 uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <Button
          type="submit"
          disabled={signIn.isPending}
          className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {signIn.isPending ? t('auth.accessCode.submitting') : t('auth.accessCode.submit')}
        </Button>
      </div>
      {error && (
        <p
          id="dashboard-access-code-error"
          role="alert"
          className="mt-2 text-xs text-rose-600 dark:text-rose-400"
        >
          {t(ERROR_MESSAGE_KEYS[error])}
        </p>
      )}
    </form>
  );
}
