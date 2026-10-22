import {
  API_ROUTES,
  type ChannelStorageLinksResponse,
  type IApiResponse,
  type UpdateChannelStorageLinkDto,
  type ThreadBotConfig,
  type UpdateThreadBotConfigDto,
  type SyncThreadMediaDto,
  type SyncThreadMediaResponse,
} from '@zalobot/contracts';
import { httpClient, resolveApiBaseUrl } from '@/shared/api/http-client';

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

/** Thread list plus when the server last fetched it from Zalo (it is cached for up to a week). */
export interface ZcaThreadsResult {
  threads: ZcaThread[];
  fetchedAt: string | null;
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

export async function logoutZca(
  signal?: AbortSignal,
): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.post<IApiResponse<{ success: boolean; message: string }>>(
    API_ROUTES.zcaLogout,
    {},
    { signal },
  );
  return response.data.data;
}

export async function getZcaThreads(
  options?: { refresh?: boolean },
  signal?: AbortSignal,
): Promise<ZcaThreadsResult> {
  const response = await httpClient.get<
    IApiResponse<{ threads: ZcaThread[]; fetchedAt?: string | null }>
  >(API_ROUTES.zcaThreads, {
    params: options?.refresh ? { refresh: 'true' } : undefined,
    signal,
  });
  const { threads, fetchedAt } = response.data.data;
  return { threads, fetchedAt: fetchedAt ?? null };
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

/** Loaded by `<img>`, so the API authenticates it with the dashboard refresh cookie. */
export function getZcaQrImageUrl(cacheBuster: number): string {
  return `${resolveApiBaseUrl()}${API_ROUTES.zcaQr}?t=${cacheBuster}`;
}

export interface DriveFolderLinkResult {
  folderPath?: string;
  webViewLink: string;
}

export function getThreadDriveOpenUrl(threadId?: string, threadName?: string): string {
  const base = resolveApiBaseUrl();
  if (!threadId) {
    return `${base}${API_ROUTES.driveOpen}`;
  }
  const params = new URLSearchParams({ channelId: threadId });
  if (threadName) {
    params.set('threadName', threadName);
  }
  return `${base}${API_ROUTES.driveOpen}?${params.toString()}`;
}

export function getThreadDriveLink(
  thread: { id: string; name?: string },
  config?: ThreadBotConfig | null,
): string {
  if (config?.driveFolderUrl) {
    return config.driveFolderUrl;
  }
  return getThreadDriveOpenUrl(thread.id, thread.name);
}

/** Mirrors the API's channel Drive root: the thread's `customFolder`, else `zalobot/<threadId>`. */
export function getThreadDriveFolderLabel(
  thread: { id: string },
  config?: Pick<ThreadBotConfig, 'mediaBackup'> | null,
): string {
  return config?.mediaBackup.customFolder?.trim() || `zalobot/${thread.id}`;
}

/** Mirrors the API's album choice: `photosAlbum` override, stored album, else `[Zalo] <name>`. */
export function getThreadPhotosAlbumLabel(
  thread: { id: string; name?: string },
  config?: Pick<ThreadBotConfig, 'mediaBackup' | 'photosAlbumTitle'> | null,
): string {
  return (
    config?.mediaBackup.photosAlbum?.trim() ||
    config?.photosAlbumTitle?.trim() ||
    (thread.name ? `[Zalo] ${thread.name}` : `[Zalo] Nhóm ${thread.id}`)
  );
}

export function getThreadPhotosOpenUrl(threadId?: string, threadName?: string): string {
  const base = resolveApiBaseUrl();
  const path = API_ROUTES.photosOpen;
  if (!threadId) {
    return `${base}${path}`;
  }
  const params = new URLSearchParams({ channelId: threadId });
  if (threadName) {
    params.set('threadName', threadName);
  }
  return `${base}${path}?${params.toString()}`;
}

export function getThreadPhotosLink(
  thread: { id: string; name?: string },
  config?: ThreadBotConfig | null,
): string {
  if (config?.photosAlbumUrl) {
    return config.photosAlbumUrl;
  }
  return getThreadPhotosOpenUrl(thread.id, thread.name);
}

export async function getGoogleDriveFolderLink(
  channelId?: string,
  threadName?: string,
  signal?: AbortSignal,
): Promise<DriveFolderLinkResult> {
  try {
    const response = await httpClient.get<IApiResponse<DriveFolderLinkResult>>(
      API_ROUTES.driveFolderLink,
      {
        params: channelId ? { channelId, threadName } : undefined,
        signal,
      },
    );
    return response.data.data;
  } catch {
    return { folderPath: 'zalobot', webViewLink: 'https://drive.google.com' };
  }
}

export async function syncThreadMedia(
  threadId: string,
  data?: SyncThreadMediaDto,
  signal?: AbortSignal,
): Promise<SyncThreadMediaResponse> {
  const response = await httpClient.post<IApiResponse<SyncThreadMediaResponse>>(
    API_ROUTES.zcaSyncThreadMedia(threadId),
    data || {},
    { signal },
  );
  return response.data.data;
}

/** Every Drive folder / Photos album the thread's media went to, across Google accounts. */
export async function getThreadStorageLinks(
  threadId: string,
  signal?: AbortSignal,
): Promise<ChannelStorageLinksResponse> {
  const response = await httpClient.get<IApiResponse<ChannelStorageLinksResponse>>(
    API_ROUTES.zcaThreadStorageLinks(threadId),
    { signal },
  );
  return response.data.data;
}

export async function updateThreadStorageLink(
  threadId: string,
  linkId: string,
  data: UpdateChannelStorageLinkDto,
): Promise<ChannelStorageLinksResponse> {
  const response = await httpClient.patch<IApiResponse<ChannelStorageLinksResponse>>(
    API_ROUTES.zcaThreadStorageLink(threadId, linkId),
    data,
  );
  return response.data.data;
}

/** Removes the link from the history only; the Drive folder / Photos album stays on Google. */
export async function deleteThreadStorageLink(
  threadId: string,
  linkId: string,
): Promise<ChannelStorageLinksResponse> {
  const response = await httpClient.delete<IApiResponse<ChannelStorageLinksResponse>>(
    API_ROUTES.zcaThreadStorageLink(threadId, linkId),
  );
  return response.data.data;
}
