'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type {
  IAuditLogDetail,
  IAuditLogListQuery,
  IAuditLogListResponse,
} from '@zalobot/contracts';
import { getAuditLog, listAuditLogs } from './audit-api';

export const auditQueryKeys = {
  all: () => ['audit'] as const,
  list: (query: IAuditLogListQuery) => ['audit', 'list', query] as const,
  detail: (id: string) => ['audit', 'detail', id] as const,
};

export const isForbiddenError = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response?.status === 403;

/** The session expired or was signed out: the screen asks to sign in again. */
export const isUnauthorizedError = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response?.status === 401;

/** Admin-only: other users get 403; neither 403 nor 401 is retried. */
export function useAuditLogsQuery(query: IAuditLogListQuery) {
  return useQuery<IAuditLogListResponse>({
    queryKey: auditQueryKeys.list(query),
    queryFn: ({ signal }) => listAuditLogs(query, signal),
    // Keep the current page on screen while the next page or filter loads.
    placeholderData: keepPreviousData,
    retry: (failureCount, error) =>
      !isForbiddenError(error) && !isUnauthorizedError(error) && failureCount < 1,
  });
}

export function useAuditLogQuery(id: string | null) {
  return useQuery<IAuditLogDetail>({
    queryKey: auditQueryKeys.detail(id ?? ''),
    queryFn: ({ signal }) => getAuditLog(id ?? '', signal),
    enabled: Boolean(id),
    // An audit row never changes once written.
    staleTime: Infinity,
  });
}
