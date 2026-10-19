'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  IUserListItem,
  IUserMergeSummary,
  UserRole,
  GrantAccessStatus,
} from '@zalobot/contracts';
import {
  getUsers,
  createUser,
  setGrantAccess,
  updateUser,
  updateUserRole,
  syncUsersWithZca,
  deleteUser,
  getUserMergePreview,
  mergeUser,
} from './users-api';

export const usersQueryKeys = {
  all: () => ['users'] as const,
  mergePreview: (sourceUserId: string, targetUserId: string) =>
    ['users', 'merge-preview', sourceUserId, targetUserId] as const,
};

export function useUsersQuery(options?: { enabled?: boolean }) {
  return useQuery<IUserListItem[]>({
    queryKey: usersQueryKeys.all(),
    queryFn: ({ signal }) => getUsers(signal),
    enabled: options?.enabled,
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: string;
      firstName?: string;
      phoneNumber?: string;
      avatarUrl?: string;
      role?: UserRole;
      grantAccess?: GrantAccessStatus;
    }) => createUser(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all() });
    },
  });
}

export function useSetGrantAccessMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, grantAccess }: { id: string; grantAccess: GrantAccessStatus }) =>
      setGrantAccess(id, grantAccess),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all() });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      firstName?: string;
      phoneNumber?: string;
      avatarUrl?: string;
      role?: UserRole;
      grantAccess?: GrantAccessStatus;
    }) => updateUser(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all() });
    },
  });
}

export function useUpdateUserRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateUserRole(id, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all() });
    },
  });
}

export function useSyncUsersWithZcaMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncUsersWithZca(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all() });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.all() });
    },
  });
}

export function useUserMergePreviewQuery(sourceUserId: string, targetUserId: string) {
  return useQuery<IUserMergeSummary>({
    queryKey: usersQueryKeys.mergePreview(sourceUserId, targetUserId),
    queryFn: ({ signal }) => getUserMergePreview(sourceUserId, targetUserId, signal),
    enabled: Boolean(sourceUserId && targetUserId),
    staleTime: 0,
  });
}

export function useMergeUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceUserId, targetUserId }: { sourceUserId: string; targetUserId: string }) =>
      mergeUser(sourceUserId, targetUserId),
    onSuccess: () => {
      // Merged data affects every user-scoped view (transactions, debts, reminders...).
      void queryClient.invalidateQueries();
    },
  });
}
