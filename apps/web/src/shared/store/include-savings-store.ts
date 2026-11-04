'use client';

import { create } from 'zustand';

interface IncludeSavingsState {
  includeSavings: boolean;
  toggleIncludeSavings: () => void;
}

// In-memory only (no persist middleware): balances show the wallet on every page load.
export const useIncludeSavingsStore = create<IncludeSavingsState>()((set) => ({
  includeSavings: false,
  toggleIncludeSavings: () => set((state) => ({ includeSavings: !state.includeSavings })),
}));
