'use client';

import { useQuery } from '@tanstack/react-query';
import type { IFinanceAnalyticsResponse, AnalyticsGrain } from '@zalobot/contracts';
import { getFinanceAnalytics } from './analytics-api';

export interface AnalyticsQueryParams {
  startAt?: string;
  endAt?: string;
  grain?: AnalyticsGrain;
}

export const analyticsQueryKeys = {
  all: () => ['finance-analytics'] as const,
  report: (params: AnalyticsQueryParams) =>
    [...analyticsQueryKeys.all(), params.grain, params.startAt, params.endAt] as const,
};

export function useFinanceAnalyticsQuery(params: AnalyticsQueryParams) {
  return useQuery<IFinanceAnalyticsResponse>({
    queryKey: analyticsQueryKeys.report(params),
    queryFn: ({ signal }) => getFinanceAnalytics({ ...params, signal }),
    enabled: !!(params.startAt && params.endAt && params.grain !== 'all') || params.grain === 'all',
    staleTime: 60_000,
  });
}
