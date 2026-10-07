'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { localeTag } from '@zalobot/contracts';
import { useLocale } from './locale-provider';

export interface MoneyVisibilityContextValue {
  isMoneyVisible: boolean;
  toggleMoneyVisibility: () => void;
  setMoneyVisibility: (visible: boolean) => void;
  money: (value: number) => string;
}

const MONEY_VISIBILITY_STORAGE_KEY = 'zalobot-money-visibility';
const MoneyVisibilityContext = createContext<MoneyVisibilityContextValue | null>(null);

function getInitialMoneyVisibility(): boolean {
  try {
    const saved = window.localStorage.getItem(MONEY_VISIBILITY_STORAGE_KEY);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
  } catch {
    // Keep default when storage is unavailable.
  }
  return false;
}

export function MoneyVisibilityProvider({ children }: { children: ReactNode }) {
  const [isMoneyVisible, setIsMoneyVisible] = useState(false);
  const { locale, t } = useLocale();

  useEffect(() => {
    setIsMoneyVisible(getInitialMoneyVisibility());
  }, []);

  const toggleMoneyVisibility = useCallback(() => {
    setIsMoneyVisible((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MONEY_VISIBILITY_STORAGE_KEY, String(next));
      } catch {
        // Keep in-memory preference when storage is unavailable.
      }
      return next;
    });
  }, []);

  const setMoneyVisibility = useCallback((visible: boolean) => {
    try {
      window.localStorage.setItem(MONEY_VISIBILITY_STORAGE_KEY, String(visible));
    } catch {
      // Keep in-memory preference when storage is unavailable.
    }
    setIsMoneyVisible(visible);
  }, []);

  const money = useCallback(
    (value: number) => {
      if (!isMoneyVisible) {
        return t('common.maskedAmount');
      }
      return new Intl.NumberFormat(localeTag(locale), {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(value);
    },
    [isMoneyVisible, locale, t],
  );

  const value = useMemo(
    () => ({
      isMoneyVisible,
      toggleMoneyVisibility,
      setMoneyVisibility,
      money,
    }),
    [isMoneyVisible, toggleMoneyVisibility, setMoneyVisibility, money],
  );

  return (
    <MoneyVisibilityContext.Provider value={value}>{children}</MoneyVisibilityContext.Provider>
  );
}

export function useMoneyVisibility() {
  const context = useContext(MoneyVisibilityContext);
  if (!context) {
    throw new Error('useMoneyVisibility must be used within MoneyVisibilityProvider');
  }
  return context;
}

export function useMoneyFormatter() {
  const { money } = useMoneyVisibility();
  return money;
}
