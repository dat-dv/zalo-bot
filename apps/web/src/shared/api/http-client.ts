import axios, { type InternalAxiosRequestConfig } from 'axios';
import {
  API_ROUTES,
  type IApiResponse,
  type IDashboardAccessTokenResponse,
} from '@zalobot/contracts';
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from '@/modules/auth/client/auth-storage';

function normalizeApiOrigin(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
}

export function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Khi đang truy cập qua Cloudflare Tunnel, Ngrok hoặc Nginx Gateway local:
    // FE và BE cùng được route qua Gateway trên cùng domain, nên gọi relative URL (/api/...)
    const isGatewayOrTunnel =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('trycloudflare.com') ||
      hostname.includes('ngrok') ||
      hostname.includes('loca.lt');

    if (isGatewayOrTunnel) {
      return '';
    }
  }

  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  return configured ? normalizeApiOrigin(configured) : '';
}

const apiUrl = resolveApiBaseUrl();
export const httpClient = axios.create({ baseURL: apiUrl, withCredentials: true });
let refreshRequest: Promise<string> | undefined;

httpClient.interceptors.request.use((config) => {
  config.baseURL = resolveApiBaseUrl();
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

httpClient.interceptors.response.use(undefined, async (error: unknown) => {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  if (!axios.isAxiosError(error) || error.response?.status !== 401) {
    return Promise.reject(normalizedError);
  }
  const request = error.config as
    (InternalAxiosRequestConfig & { _dashboardRetried?: boolean }) | undefined;
  if (!request || request._dashboardRetried || request.url === API_ROUTES.dashboardRefresh)
    return Promise.reject(error);
  if (!getAccessToken()) return Promise.reject(error);
  request._dashboardRetried = true;
  try {
    const activeBase = resolveApiBaseUrl();
    refreshRequest ??= axios
      .post<IApiResponse<IDashboardAccessTokenResponse>>(
        `${activeBase}${API_ROUTES.dashboardRefresh}`,
        undefined,
        { withCredentials: true },
      )
      .then((response) => response.data.data.accessToken)
      .finally(() => {
        refreshRequest = undefined;
      });
    const nextToken = await refreshRequest;
    setAccessToken(nextToken);
    request.headers.Authorization = `Bearer ${nextToken}`;
    return httpClient(request);
  } catch (refreshError) {
    clearAccessToken();
    const normalizedRefreshError =
      refreshError instanceof Error ? refreshError : new Error(String(refreshError));
    return Promise.reject(normalizedRefreshError);
  }
});
