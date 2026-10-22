import {
  API_ROUTES,
  type IApiResponse,
  type ICreateReminderRequest,
  type IReminderListItem,
  type IUpdateReminderRequest,
  type ReminderListStatus,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getReminders(
  status: ReminderListStatus,
  signal?: AbortSignal,
): Promise<IReminderListItem[]> {
  const response = await httpClient.get<IApiResponse<IReminderListItem[]>>(API_ROUTES.reminders, {
    params: { status },
    signal,
  });
  return response.data.data;
}

export async function createReminder(
  data: ICreateReminderRequest,
  signal?: AbortSignal,
): Promise<IReminderListItem> {
  const response = await httpClient.post<IApiResponse<IReminderListItem>>(
    API_ROUTES.reminders,
    data,
    { signal },
  );
  return response.data.data;
}

export async function updateReminder(
  id: string,
  data: IUpdateReminderRequest,
  signal?: AbortSignal,
): Promise<IReminderListItem> {
  const response = await httpClient.patch<IApiResponse<IReminderListItem>>(
    `${API_ROUTES.reminders}/${id}`,
    data,
    { signal },
  );
  return response.data.data;
}

export async function deleteReminder(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    `${API_ROUTES.reminders}/${id}`,
    { signal },
  );
  return response.data.data.deleted;
}
