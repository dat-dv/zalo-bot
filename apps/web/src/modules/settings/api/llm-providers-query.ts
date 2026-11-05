'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { ILlmProviderPingResult, ILlmProviderStatus } from '@zalobot/contracts';
import { getLlmProviders, pingLlmProvider } from './llm-providers-api';

export const llmProvidersQueryKeys = {
  all: ['llm-providers'] as const,
};

export function useLlmProvidersQuery() {
  return useQuery<ILlmProviderStatus[]>({
    queryKey: llmProvidersQueryKeys.all,
    queryFn: ({ signal }) => getLlmProviders(signal),
  });
}

/** One per row, so pinging a slow provider does not lock the others. Changes no server state. */
export function usePingLlmProviderMutation() {
  return useMutation<ILlmProviderPingResult, Error, string>({
    mutationFn: (name) => pingLlmProvider(name),
  });
}
