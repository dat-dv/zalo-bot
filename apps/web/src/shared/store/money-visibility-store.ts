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

export function useMoneyFormatter() {
  const isMoneyVisible = useMoneyVisibilityStore((state) => state.isMoneyVisible);
  const { locale, t } = useLocale();

  return useCallback(
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
