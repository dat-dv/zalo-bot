import {
  API_ROUTES,
  type IAllocateTransactionRequest,
  type IAllocateTransactionResponse,
  type IApiResponse,
  type ICandidateDebtItem,
  type IDebtAllocationItem,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function getCandidateDebts(
  transactionId: string,
  signal?: AbortSignal,
): Promise<ICandidateDebtItem[]> {
  const response = await httpClient.get<IApiResponse<ICandidateDebtItem[]>>(
    API_ROUTES.transactionCandidateDebts(transactionId),
    { signal },
  );
  return response.data.data;
}

export async function getTransactionAllocations(
  transactionId: string,
  signal?: AbortSignal,
): Promise<IDebtAllocationItem[]> {
  const response = await httpClient.get<IApiResponse<IDebtAllocationItem[]>>(
    API_ROUTES.transactionAllocations(transactionId),
    { signal },
  );
  return response.data.data;
}

export async function allocateTransaction(
  transactionId: string,
  data: IAllocateTransactionRequest,
  signal?: AbortSignal,
): Promise<IAllocateTransactionResponse> {
  const response = await httpClient.post<IApiResponse<IAllocateTransactionResponse>>(
    API_ROUTES.transactionAllocations(transactionId),
    data,
    { signal },
  );
  return response.data.data;
}

export async function deleteDebtAllocation(
  transactionId: string,
  allocationId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const response = await httpClient.delete<IApiResponse<{ deleted: boolean }>>(
    API_ROUTES.transactionAllocationDetail(transactionId, allocationId),
    { signal },
  );
  return response.data.data.deleted;
}
