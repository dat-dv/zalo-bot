import {
  API_ROUTES,
  type IApiResponse,
  type ICreateDebtPaymentRequest,
  type IDebtListItem,
  type IDebtPaymentItem,
  type IUpdateDebtRequest,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getDebts(signal?: AbortSignal): Promise<IDebtListItem[]> {
  const response = await httpClient.get<IApiResponse<IDebtListItem[]>>(API_ROUTES.debts, {
    signal,
  });
  return response.data.data;
}

export async function updateDebt(
  id: string,
  data: IUpdateDebtRequest,
  signal?: AbortSignal,
): Promise<IDebtListItem> {
  const response = await httpClient.patch<IApiResponse<IDebtListItem>>(
    `${API_ROUTES.debts}/${id}`,
    data,
    { signal },
  );
  return response.data.data;
}

export async function createDebtPayment(
  data: ICreateDebtPaymentRequest,
  signal?: AbortSignal,
): Promise<IDebtPaymentItem> {
  const response = await httpClient.post<IApiResponse<IDebtPaymentItem>>(
    API_ROUTES.debtPayments,
    data,
    { signal },
  );
  return response.data.data;
}

export async function combineDebts(
  data: import('@zalobot/contracts').ICombineDebtsRequest,
  signal?: AbortSignal,
): Promise<import('@zalobot/contracts').ICombineDebtsResponse> {
  const response = await httpClient.post<
    IApiResponse<import('@zalobot/contracts').ICombineDebtsResponse>
  >(API_ROUTES.debtsCombine, data, { signal });
  return response.data.data;
}

export async function deleteDebtPayment(
  debtId: string,
  paymentId: string,
  signal?: AbortSignal,
): Promise<{ deleted: boolean }> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    `${API_ROUTES.debts}/${debtId}/payments/${paymentId}`,
    { signal },
  );
  return response.data.data;
}
