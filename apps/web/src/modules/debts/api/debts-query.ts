'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ICombineDebtsRequest,
  type ICombineDebtsResponse,
  type ICreateDebtPaymentRequest,
  type ICreateDebtRequest,
  type IDebtListItem,
  type IDebtPaymentItem,
  type IUpdateDebtRequest,
} from '@zalobot/contracts';
import {
  combineDebts,
  createDebt,
  createDebtPayment,
  deleteDebt,
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

export function useCreateDebtMutation() {
  const queryClient = useQueryClient();
  return useMutation<IDebtListItem, Error, ICreateDebtRequest>({
    mutationFn: (data) => createDebt(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: debtsQueryKeys.list() });
      // A new person may have been created in the shared contacts.
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteDebtMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteDebt(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: debtsQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
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
