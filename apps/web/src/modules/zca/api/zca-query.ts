'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getZcaStatus,
  loginZcaQr,
  getZcaThreads,
  getZcaListenedThreads,
  setZcaListenedThreads,
  toggleZcaListenedThread,
  getZcaThreadConfigs,
  getZcaThreadConfig,
  updateZcaThreadConfig,
  type ZcaStatus,
  type ZcaThread,
} from './zca-api';
import type { ThreadBotConfig, UpdateThreadBotConfigDto } from '@zalobot/contracts';

export const zcaQueryKeys = {
  all: () => ['zca'] as const,
  status: () => ['zca', 'status'] as const,
  threads: () => ['zca', 'threads'] as const,
  listened: () => ['zca', 'listened'] as const,
  configs: () => ['zca', 'configs'] as const,
  config: (threadId: string) => ['zca', 'config', threadId] as const,
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
    queryFn: ({ signal }) => getZcaThreads(undefined, signal),
    staleTime: 60_000,
  });
}

export function useRefreshZcaThreadsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => getZcaThreads({ refresh: true }),
    onSuccess: (freshThreads) => {
      queryClient.setQueryData(zcaQueryKeys.threads(), freshThreads);
    },
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
    mutationFn: (variables?: { forceNew?: boolean }) => loginZcaQr(variables),
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

export function useZcaThreadConfigsQuery() {
  return useQuery<ThreadBotConfig[]>({
    queryKey: zcaQueryKeys.configs(),
    queryFn: ({ signal }) => getZcaThreadConfigs(signal),
  });
}

export function useZcaThreadConfigQuery(threadId: string | null | undefined) {
  return useQuery<ThreadBotConfig>({
    queryKey: threadId ? zcaQueryKeys.config(threadId) : ['zca', 'config', 'null'],
    queryFn: ({ signal }) => getZcaThreadConfig(threadId!, signal),
    enabled: Boolean(threadId),
  });
}

export function useUpdateZcaThreadConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, data }: { threadId: string; data: UpdateThreadBotConfigDto }) =>
      updateZcaThreadConfig(threadId, data),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: zcaQueryKeys.all() });
      void queryClient.invalidateQueries({ queryKey: zcaQueryKeys.config(variables.threadId) });
    },
  });
}
