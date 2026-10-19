---
trigger: model_decision
description: QueryClient configuration, SSR prefetching with HydrationBoundary in Next.js App Router, and memory leak prevention.
metadata:
  agent-artifact:
    id: tanstack-query-rule-02
    type: rule
    explanation: .agents/system-explain/plugins/tanstack-query/rules/02-query-client-and-ssr.md
    depends_on:
      - .claude/skills/tanstack-query/rules/01-architecture-and-dual-fetching.md
---

# QueryClient Configuration & SSR Hydration Rules

## 1. QueryClient Lifecycle & Scoping

To prevent cross-request memory leaks and data leakage across distinct user sessions in Next.js:

- **Browser Runtime**: MUST instantiate a single browser-scoped `QueryClient` singleton inside `useState` or module cache in Client Components.
- **Server Runtime (RSC / Server Actions)**: MUST create a request-scoped `QueryClient` per incoming request via a `getQueryClient()` helper. DO NOT store server `QueryClient` instances in global variables.

```typescript
// lib/get-query-client.ts
import { QueryClient, defaultShouldDehydrateQuery, isServer } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds fresh window
        gcTime: 5 * 60 * 1000, // 5 minutes garbage collection window
        refetchOnWindowFocus: false,
        retry: 1,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
```

---

## 2. SSR Prefetching & Hydration Boundary Pattern

For initial route loading requiring instant client rendering without loading spinners:

1. **Server Component (`page.tsx`)**:
   - Obtain request-scoped client via `const queryClient = getQueryClient()`.
   - Await prefetch using `await queryClient.prefetchQuery({...})`.
   - Dehydrate and pass state into `<HydrationBoundary state={dehydrate(queryClient)}>`.

2. **Client Component (`FeatureClientView.tsx`)**:
   - Call `useQuery({...})` with the EXACT same `queryKey` and options factory.
   - Component renders instantly with dehydrated server data with zero hydration mismatches.
