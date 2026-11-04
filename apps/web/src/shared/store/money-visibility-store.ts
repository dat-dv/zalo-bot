'use client';

import { useCallback } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { localeTag } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';

interface MoneyVisibilityState {
  isMoneyVisible: boolean;
  toggleMoneyVisibility: () => void;
  setMoneyVisibility: (visible: boolean) => void;
}

export interface MoneyVisibilityValue extends MoneyVisibilityState {
  money: (value: number) => string;
}

// In-memory only (no persist middleware): amounts start hidden on every page load,
// so a reload never reveals them.
export const useMoneyVisibilityStore = create<MoneyVisibilityState>()((set) => ({
  isMoneyVisible: false,
  toggleMoneyVisibility: () => set((state) => ({ isMoneyVisible: !state.isMoneyVisible })),
  setMoneyVisibility: (visible) => set({ isMoneyVisible: visible }),
}));

// One formatter per locale: building an `Intl.NumberFormat` costs far more than formatting with
// it, and a table page calls `money()` for every amount cell on every render.
const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(locale: Parameters<typeof localeTag>[0]): Intl.NumberFormat {
  const tag = localeTag(locale);
  let formatter = currencyFormatters.get(tag);
  if (!formatter) {
    formatter = new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    });
    currencyFormatters.set(tag, formatter);
  }
  return formatter;
}

/** Formats amounts, or masks them while `isVisible` is off. */
export function useVisibleMoneyFormatter(isVisible: boolean) {
  const { locale, t } = useLocale();

  return useCallback(
    (value: number) => {
      if (!isVisible) {
        return t('common.maskedAmount');
      }
      return currencyFormatter(locale).format(value);
    },
    [isVisible, locale, t],
  );
}

export function useMoneyFormatter() {
  const isMoneyVisible = useMoneyVisibilityStore((state) => state.isMoneyVisible);
  return useVisibleMoneyFormatter(isMoneyVisible);
}

export function useMoneyVisibility(): MoneyVisibilityValue {
  const state = useMoneyVisibilityStore(
    useShallow((s) => ({
      isMoneyVisible: s.isMoneyVisible,
      toggleMoneyVisibility: s.toggleMoneyVisibility,
      setMoneyVisibility: s.setMoneyVisibility,
    })),
  );
  const money = useMoneyFormatter();
  return { ...state, money };
}
