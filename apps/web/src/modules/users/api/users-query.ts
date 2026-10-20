'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type {
  ILedgerInfo,
  IUserLinkedContactItem,
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
  getUserLinkedContacts,
  mergeUser,
  getLedgerInfo,
  setLedgerOwner,
  consolidateLedger,
} from './users-api';
import { contactsQueryKeys } from '@/modules/contacts/api/contacts-query';
import { dashboardQueryKeys } from '@/modules/dashboard/api/dashboard-query';
import { placesQueryKeys } from '@/modules/dashboard/api/places-query';
import { transactionsQueryKeys } from '@/modules/dashboard/api/transactions-query';
import { debtsQueryKeys } from '@/modules/debts/api/debts-query';
import { expensesQueryKeys } from '@/modules/expenses/api/expenses-query';

export const usersQueryKeys = {
  all: () => ['users'] as const,
  mergePreview: (sourceUserId: string, targetUserId: string) =>
    ['users', 'merge-preview', sourceUserId, targetUserId] as const,
  linkedContacts: (userId: string) => ['users', 'linked-contacts', userId] as const,
  ledger: () => ['users', 'ledger'] as const,
};

const isForbidden = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response?.status === 403;

/**
 * Danh sách user chỉ admin gọi được: `isSuccess` cũng chính là tín hiệu người xem là admin
 * (người dùng thường nhận 403, không retry).
 */
export function useUsersQuery(options?: { enabled?: boolean }) {
  return useQuery<IUserListItem[]>({
    queryKey: usersQueryKeys.all(),
    queryFn: ({ signal }) => getUsers(signal),
    enabled: options?.enabled,
    retry: (failureCount, error) => !isForbidden(error) && failureCount < 1,
  });
}

export function useUserLinkedContactsQuery(userId: string | null) {
  return useQuery<IUserLinkedContactItem[]>({
    queryKey: usersQueryKeys.linkedContacts(userId ?? ''),
    queryFn: ({ signal }) => getUserLinkedContacts(userId ?? '', signal),
    enabled: Boolean(userId),
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

/** Sổ thu chi chung (admin): chủ sổ hiện tại và các sổ khác có thể gộp vào. */
export function useLedgerQuery(options?: { enabled?: boolean }) {
  return useQuery<ILedgerInfo>({
    queryKey: usersQueryKeys.ledger(),
    queryFn: ({ signal }) => getLedgerInfo(signal),
    enabled: options?.enabled,
    retry: (failureCount, error) => !isForbidden(error) && failureCount < 1,
  });
}

/** Đổi chủ sổ làm thay đổi sổ mà mọi màn hình tài chính đang đọc. */
export function useSetLedgerOwnerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string | null) => setLedgerOwner(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: usersQueryKeys.ledger() });
      void queryClient.invalidateQueries({ queryKey: transactionsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.detail() });
    },
  });
}

/** Gộp dữ liệu cũ: giao dịch, nơi chốn, danh bạ, công nợ đều chuyển sang sổ của chủ sổ. */
export function useConsolidateLedgerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => consolidateLedger(),
    onSuccess: () => {
      for (const queryKey of [
        usersQueryKeys.ledger(),
        transactionsQueryKeys.all,
        dashboardQueryKeys.detail(),
        expensesQueryKeys.list(),
        debtsQueryKeys.list(),
        contactsQueryKeys.list(),
        placesQueryKeys.all,
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
