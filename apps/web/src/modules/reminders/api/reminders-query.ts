'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IReminderListItem, IUpdateReminderRequest } from '@zalobot/contracts';
import { deleteReminder, getReminders, updateReminder } from './reminders-api';

export const remindersQueryKeys = { list: () => ['reminders'] as const };

export function useRemindersQuery() {
  return useQuery<IReminderListItem[]>({
    queryKey: remindersQueryKeys.list(),
    queryFn: ({ signal }) => getReminders(signal),
  });
}

export function useUpdateReminderMutation() {
  const queryClient = useQueryClient();
  return useMutation<IReminderListItem, Error, { id: string; data: IUpdateReminderRequest }>({
    mutationFn: ({ id, data }) => updateReminder(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: remindersQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteReminderMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteReminder(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: remindersQueryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
