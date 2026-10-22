'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ICalendarEventItem,
  ICalendarEventsQuery,
  ICreateCalendarEventRequest,
  IUpdateCalendarEventRequest,
} from '@zalobot/contracts';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  resyncCalendarEvent,
  updateCalendarEvent,
} from './calendar-api';

export const calendarQueryKeys = {
  all: () => ['calendarEvents'] as const,
  list: (params: ICalendarEventsQuery) => ['calendarEvents', params] as const,
};

export function useCalendarEventsQuery(params: ICalendarEventsQuery, enabled = true) {
  return useQuery<ICalendarEventItem[]>({
    queryKey: calendarQueryKeys.list(params),
    queryFn: ({ signal }) => getCalendarEvents(params, signal),
    // Month/week navigation keeps the previous range on screen until the next one arrives.
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Every calendar view and the dashboard's "upcoming events" read the same events. */
function useInvalidateCalendar() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all() });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useCreateCalendarEventMutation() {
  const invalidate = useInvalidateCalendar();
  return useMutation<ICalendarEventItem, Error, ICreateCalendarEventRequest>({
    mutationFn: (data) => createCalendarEvent(data),
    onSuccess: invalidate,
  });
}

export function useUpdateCalendarEventMutation() {
  const invalidate = useInvalidateCalendar();
  return useMutation<ICalendarEventItem, Error, { id: string; data: IUpdateCalendarEventRequest }>({
    mutationFn: ({ id, data }) => updateCalendarEvent(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteCalendarEventMutation() {
  const invalidate = useInvalidateCalendar();
  return useMutation<boolean, Error, string>({
    mutationFn: (id) => deleteCalendarEvent(id),
    onSuccess: invalidate,
  });
}

export function useResyncCalendarEventMutation() {
  const invalidate = useInvalidateCalendar();
  return useMutation<ICalendarEventItem, Error, string>({
    mutationFn: (id) => resyncCalendarEvent(id),
    onSuccess: invalidate,
  });
}
