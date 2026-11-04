'use client';

import { create } from 'zustand';
import { useMoneyVisibilityStore, useVisibleMoneyFormatter } from './money-visibility-store';

interface SavingsVisibilityState {
  isSavingsVisible: boolean;
  toggleSavingsVisibility: () => void;
}

// Separate from the global amounts switch on purpose: revealing the wallet must not reveal what is
// set aside, and the reverse. In-memory only, so a reload hides savings again.
export const useSavingsVisibilityStore = create<SavingsVisibilityState>()((set) => ({
  isSavingsVisible: false,
  toggleSavingsVisibility: () => set((state) => ({ isSavingsVisible: !state.isSavingsVisible })),
}));

/**
 * A figure that adds savings to other money needs both switches: under the global one alone,
 * subtracting the wallet balance from it would give the savings away.
 */
export function canShowCombinedMoney(isMoneyVisible: boolean, isSavingsVisible: boolean): boolean {
  return isMoneyVisible && isSavingsVisible;
}

/** Formats amounts held in savings: groups, their total, deposits and withdrawals. */
export function useSavingsMoney() {
  const isSavingsVisible = useSavingsVisibilityStore((state) => state.isSavingsVisible);
  return useVisibleMoneyFormatter(isSavingsVisible);
}

/** Formats figures that include savings, such as wallet + savings or net worth. */
export function useCombinedSavingsMoney() {
  const isMoneyVisible = useMoneyVisibilityStore((state) => state.isMoneyVisible);
  const isSavingsVisible = useSavingsVisibilityStore((state) => state.isSavingsVisible);
  return useVisibleMoneyFormatter(canShowCombinedMoney(isMoneyVisible, isSavingsVisible));
}
