import {
  API_ROUTES,
  type IApiResponse,
  type IUpdateWebhookRecipientsRequest,
  type IWebhookRecipient,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getWebhookRecipients(signal?: AbortSignal): Promise<IWebhookRecipient[]> {
  const response = await httpClient.get<IApiResponse<IWebhookRecipient[]>>(
    API_ROUTES.webhookRecipients,
    { signal },
  );
  return response.data.data;
}

export async function updateWebhookRecipients(
  data: IUpdateWebhookRecipientsRequest,
): Promise<IWebhookRecipient[]> {
  const response = await httpClient.put<IApiResponse<IWebhookRecipient[]>>(
    API_ROUTES.webhookRecipients,
    data,
  );
  return response.data.data;
}
