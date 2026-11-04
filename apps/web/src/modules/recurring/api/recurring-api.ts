import {
  API_ROUTES,
  type IApiResponse,
  type ICreateRecurringRequest,
  type IRecordOccurrenceRequest,
  type IRecurringListResponse,
  type IRecurringTransactionItem,
  type IUpdateRecurringRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getRecurring(signal?: AbortSignal): Promise<IRecurringListResponse> {
  const response = await httpClient.get<IApiResponse<IRecurringListResponse>>(
    API_ROUTES.recurring,
    { signal },
  );
  return response.data.data;
}

export async function createRecurring(
  data: ICreateRecurringRequest,
): Promise<IRecurringTransactionItem> {
  const response = await httpClient.post<IApiResponse<IRecurringTransactionItem>>(
    API_ROUTES.recurring,
    data,
  );
  return response.data.data;
}

export async function updateRecurring(
  id: string,
  data: IUpdateRecurringRequest,
): Promise<IRecurringTransactionItem> {
  const response = await httpClient.patch<IApiResponse<IRecurringTransactionItem>>(
    API_ROUTES.recurringDetail(id),
    data,
  );
  return response.data.data;
}

export async function deleteRecurring(id: string): Promise<void> {
  await httpClient.delete(API_ROUTES.recurringDetail(id));
}

export async function recordOccurrence(id: string, data: IRecordOccurrenceRequest): Promise<void> {
  await httpClient.post(API_ROUTES.recurringOccurrenceRecord(id), data);
}

export async function skipOccurrence(id: string): Promise<void> {
  await httpClient.post(API_ROUTES.recurringOccurrenceSkip(id));
}
