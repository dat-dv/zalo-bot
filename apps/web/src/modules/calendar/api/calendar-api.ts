import {
  API_ROUTES,
  type IApiResponse,
  type ICalendarEventItem,
  type ICalendarEventsQuery,
  type IUpdateCalendarEventRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getCalendarEvents(
  params: ICalendarEventsQuery,
  signal?: AbortSignal,
): Promise<ICalendarEventItem[]> {
  const response = await httpClient.get<IApiResponse<ICalendarEventItem[]>>(
    API_ROUTES.calendarEvents,
    { params, signal },
  );
  return response.data.data;
}

export async function updateCalendarEvent(
  id: string,
  data: IUpdateCalendarEventRequest,
  signal?: AbortSignal,
): Promise<ICalendarEventItem> {
  const response = await httpClient.patch<IApiResponse<ICalendarEventItem>>(
    `${API_ROUTES.calendarEvents}/${id}`,
    data,
    { signal },
  );
  return response.data.data;
}

export async function deleteCalendarEvent(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    `${API_ROUTES.calendarEvents}/${id}`,
    { signal },
  );
  return response.data.data.deleted;
}
