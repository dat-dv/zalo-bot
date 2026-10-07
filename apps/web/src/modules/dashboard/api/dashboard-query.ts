'use client';

import { useQuery } from '@tanstack/react-query';
import type { IDashboardData } from '@zalobot/contracts';
import { getDashboard } from './dashboard-api';

export const dashboardQueryKeys = { detail: () => ['dashboard'] as const };

export function useDashboardQuery(options?: { enabled?: boolean }) {
  return useQuery<IDashboardData>({
    queryKey: dashboardQueryKeys.detail(),
    queryFn: ({ signal }) => getDashboard(signal),
    enabled: options?.enabled,
  });
}
