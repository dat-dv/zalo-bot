import {
  API_ROUTES,
  type IApiResponse,
  type ITaskListItem,
  type IUpdateTaskRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getTasks(signal?: AbortSignal): Promise<ITaskListItem[]> {
  const response = await httpClient.get<IApiResponse<ITaskListItem[]>>(API_ROUTES.tasks, {
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

/** Re-write the Google copy (after a failure, or into the currently connected account). */
export async function resyncTask(id: string, signal?: AbortSignal): Promise<ITaskListItem> {
  const response = await httpClient.post<IApiResponse<ITaskListItem>>(
    API_ROUTES.taskResync(id),
    undefined,
    { signal },
  );
  return response.data.data;
}
