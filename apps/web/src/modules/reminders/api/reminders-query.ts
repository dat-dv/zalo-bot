'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ICreateReminderRequest,
  IReminderListItem,
  IUpdateReminderRequest,
  ReminderListStatus,
} from '@zalobot/contracts';
import { createReminder, deleteReminder, getReminders, updateReminder } from './reminders-api';

/** `all` covers both tabs, so a change refreshes the upcoming and the done list together. */
export const remindersQueryKeys = {
  all: () => ['reminders'] as const,
  list: (status: ReminderListStatus) => ['reminders', status] as const,
};

export function useRemindersQuery(status: ReminderListStatus) {
  return useQuery<IReminderListItem[]>({
    queryKey: remindersQueryKeys.list(status),
    queryFn: ({ signal }) => getReminders(status, signal),
  });
}

export function useCreateReminderMutation() {
  const queryClient = useQueryClient();
  return useMutation<IReminderListItem, Error, ICreateReminderRequest>({
    mutationFn: (data) => createReminder(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: remindersQueryKeys.all() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateReminderMutation() {
  const queryClient = useQueryClient();
  return useMutation<IReminderListItem, Error, { id: string; data: IUpdateReminderRequest }>({
    mutationFn: ({ id, data }) => updateReminder(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: remindersQueryKeys.all() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteReminderMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteReminder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: remindersQueryKeys.all() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
