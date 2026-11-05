import {
  API_ROUTES,
  type IApiResponse,
  type ILlmProviderPingResult,
  type ILlmProviderStatus,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getLlmProviders(signal?: AbortSignal): Promise<ILlmProviderStatus[]> {
  const response = await httpClient.get<IApiResponse<ILlmProviderStatus[]>>(
    API_ROUTES.llmProviders,
    { signal },
  );
  return response.data.data;
}

export async function pingLlmProvider(name: string): Promise<ILlmProviderPingResult> {
  const response = await httpClient.post<IApiResponse<ILlmProviderPingResult>>(
    API_ROUTES.llmProviderPing(name),
  );
  return response.data.data;
}
