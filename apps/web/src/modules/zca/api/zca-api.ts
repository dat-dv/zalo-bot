import { API_ROUTES, type IApiResponse } from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export interface ZcaStatus {
  loggedIn: boolean;
  ownId: string | null;
  isListening: boolean;
  listenedCount: number;
  proxyEnabled: boolean;
}

export interface ZcaThread {
  id: string;
  name: string;
  type: 'user' | 'group';
  isListened: boolean;
  avatar?: string;
}

export interface ZcaLoginQrResult {
  message: string;
  qrUrl: string;
  code: string | null;
}

export async function getZcaStatus(signal?: AbortSignal): Promise<ZcaStatus> {
  const response = await httpClient.get<IApiResponse<ZcaStatus>>(API_ROUTES.zcaStatus, {
    signal,
  });
  return response.data.data;
}

export async function loginZcaQr(signal?: AbortSignal): Promise<ZcaLoginQrResult> {
  const response = await httpClient.post<IApiResponse<ZcaLoginQrResult>>(
    API_ROUTES.zcaLoginQr,
    undefined,
    { signal },
  );
  return response.data.data;
}

export async function getZcaThreads(signal?: AbortSignal): Promise<ZcaThread[]> {
  const response = await httpClient.get<IApiResponse<{ threads: ZcaThread[] }>>(
    API_ROUTES.zcaThreads,
    { signal },
  );
  return response.data.data.threads;
}

export async function getZcaListenedThreads(signal?: AbortSignal): Promise<string[]> {
  const response = await httpClient.get<IApiResponse<{ threadIds: string[] }>>(
    API_ROUTES.zcaListenedThreads,
    { signal },
  );
  return response.data.data.threadIds;
}

export async function setZcaListenedThreads(
  threadIds: string[],
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await httpClient.put<
    IApiResponse<{ success: boolean; count: number; threadIds: string[] }>
  >(API_ROUTES.zcaListenedThreads, { threadIds }, { signal });
  return response.data.data.threadIds;
}

export async function toggleZcaListenedThread(
  threadId: string,
  signal?: AbortSignal,
): Promise<{ threadId: string; isListened: boolean }> {
  const response = await httpClient.post<
    IApiResponse<{ success: boolean; threadId: string; isListened: boolean }>
  >(API_ROUTES.zcaListenedThreadsToggle, { threadId }, { signal });
  return response.data.data;
}
