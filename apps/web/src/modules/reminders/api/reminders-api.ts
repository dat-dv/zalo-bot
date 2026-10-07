import {
  API_ROUTES,
  type IApiResponse,
  type IReminderListItem,
  type IUpdateReminderRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getReminders(signal?: AbortSignal): Promise<IReminderListItem[]> {
  const response = await httpClient.get<IApiResponse<IReminderListItem[]>>(API_ROUTES.reminders, {
    signal,
  });
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
