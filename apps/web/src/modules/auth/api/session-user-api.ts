import { API_ROUTES, type IApiResponse, type IDashboardSessionUser } from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getSessionUser(signal?: AbortSignal): Promise<IDashboardSessionUser> {
  const response = await httpClient.get<IApiResponse<IDashboardSessionUser>>(
    API_ROUTES.sessionMe,
    { signal },
  );
  return response.data.data;
}
