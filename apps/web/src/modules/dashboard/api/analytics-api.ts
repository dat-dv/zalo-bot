import {
  API_ROUTES,
  type IApiResponse,
  type IFinanceAnalyticsResponse,
  type AnalyticsGrain,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export interface GetFinanceAnalyticsParams {
  startAt?: string;
  endAt?: string;
  grain?: AnalyticsGrain;
  signal?: AbortSignal;
}

export async function getFinanceAnalytics(
  params: GetFinanceAnalyticsParams,
): Promise<IFinanceAnalyticsResponse> {
  const searchParams = new URLSearchParams();
  if (params.startAt) searchParams.set('startAt', params.startAt);
  if (params.endAt) searchParams.set('endAt', params.endAt);
  if (params.grain) searchParams.set('grain', params.grain);
  const query = searchParams.toString();
  const url = query ? `${API_ROUTES.financeAnalytics}?${query}` : API_ROUTES.financeAnalytics;
  const response = await httpClient.get<IApiResponse<IFinanceAnalyticsResponse>>(url, {
    signal: params.signal,
  });
  return response.data.data;
}
