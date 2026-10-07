'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ICombineDebtsRequest,
  type ICombineDebtsResponse,
  type ICreateDebtPaymentRequest,
  type IDebtListItem,
  type IDebtPaymentItem,
  type IUpdateDebtRequest,
} from '@zalobot/contracts';
import {
  combineDebts,
  createDebtPayment,
  deleteDebtPayment,
  getDebts,
  updateDebt,
} from './debts-api';

export const debtsQueryKeys = { list: () => ['debts'] as const };

export function useDebtsQuery() {
  return useQuery<IDebtListItem[]>({
    queryKey: debtsQueryKeys.list(),
    queryFn: ({ signal }) => getDebts(signal),
  });
}

export function useUpdateDebtMutation() {
  const queryClient = useQueryClient();
  return useMutation<IDebtListItem, Error, { id: string; data: IUpdateDebtRequest }>({
    mutationFn: ({ id, data }) => updateDebt(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: debtsQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateDebtPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation<IDebtPaymentItem, Error, ICreateDebtPaymentRequest>({
    mutationFn: (data) => createDebtPayment(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: debtsQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteDebtPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ deleted: boolean }, Error, { debtId: string; paymentId: string }>({
    mutationFn: ({ debtId, paymentId }) => deleteDebtPayment(debtId, paymentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: debtsQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCombineDebtsMutation() {
  const queryClient = useQueryClient();
  return useMutation<ICombineDebtsResponse, Error, ICombineDebtsRequest>({
    mutationFn: (data) => combineDebts(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: debtsQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
