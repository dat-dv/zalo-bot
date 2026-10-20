'use client';

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  ICreateTransactionRequest,
  ITransactionItem,
  ITransactionListQuery,
  IUpdateTransactionRequest,
} from '@zalobot/contracts';
import { dashboardQueryKeys } from './dashboard-query';
import { placesQueryKeys } from './places-query';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from './transactions-api';

export const TRANSACTIONS_PAGE_SIZE = 100;

export const transactionsQueryKeys = {
  all: ['transactions'] as const,
  list: (query: Omit<ITransactionListQuery, 'limit' | 'offset'>) =>
    ['transactions', 'list', query] as const,
};

/** Period-scoped ledger pages; the next page starts where the loaded rows end. */
export function useTransactionsInfiniteQuery(
  query: Omit<ITransactionListQuery, 'limit' | 'offset'>,
) {
  return useInfiniteQuery({
    queryKey: transactionsQueryKeys.list(query),
    initialPageParam: 0,
    // Keep the current rows on screen while a new period/filter loads.
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) =>
      listTransactions({ ...query, limit: TRANSACTIONS_PAGE_SIZE, offset: pageParam }, signal),
    getNextPageParam: (lastPage) => {
      const next = lastPage.offset + lastPage.items.length;
      return lastPage.items.length > 0 && next < lastPage.total ? next : undefined;
    },
  });
}

export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation<ITransactionItem, Error, ICreateTransactionRequest>({
    mutationFn: (data) => createTransaction(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['finance-analytics'] });
      void queryClient.invalidateQueries({ queryKey: placesQueryKeys.all });
    },
  });
}

export function useUpdateTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation<ITransactionItem, Error, { id: string; data: IUpdateTransactionRequest }>({
    mutationFn: ({ id, data }) => updateTransaction(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: placesQueryKeys.all });
    },
  });
}

export function useDeleteTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteTransaction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
