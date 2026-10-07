'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IExpenseListItem, IUpdateExpenseRequest } from '@zalobot/contracts';
import { deleteExpense, getExpenses, updateExpense } from './expenses-api';

export const expensesQueryKeys = { list: () => ['expenses'] as const };

export function useExpensesQuery() {
  return useQuery<IExpenseListItem[]>({
    queryKey: expensesQueryKeys.list(),
    queryFn: ({ signal }) => getExpenses(signal),
  });
}

export function useUpdateExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation<IExpenseListItem, Error, { id: string; data: IUpdateExpenseRequest }>({
    mutationFn: ({ id, data }) => updateExpense(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expensesQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteExpense(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expensesQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
