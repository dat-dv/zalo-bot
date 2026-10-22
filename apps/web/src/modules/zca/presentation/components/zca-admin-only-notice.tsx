'use client';

import Link from 'next/link';
import { APP_ROUTES } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { TAP_CONTROL } from '@/shared/ui/touch';

/** Shown instead of the /zca page when the API answers 403: the signed-in user is not an admin. */
export function ZcaAdminOnlyNotice() {
  const { t } = useLocale();

  return (
    <div className="flex w-full max-w-3xl flex-col gap-3 p-1">
      <section className="flex flex-col items-start gap-2 rounded-[3px] border border-amber-200 bg-amber-50 p-4 shadow-sm max-[640px]:p-3 dark:border-amber-900 dark:bg-amber-950/40">
        <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
          {t('zca.forbidden.title')}
        </h1>
        <p className="text-sm text-slate-700 dark:text-slate-300" role="status">
          {t('zca.forbidden.body')}
        </p>
        <Link
          className={`mt-1 inline-flex items-center text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400 ${TAP_CONTROL}`}
          href={APP_ROUTES.home}
        >
          {t('zca.forbidden.backHome')}
        </Link>
      </section>
    </div>
  );
}
