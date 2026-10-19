---
name: tanstack-query
description: Master orchestrator skill for TanStack Query v5 in Next.js App Router applications. Covers Dual Data Fetching (BFF/Proxy vs Direct Backend), SSR prefetching with HydrationBoundary, Query Key Factories, 5-step Optimistic Mutations, and Revalidation Matrix.
metadata:
  agent-artifact:
    id: tanstack-query-skill
    type: skill
    explanation: .agents/system-explain/plugins/tanstack-query/skills/README.md
    depends_on:
      - .claude/skills/tanstack-query/rules/01-architecture-and-dual-fetching.md
      - .claude/skills/tanstack-query/rules/02-query-client-and-ssr.md
      - .claude/skills/tanstack-query/rules/03-query-keys-and-mutations.md
      - .claude/skills/tanstack-query/rules/04-quality-gates.md
---

> **zalo-bot adaptation** (vendored from Base Agents plugin `tanstack-query`; project conventions override generic defaults below)
>
> - Only the **Direct Client-to-Backend** branch applies (no SSR prefetch / HydrationBoundary in a static export).
> - Query keys + fetchers live in `apps/web/src/modules/<feature>/api/<feature>-query.ts` / `<feature>-api.ts`.

# Master TanStack Query v5 Orchestration Guide

Use this skill when designing, implementing, or refactoring server state management with TanStack Query v5 in React 19 / Next.js App Router applications.

---

## 1. Step-by-Step Implementation Pipeline

```text
Step 1: Determine Communication Flow (BFF / Proxy vs Direct Backend)
Step 2: Setup / Verify QueryClientProvider & getQueryClient Helper
Step 3: Define Feature Query Key Factory
Step 4: Implement Repository with AbortSignal Support
Step 5: Create Query Hook with DTO-to-ViewModel Transformation
Step 6: (Optional) Setup SSR Prefetching with <HydrationBoundary>
Step 7: Implement Mutations (with 5-step Optimistic Update if required)
Step 8: Verify Types, Caching, and Error States
```

---

## 2. Standard Boilerplate Recipes

### Recipe A: Query Provider Setup (`components/providers/query-provider.tsx`)
```tsx
'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryDevtools initialIsOpen={false} />
      {children}
    </QueryClientProvider>
  );
}
```

### Recipe B: Custom Query Hook with AbortSignal & Selector
```typescript
import { useQuery } from '@tanstack/react-query';
import { droneQueryKeys } from './query-keys';
import { droneRepository } from '../../infrastructure/drone-repository';
import { DroneFilterParams, DroneViewModel } from '../../domain/drone';

export function useDronesQuery(filters: DroneFilterParams) {
  return useQuery({
    queryKey: droneQueryKeys.list(filters),
    queryFn: ({ signal }) => droneRepository.getDrones(filters, signal),
    select: (data): DroneViewModel[] => data.map(mapDroneDtoToViewModel),
    staleTime: 60 * 1000,
  });
}
```

### Recipe C: SSR Prefetching in Route Page (`app/drones/page.tsx`)
```tsx
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/get-query-client';
import { droneQueryKeys } from '@/modules/fleet/presentation/queries/query-keys';
import { droneRepository } from '@/modules/fleet/infrastructure/drone-repository';
import { DroneListClient } from '@/modules/fleet/presentation/components/drone-list-client';

export default async function DronesPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: droneQueryKeys.list({ status: 'active' }),
    queryFn: () => droneRepository.getDrones({ status: 'active' }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DroneListClient />
    </HydrationBoundary>
  );
}
```

### Recipe D: SOLID Atomic Mutation Hook (`useDeleteDroneMutation.ts`)
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { droneQueryKeys } from './query-keys';
import { droneRepository } from '../../infrastructure/drone-repository';

export function useDeleteDroneMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (droneId: string) => droneRepository.deleteDrone(droneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: droneQueryKeys.lists() });
    },
  });
}
```

### Recipe E: Trigger / Action Mutation Hook (`useAccountHealthCheckMutation.ts`)
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { accountQueryKeys } from './query-keys';
import { accountHttpRepository } from '../../infrastructure/account-http-repository';

/**
 * Zero-Manual-Async-State Standard:
 * CẤM tự tạo useState(loading) để gọi trực tiếp HttpRepository.
 * 100% async actions (health check, trigger sync, run automation) phải dùng useMutation.
 */
export function useAccountHealthCheckMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => accountHttpRepository.checkHealth(undefined, accountId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
    },
  });
}
```

