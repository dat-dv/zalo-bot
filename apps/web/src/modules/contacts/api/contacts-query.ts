import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ICombineContactsRequest,
  ICombineContactsResponse,
  IContactListItem,
  IContactProfileResponse,
  IContactUserSyncResult,
  IUpdateContactProfileRequest,
  IUpdateContactRequest,
} from '@zalobot/contracts';
import {
  combineContacts,
  deleteContact,
  getContactProfile,
  getContacts,
  syncUsersIntoContacts,
  updateContact,
  updateContactProfile,
} from './contacts-api';

export const contactsQueryKeys = {
  list: () => ['contacts'] as const,
  profile: (id: string) => ['contacts', 'profile', id] as const,
};

export function useContactsQuery() {
  return useQuery<IContactListItem[]>({
    queryKey: contactsQueryKeys.list(),
    queryFn: ({ signal }) => getContacts(signal),
  });
}

export function useUpdateContactMutation() {
  const queryClient = useQueryClient();
  return useMutation<IContactListItem, Error, { id: string; data: IUpdateContactRequest }>({
    mutationFn: ({ id, data }) => updateContact(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contactsQueryKeys.list() });
      // Số Người liên quan đã gắn hiển thị trên trang ZCA nằm trong danh sách users.
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['debts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCombineContactsMutation() {
  const queryClient = useQueryClient();
  return useMutation<ICombineContactsResponse, Error, ICombineContactsRequest>({
    mutationFn: (data) => combineContacts(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contactsQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['debts'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Admin: đưa người dùng Zalo vào danh bạ công nợ và đồng bộ SĐT (chạy lại không sinh trùng). */
export function useSyncUsersIntoContactsMutation() {
  const queryClient = useQueryClient();
  return useMutation<IContactUserSyncResult, Error, void>({
    mutationFn: () => syncUsersIntoContacts(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contactsQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteContactMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteContact(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contactsQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['debts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useContactProfileQuery(id: string | null) {
  return useQuery<IContactProfileResponse>({
    queryKey: contactsQueryKeys.profile(id ?? ''),
    queryFn: ({ signal }) => getContactProfile(id ?? '', signal),
    enabled: Boolean(id),
  });
}

/**
 * Saves the profile page form: base fields go through the existing contact PATCH (only when they
 * changed), profile fields through the profile PATCH.
 */
export function useSaveContactProfileMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { base?: IUpdateContactRequest; profile: IUpdateContactProfileRequest }
  >({
    mutationFn: async ({ base, profile }) => {
      if (base) await updateContact(id, base);
      await updateContactProfile(id, profile);
    },
    onSettled: () => {
      // `['contacts']` is a prefix of the profile key, so the list and this profile both refetch.
      void queryClient.invalidateQueries({ queryKey: contactsQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['debts'] });
    },
  });
}
