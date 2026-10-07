'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ICalendarEventItem,
  ICalendarEventsQuery,
  IUpdateCalendarEventRequest,
} from '@zalobot/contracts';
import { deleteCalendarEvent, getCalendarEvents, updateCalendarEvent } from './calendar-api';

export const calendarQueryKeys = {
  all: () => ['calendarEvents'] as const,
  list: (params: ICalendarEventsQuery) => ['calendarEvents', params] as const,
};

export function useCalendarEventsQuery(params: ICalendarEventsQuery) {
  return useQuery<ICalendarEventItem[]>({
    queryKey: calendarQueryKeys.list(params),
    queryFn: ({ signal }) => getCalendarEvents(params, signal),
  });
}

export function useUpdateCalendarEventMutation() {
  const queryClient = useQueryClient();
  return useMutation<ICalendarEventItem, Error, { id: string; data: IUpdateCalendarEventRequest }>({
    mutationFn: ({ id, data }) => updateCalendarEvent(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteCalendarEventMutation() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteCalendarEvent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all() });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
