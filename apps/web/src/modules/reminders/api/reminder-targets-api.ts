import {
  API_ROUTES,
  type IApiResponse,
  type IReminderTargetChannel,
  type IReminderTargetUser,
} from '@zalobot/contracts';
import axios from 'axios';
import { httpClient } from '@/shared/api/http-client';

/**
 * The API's own reason for a rejected task/reminder save (e.g. a reminder chat that is not
 * listened, or a person outside the group).
 */
export function reminderApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: unknown }>(err)) {
    const message = err.response?.data?.message;
    if (typeof message === 'string' && message) return message;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Zalo chats the signed-in user may send a task reminder or a reminder to. */
export async function getReminderTargetChannels(
  signal?: AbortSignal,
): Promise<IReminderTargetChannel[]> {
  const response = await httpClient.get<IApiResponse<IReminderTargetChannel[]>>(
    API_ROUTES.reminderTargetChannels,
    { signal },
  );
  return response.data.data;
}

/** Members of a listened group that can be picked as the people to remind. */
export async function getReminderTargetMembers(
  chatId: string,
  signal?: AbortSignal,
): Promise<IReminderTargetUser[]> {
  const response = await httpClient.get<IApiResponse<IReminderTargetUser[]>>(
    API_ROUTES.reminderTargetMembers(chatId),
    { signal },
  );
  return response.data.data;
}
