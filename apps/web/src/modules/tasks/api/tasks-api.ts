import {
  API_ROUTES,
  type IApiResponse,
  type ICreateTaskRequest,
  type ITaskListItem,
  type ITaskReminderChannel,
  type IUpdateTaskRequest,
} from '@zalobot/contracts';
import axios from 'axios';
import { httpClient } from '@/shared/api/http-client';

/** The API's own reason for a rejected request (e.g. a reminder chat that is not listened). */
export function taskApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: unknown }>(err)) {
    const message = err.response?.data?.message;
    if (typeof message === 'string' && message) return message;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

export async function getTasks(signal?: AbortSignal): Promise<ITaskListItem[]> {
  const response = await httpClient.get<IApiResponse<ITaskListItem[]>>(API_ROUTES.tasks, {
    signal,
  });
  return response.data.data;
}

/** Zalo chats the signed-in user may send a task reminder to. */
export async function getTaskReminderChannels(
  signal?: AbortSignal,
): Promise<ITaskReminderChannel[]> {
  const response = await httpClient.get<IApiResponse<ITaskReminderChannel[]>>(
    API_ROUTES.taskReminderChannels,
    { signal },
  );
  return response.data.data;
}

export async function createTask(
  data: ICreateTaskRequest,
  signal?: AbortSignal,
): Promise<ITaskListItem> {
  const response = await httpClient.post<IApiResponse<ITaskListItem>>(API_ROUTES.tasks, data, {
    signal,
  });
  return response.data.data;
}

export async function updateTask(
  id: string,
  data: IUpdateTaskRequest,
  signal?: AbortSignal,
): Promise<ITaskListItem> {
  const response = await httpClient.patch<IApiResponse<ITaskListItem>>(API_ROUTES.task(id), data, {
    signal,
  });
  return response.data.data;
}

export async function deleteTask(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    API_ROUTES.task(id),
    { signal },
  );
  return response.data.data.deleted;
}
