import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ICombineContactsRequest,
  ICombineContactsResponse,
  IContactListItem,
  IUpdateContactRequest,
} from '@zalobot/contracts';
import { combineContacts, deleteContact, getContacts, updateContact } from './contacts-api';

export const contactsQueryKeys = { list: () => ['contacts'] as const };

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
      void queryClient.invalidateQueries({ queryKey: ['debts'] });
      void queryClient.invalidateQueries({ queryKey: ['transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteContactMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteContact(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contactsQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['debts'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
