import {
  API_ROUTES,
  type IApiResponse,
  type IExpenseListItem,
  type IUpdateExpenseRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getExpenses(signal?: AbortSignal): Promise<IExpenseListItem[]> {
  const response = await httpClient.get<IApiResponse<IExpenseListItem[]>>(API_ROUTES.expenses, {
    signal,
  });
  return response.data.data;
}

export async function updateExpense(
  id: string,
  data: IUpdateExpenseRequest,
  signal?: AbortSignal,
): Promise<IExpenseListItem> {
  const response = await httpClient.patch<IApiResponse<IExpenseListItem>>(
    `${API_ROUTES.transactions}/${id}`,
    data,
    { signal },
  );
  return response.data.data;
}

export async function deleteExpense(id: string, signal?: AbortSignal): Promise<boolean> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    `${API_ROUTES.transactions}/${id}`,
    { signal },
  );
  return response.data.data.deleted;
}
