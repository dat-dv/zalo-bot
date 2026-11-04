'use client';

import { create } from 'zustand';
import type { TransactionType } from '@zalobot/contracts';

export type TransactionEditDraft = {
  type: TransactionType;
  category: string;
  note: string;
  placeName: string;
  amount: string;
  occurredAt: string;
};

export const EMPTY_TRANSACTION_EDIT_DRAFT: TransactionEditDraft = {
  type: 'expense',
  category: '',
  note: '',
  amount: '',
  placeName: '',
  occurredAt: '',
};

interface TransactionEditState {
  draft: TransactionEditDraft;
  setDraft: (draft: TransactionEditDraft) => void;
  setField: <K extends keyof TransactionEditDraft>(
    field: K,
    value: TransactionEditDraft[K],
  ) => void;
  resetDraft: () => void;
}

// The inline editor's draft is kept here, not in the transactions screen's React state: each
// input subscribes to its own field, so a keystroke re-renders that input and the save button,
// not the whole table (which used to rebuild every column and row per key).
export const useTransactionEditStore = create<TransactionEditState>()((set) => ({
  draft: EMPTY_TRANSACTION_EDIT_DRAFT,
  setDraft: (draft) => set({ draft }),
  setField: (field, value) =>
    set((state) => {
      const draft = { ...state.draft };
      draft[field] = value;
      return { draft };
    }),
  resetDraft: () => set({ draft: EMPTY_TRANSACTION_EDIT_DRAFT }),
}));
