'use client';

import { useQuery } from '@tanstack/react-query';
import type { IReminderTargetChannel, IReminderTargetUser } from '@zalobot/contracts';
import { getReminderTargetChannels, getReminderTargetMembers } from './reminder-targets-api';

export const reminderTargetsQueryKeys = {
  all: () => ['reminder-targets'] as const,
  channels: () => ['reminder-targets', 'channels'] as const,
  members: (chatId: string) => ['reminder-targets', 'members', chatId] as const,
};

/** Loaded only while a form that picks a reminder chat is open. */
export function useReminderTargetChannelsQuery(enabled: boolean) {
  return useQuery<IReminderTargetChannel[]>({
    queryKey: reminderTargetsQueryKeys.channels(),
    queryFn: ({ signal }) => getReminderTargetChannels(signal),
    enabled,
    staleTime: 60_000,
  });
}

/** Members of the picked group; only for a group chat. */
export function useReminderTargetMembersQuery(chatId: string | undefined, enabled: boolean) {
  return useQuery<IReminderTargetUser[]>({
    queryKey: reminderTargetsQueryKeys.members(chatId ?? ''),
    queryFn: ({ signal }) => getReminderTargetMembers(chatId ?? '', signal),
    enabled: enabled && !!chatId,
    staleTime: 60_000,
    retry: false,
  });
}
