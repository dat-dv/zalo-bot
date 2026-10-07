'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  IAllocateTransactionRequest,
  IAllocateTransactionResponse,
  ICandidateDebtItem,
  IDebtAllocationItem,
} from '@zalobot/contracts';
import { dashboardQueryKeys } from './dashboard-query';
import {
  allocateTransaction,
  deleteDebtAllocation,
  getCandidateDebts,
  getTransactionAllocations,
} from './allocations-api';

export const allocationsQueryKeys = {
  candidateDebts: (transactionId: string) =>
    ['transactions', transactionId, 'candidate-debts'] as const,
  allocations: (transactionId: string) => ['transactions', transactionId, 'allocations'] as const,
};

export function useCandidateDebtsQuery(transactionId: string | null) {
  return useQuery<ICandidateDebtItem[]>({
    queryKey: allocationsQueryKeys.candidateDebts(transactionId || ''),
    queryFn: ({ signal }) => {
      if (!transactionId) return Promise.resolve([]);
      return getCandidateDebts(transactionId, signal);
    },
    enabled: Boolean(transactionId),
  });
}

export function useTransactionAllocationsQuery(transactionId: string | null) {
  return useQuery<IDebtAllocationItem[]>({
    queryKey: allocationsQueryKeys.allocations(transactionId || ''),
    queryFn: ({ signal }) => {
      if (!transactionId) return Promise.resolve([]);
      return getTransactionAllocations(transactionId, signal);
    },
    enabled: Boolean(transactionId),
  });
}

export function useAllocateTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    IAllocateTransactionResponse,
    Error,
    { transactionId: string; data: IAllocateTransactionRequest }
  >({
    mutationFn: ({ transactionId, data }) => allocateTransaction(transactionId, data),
    onSuccess: (_, { transactionId }) => {
      void queryClient.invalidateQueries({
        queryKey: allocationsQueryKeys.candidateDebts(transactionId),
      });
      void queryClient.invalidateQueries({
        queryKey: allocationsQueryKeys.allocations(transactionId),
      });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}

export function useDeleteDebtAllocationMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, { transactionId: string; allocationId: string }>({
    mutationFn: ({ transactionId, allocationId }) =>
      deleteDebtAllocation(transactionId, allocationId),
    onSuccess: (_, { transactionId }) => {
      void queryClient.invalidateQueries({
        queryKey: allocationsQueryKeys.candidateDebts(transactionId),
      });
      void queryClient.invalidateQueries({
        queryKey: allocationsQueryKeys.allocations(transactionId),
      });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
