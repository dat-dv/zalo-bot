'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  localeTag,
  normalizeLocale,
  translate,
  type SupportedLocale,
  type TranslationKey,
} from '@zalobot/contracts';

const LOCALE_COOKIE = 'zalobot-locale';
type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);
  useEffect(
    () =>
      setLocaleState(normalizeLocale(document.cookie.match(/(?:^|; )zalobot-locale=([^;]+)/)?.[1])),
    [],
  );
  const setLocale = (next: SupportedLocale) => {
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`;
    document.documentElement.lang = localeTag(next);
    setLocaleState(next);
  };
  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: TranslationKey, values?: Record<string, string | number>) =>
        translate(locale, key, values),
    }),
    [locale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within LocaleProvider');
  return context;
}
