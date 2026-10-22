import {
  API_ROUTES,
  type IApiResponse,
  type IAuditLogDetail,
  type IAuditLogListQuery,
  type IAuditLogListResponse,
} from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function listAuditLogs(
  query: IAuditLogListQuery,
  signal?: AbortSignal,
): Promise<IAuditLogListResponse> {
  const response = await httpClient.get<IApiResponse<IAuditLogListResponse>>(
    API_ROUTES.auditLogs,
    // Lists go out as repeated keys (`tables=a&tables=b`), which the API reads as arrays.
    { params: query, paramsSerializer: { indexes: null }, signal },
  );
  return response.data.data;
}

export async function getAuditLog(id: string, signal?: AbortSignal): Promise<IAuditLogDetail> {
  const response = await httpClient.get<IApiResponse<IAuditLogDetail>>(API_ROUTES.auditLog(id), {
    signal,
  });
  return response.data.data;
}
