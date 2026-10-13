'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getZcaStatus,
  loginZcaQr,
  getZcaThreads,
  getZcaListenedThreads,
  setZcaListenedThreads,
  toggleZcaListenedThread,
  type ZcaStatus,
  type ZcaThread,
} from './zca-api';

export const zcaQueryKeys = {
  all: () => ['zca'] as const,
  status: () => ['zca', 'status'] as const,
  threads: () => ['zca', 'threads'] as const,
  listened: () => ['zca', 'listened'] as const,
};

export function useZcaStatusQuery(options?: { refetchInterval?: number | false }) {
  return useQuery<ZcaStatus>({
    queryKey: zcaQueryKeys.status(),
    queryFn: ({ signal }) => getZcaStatus(signal),
    refetchInterval: options?.refetchInterval,
  });
}

export function useZcaThreadsQuery() {
  return useQuery<ZcaThread[]>({
    queryKey: zcaQueryKeys.threads(),
    queryFn: ({ signal }) => getZcaThreads(signal),
  });
}

export function useZcaListenedThreadsQuery() {
  return useQuery<string[]>({
    queryKey: zcaQueryKeys.listened(),
    queryFn: ({ signal }) => getZcaListenedThreads(signal),
  });
}

export function useLoginZcaQrMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => loginZcaQr(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: zcaQueryKeys.status() });
    },
  });
}

export function useSetZcaListenedThreadsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadIds: string[]) => setZcaListenedThreads(threadIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: zcaQueryKeys.all() });
    },
  });
}

export function useToggleZcaListenedThreadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => toggleZcaListenedThread(threadId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: zcaQueryKeys.all() });
    },
  });
}
