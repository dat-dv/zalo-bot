import {
  API_ROUTES,
  type IApiResponse,
  type ThreadBotConfig,
  type UpdateThreadBotConfigDto,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export interface ZcaQrStatus {
  phase:
    | 'idle'
    | 'generating'
    | 'qr_ready'
    | 'scanned'
    | 'confirmed'
    | 'logging_in'
    | 'success'
    | 'failed'
    | 'expired'
    | 'declined';
  message: string;
  scannedBy?: string;
  scannedAvatar?: string;
  code?: string;
  error?: string;
  updatedAt: number;
}

export interface ZcaStatus {
  loggedIn: boolean;
  ownId: string | null;
  isListening: boolean;
  listenedCount: number;
  proxyEnabled: boolean;
  qrStatus?: ZcaQrStatus;
}

export interface ZcaThread {
  id: string;
  name: string;
  type: 'user' | 'group';
  isListened: boolean;
  avatar?: string;
  alias?: string;
  displayName?: string;
  zaloName?: string;
  phoneNumber?: string;
  totalMembers?: number;
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

export async function loginZcaQr(
  options?: { forceNew?: boolean },
  signal?: AbortSignal,
): Promise<ZcaLoginQrResult> {
  const response = await httpClient.post<IApiResponse<ZcaLoginQrResult>>(
    API_ROUTES.zcaLoginQr,
    options,
    { signal },
  );
  return response.data.data;
}

export async function getZcaThreads(
  options?: { refresh?: boolean },
  signal?: AbortSignal,
): Promise<ZcaThread[]> {
  const response = await httpClient.get<IApiResponse<{ threads: ZcaThread[] }>>(
    API_ROUTES.zcaThreads,
    {
      params: options?.refresh ? { refresh: 'true' } : undefined,
      signal,
    },
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

export async function getZcaThreadConfigs(signal?: AbortSignal): Promise<ThreadBotConfig[]> {
  const response = await httpClient.get<IApiResponse<{ configs: ThreadBotConfig[] }>>(
    API_ROUTES.zcaThreadConfigs,
    { signal },
  );
  return response.data.data.configs;
}

export async function getZcaThreadConfig(
  threadId: string,
  signal?: AbortSignal,
): Promise<ThreadBotConfig> {
  const response = await httpClient.get<IApiResponse<{ config: ThreadBotConfig }>>(
    API_ROUTES.zcaThreadConfig(threadId),
    { signal },
  );
  return response.data.data.config;
}

export async function updateZcaThreadConfig(
  threadId: string,
  data: UpdateThreadBotConfigDto,
  signal?: AbortSignal,
): Promise<ThreadBotConfig> {
  const response = await httpClient.put<IApiResponse<{ config: ThreadBotConfig }>>(
    API_ROUTES.zcaThreadConfig(threadId),
    data,
    { signal },
  );
  return response.data.data.config;
}
