import {
  API_ROUTES,
  type IApiResponse,
  type ICreateLlmProviderRequest,
  type ILlmProviderPingResult,
  type ILlmProviderStatus,
  type IReorderLlmProvidersRequest,
  type IUpdateLlmProviderRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getLlmProviders(signal?: AbortSignal): Promise<ILlmProviderStatus[]> {
  const response = await httpClient.get<IApiResponse<ILlmProviderStatus[]>>(
    API_ROUTES.llmProviders,
    { signal },
  );
  return response.data.data;
}

export async function createLlmProvider(
  data: ICreateLlmProviderRequest,
): Promise<ILlmProviderStatus> {
  const response = await httpClient.post<IApiResponse<ILlmProviderStatus>>(
    API_ROUTES.llmProviders,
    data,
  );
  return response.data.data;
}

export async function updateLlmProvider(
  id: string,
  data: IUpdateLlmProviderRequest,
): Promise<ILlmProviderStatus> {
  const response = await httpClient.patch<IApiResponse<ILlmProviderStatus>>(
    API_ROUTES.llmProvider(id),
    data,
  );
  return response.data.data;
}

export async function deleteLlmProvider(id: string): Promise<void> {
  await httpClient.delete(API_ROUTES.llmProvider(id));
}

export async function reorderLlmProviders(
  data: IReorderLlmProvidersRequest,
): Promise<ILlmProviderStatus[]> {
  const response = await httpClient.put<IApiResponse<ILlmProviderStatus[]>>(
    API_ROUTES.llmProvidersOrder,
    data,
  );
  return response.data.data;
}

export async function pingLlmProvider(id: string): Promise<ILlmProviderPingResult> {
  const response = await httpClient.post<IApiResponse<ILlmProviderPingResult>>(
    API_ROUTES.llmProviderPing(id),
  );
  return response.data.data;
}
