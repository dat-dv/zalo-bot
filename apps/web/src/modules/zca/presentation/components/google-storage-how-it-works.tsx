'use client';

import type { TranslationKey } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';

const POINT_KEYS: readonly TranslationKey[] = [
  'googleStorage.howItWorks.storage',
  'googleStorage.howItWorks.switch',
  'googleStorage.howItWorks.logout',
  'googleStorage.howItWorks.personal',
];

/** What switching or signing out the storage account does, so admins know before they click. */
export function GoogleStorageHowItWorks() {
  const { t } = useLocale();
  return (
    <section
      aria-labelledby="google-storage-how-title"
      className="rounded-[3px] border border-slate-200 bg-white p-4 shadow-sm max-[640px]:p-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2
        id="google-storage-how-title"
        className="text-sm font-semibold text-slate-900 dark:text-slate-100"
      >
        {t('googleStorage.howItWorks.title')}
      </h2>
      <ul className="mt-2 grid list-disc gap-1.5 pl-4 text-xs text-slate-600 dark:text-slate-300">
        {POINT_KEYS.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
    </section>
  );
}
