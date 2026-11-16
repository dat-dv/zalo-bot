'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ICreateLlmProviderRequest,
  ILlmProviderPingResult,
  ILlmProviderStatus,
  IUpdateLlmProviderRequest,
} from '@zalobot/contracts';
import {
  createLlmProvider,
  deleteLlmProvider,
  getLlmProviders,
  pingLlmProvider,
  reorderLlmProviders,
  updateLlmProvider,
} from './llm-providers-api';

export const llmProvidersQueryKeys = {
  all: ['llm-providers'] as const,
};

export function useLlmProvidersQuery() {
  return useQuery<ILlmProviderStatus[]>({
    queryKey: llmProvidersQueryKeys.all,
    queryFn: ({ signal }) => getLlmProviders(signal),
  });
}

/** Roles (primary/fallback) depend on the whole list, so every write refetches it. */
function useInvalidateLlmProviders() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: llmProvidersQueryKeys.all });
}

export function useCreateLlmProviderMutation() {
  const invalidate = useInvalidateLlmProviders();
  return useMutation<ILlmProviderStatus, Error, ICreateLlmProviderRequest>({
    mutationFn: (data) => createLlmProvider(data),
    onSettled: invalidate,
  });
}

export function useUpdateLlmProviderMutation() {
  const invalidate = useInvalidateLlmProviders();
  return useMutation<ILlmProviderStatus, Error, { id: string; data: IUpdateLlmProviderRequest }>({
    mutationFn: ({ id, data }) => updateLlmProvider(id, data),
    onSettled: invalidate,
  });
}

export function useDeleteLlmProviderMutation() {
  const invalidate = useInvalidateLlmProviders();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteLlmProvider(id),
    onSettled: invalidate,
  });
}

/** Optimistic: the rows move at once; a refused order snaps back on the refetch. */
export function useReorderLlmProvidersMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    ILlmProviderStatus[],
    Error,
    string[],
    { previous: ILlmProviderStatus[] | undefined }
  >({
    mutationFn: (ids) => reorderLlmProviders({ ids }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: llmProvidersQueryKeys.all });
      const previous = queryClient.getQueryData<ILlmProviderStatus[]>(llmProvidersQueryKeys.all);
      if (previous) {
        const byId = new Map(previous.map((provider) => [provider.id, provider]));
        const moved = ids.flatMap((id) => {
          const provider = byId.get(id);
          return provider ? [provider] : [];
        });
        queryClient.setQueryData(llmProvidersQueryKeys.all, moved);
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(llmProvidersQueryKeys.all, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: llmProvidersQueryKeys.all }),
  });
}

/** One per row, so pinging a slow provider does not lock the others. Changes no server state. */
export function usePingLlmProviderMutation() {
  return useMutation<ILlmProviderPingResult, Error, string>({
    mutationFn: (id) => pingLlmProvider(id),
  });
}
