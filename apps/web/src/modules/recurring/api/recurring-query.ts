'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ICreateRecurringRequest,
  IRecordOccurrenceRequest,
  IRecurringListResponse,
  IUpdateRecurringRequest,
} from '@zalobot/contracts';
import {
  createRecurring,
  deleteRecurring,
  getRecurring,
  recordOccurrence,
  skipOccurrence,
  updateRecurring,
} from './recurring-api';

export const recurringQueryKeys = { list: () => ['recurring'] as const };

export function useRecurringQuery() {
  return useQuery<IRecurringListResponse>({
    queryKey: recurringQueryKeys.list(),
    queryFn: ({ signal }) => getRecurring(signal),
  });
}

function useInvalidateRecurring() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: recurringQueryKeys.list() });
  };
}

export function useSaveRecurringMutation() {
  const invalidate = useInvalidateRecurring();
  return useMutation<
    unknown,
    Error,
    { id?: string; data: ICreateRecurringRequest | IUpdateRecurringRequest }
  >({
    mutationFn: ({ id, data }) =>
      id ? updateRecurring(id, data) : createRecurring(data as ICreateRecurringRequest),
    onSuccess: invalidate,
  });
}

export function useToggleRecurringMutation() {
  const invalidate = useInvalidateRecurring();
  return useMutation<unknown, Error, { id: string; data: IUpdateRecurringRequest }>({
    mutationFn: ({ id, data }) => updateRecurring(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteRecurringMutation() {
  const invalidate = useInvalidateRecurring();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteRecurring(id),
    onSuccess: invalidate,
  });
}

/** A recorded period is a new transaction, so the ledger views refresh too. */
export function useRecordOccurrenceMutation() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRecurring();
  return useMutation<void, Error, { id: string; data: IRecordOccurrenceRequest }>({
    mutationFn: ({ id, data }) => recordOccurrence(id, data),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSkipOccurrenceMutation() {
  const invalidate = useInvalidateRecurring();
  return useMutation<void, Error, string>({
    mutationFn: (id) => skipOccurrence(id),
    onSuccess: invalidate,
  });
}
