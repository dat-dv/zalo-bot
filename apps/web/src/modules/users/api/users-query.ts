'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IUserListItem, UserRole, GrantAccessStatus } from '@zalobot/contracts';
import { getUsers, createUser, setGrantAccess, updateUserRole, deleteUser } from './users-api';

export const usersQueryKeys = {
  all: () => ['users'] as const,
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

export function useUpdateUserRoleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateUserRole(id, role),
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
