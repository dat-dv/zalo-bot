'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  ICreateSavingGroupRequest,
  ICreateSavingMovementRequest,
  ISavingGroup,
  ISavingGroupListResponse,
  ISavingMovement,
  IUpdateSavingGroupRequest,
} from '@zalobot/contracts';
import { analyticsQueryKeys } from '@/modules/dashboard/api/analytics-query';
import { dashboardQueryKeys } from '@/modules/dashboard/api/dashboard-query';
import { transactionsQueryKeys } from '@/modules/dashboard/api/transactions-query';
import {
  addSavingMovement,
  archiveSavingGroup,
  createSavingGroup,
  deleteSavingMovement,
  getSavingGroups,
  getSavingMovements,
  updateSavingGroup,
} from './savings-api';

export const savingsQueryKeys = {
  all: ['savings'] as const,
  list: () => ['savings', 'list'] as const,
  movements: (groupId: string) => ['savings', 'movements', groupId] as const,
};

/** A movement changes the wallet balance, so every screen showing a balance has to refetch. */
function invalidateBalances(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: savingsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: transactionsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
  void queryClient.invalidateQueries({ queryKey: analyticsQueryKeys.all() });
}

export function useSavingGroupsQuery() {
  return useQuery<ISavingGroupListResponse>({
    queryKey: savingsQueryKeys.list(),
    queryFn: ({ signal }) => getSavingGroups(signal),
  });
}

export function useSavingMovementsQuery(groupId: string | null) {
  return useQuery<ISavingMovement[]>({
    queryKey: savingsQueryKeys.movements(groupId ?? ''),
    queryFn: ({ signal }) => getSavingMovements(groupId ?? '', signal),
    enabled: Boolean(groupId),
  });
}

export function useCreateSavingGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<ISavingGroup, Error, ICreateSavingGroupRequest>({
    mutationFn: (data) => createSavingGroup(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savingsQueryKeys.all });
    },
  });
}

export function useUpdateSavingGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<ISavingGroup, Error, { id: string; data: IUpdateSavingGroupRequest }>({
    mutationFn: ({ id, data }) => updateSavingGroup(id, data),
    onSuccess: () => {
      // The group name also appears on savings rows in the transaction table.
      invalidateBalances(queryClient);
    },
  });
}

export function useArchiveSavingGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation<ISavingGroup, Error, string>({
    mutationFn: (id) => archiveSavingGroup(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: savingsQueryKeys.all });
    },
  });
}

export function useAddSavingMovementMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    ISavingMovement,
    Error,
    { groupId: string; data: ICreateSavingMovementRequest }
  >({
    mutationFn: ({ groupId, data }) => addSavingMovement(groupId, data),
    onSuccess: () => invalidateBalances(queryClient),
  });
}

export function useDeleteSavingMovementMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { groupId: string; movementId: string }>({
    mutationFn: ({ groupId, movementId }) => deleteSavingMovement(groupId, movementId),
    onSuccess: () => invalidateBalances(queryClient),
  });
}
