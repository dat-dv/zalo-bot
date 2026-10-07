import { API_ROUTES, type IApiResponse, type IDashboardData } from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getDashboard(signal?: AbortSignal): Promise<IDashboardData> {
  const response = await httpClient.get<IApiResponse<IDashboardData>>(API_ROUTES.dashboard, {
    signal,
  });
  return response.data.data;
}
