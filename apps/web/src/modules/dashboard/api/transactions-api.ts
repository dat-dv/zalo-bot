import {
  API_ROUTES,
  type IApiResponse,
  type ICreateTransactionRequest,
  type ITransactionItem,
  type ITransactionListQuery,
  type ITransactionListResponse,
  type IUpdateTransactionRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function listTransactions(
  query: ITransactionListQuery,
  signal?: AbortSignal,
): Promise<ITransactionListResponse> {
  const response = await httpClient.get<IApiResponse<ITransactionListResponse>>(
    API_ROUTES.transactions,
    { params: query, signal },
  );
  return response.data.data;
}

export async function createTransaction(
  data: ICreateTransactionRequest,
  signal?: AbortSignal,
): Promise<ITransactionItem> {
  const response = await httpClient.post<IApiResponse<ITransactionItem>>(
    API_ROUTES.transactions,
    data,
    { signal },
  );
  return response.data.data;
}

export async function updateTransaction(
  id: string,
  data: IUpdateTransactionRequest,
  signal?: AbortSignal,
): Promise<ITransactionItem> {
  const response = await httpClient.patch<IApiResponse<ITransactionItem>>(
    `${API_ROUTES.transactions}/${id}`,
    data,
    { signal },
  );
  return response.data.data;
}

export async function deleteTransaction(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    `${API_ROUTES.transactions}/${id}`,
    { signal },
  );
  return response.data.data.deleted;
}
