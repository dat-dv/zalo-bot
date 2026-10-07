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

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
if (!configuredApiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL must be configured before the dashboard can call the API.');
}
const apiUrl = normalizeApiOrigin(configuredApiUrl);
export const httpClient = axios.create({ baseURL: apiUrl, withCredentials: true });
let refreshRequest: Promise<string> | undefined;

httpClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

httpClient.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) return Promise.reject(error);
  const request = error.config as
    (InternalAxiosRequestConfig & { _dashboardRetried?: boolean }) | undefined;
  if (!request || request._dashboardRetried || request.url === API_ROUTES.dashboardRefresh)
    return Promise.reject(error);
  request._dashboardRetried = true;
  try {
    refreshRequest ??= axios
      .post<IApiResponse<IDashboardAccessTokenResponse>>(
        `${apiUrl}${API_ROUTES.dashboardRefresh}`,
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
    return Promise.reject(refreshError);
  }
});
