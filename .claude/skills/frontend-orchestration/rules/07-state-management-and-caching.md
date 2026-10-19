---
trigger: model_decision
description: "4-tier state management hierarchy (State Triangle: URL state, Server query cache, Local state, Global Zustand UI state), and TanStack Query orchestration."
metadata:
  agent-artifact:
    id: frontend-orchestration-rule-07
    type: rule
    explanation: .agents/system-explain/plugins/frontend-orchestration/rules/07-state-management-and-caching.md
    depends_on:
      - .claude/skills/frontend-orchestration/rules/01-architecture-and-ddd.md
---

# State Management, State Triangle, & Server State Orchestration Rules

## 1. 4-Tier State Management Hierarchy & State Triangle

Application state MUST be assigned strictly to the appropriate tier:

1. **Tier 1: URL State (`useSearchParams`, `nuqs`)**: Filter parameters, search queries, pagination numbers, and active tabs that must survive browser refresh and be shareable via URLs.
2. **Tier 2: Server Query & Data Cache (`TanStack Query` / RSC)**: 100% of asynchronous server data, entity lists, details, pagination caches, and all client-side async actions/mutations (CRUD, trigger actions, health checks, automation triggers).
3. **Tier 3: Local Component State (`useState`, `useReducer`)**: Transient, purely synchronous UI state owned by a single component (e.g. `isOpen`, `isHovered`, active tab index, accordion toggle). **STRICTLY PROHIBITED** from managing asynchronous API loading or error states (`useState(loading/error)`).
4. **Tier 4: Global Client UI State (`Zustand` in `src/shared/store/`)**: Strictly app-wide client-only UI state (e.g. sidebar collapse state, theme toggle, multi-step wizard form draft, floating media player).

```text
       ▲  Tier 1: URL State (Filters, Search, Pagination via nuqs)
      / \
     /   \  Tier 2: Server State (TanStack Query Cache / HydrationBoundary)
    /     \
   /       \  Tier 3: Local State (useState / useReducer)
  /─────────\
  ▼ Tier 4: Global UI State (Zustand - Pure Client UI Only)
```

## 2. Server State Orchestration & TanStack Query Delegation

When managing async server state or mutations, the Frontend Orchestrator delegates to `.claude/skills/tanstack-query/`:

- **Mode 1 (Next.js App Router / BFF)**:
  - SSR Prefetch in Level 5 Route Pages using request-scoped `getQueryClient()`.
  - Hydrate state to client components via `<HydrationBoundary state={dehydrate(queryClient)}>`.
  - In Level 4 Views, use `useQuery` with structured Query Key Factories (`<feature>Keys`).
- **Mode 2 (React SPA / Vite)**:
  - Use browser-singleton `QueryClientProvider`.
  - Execute direct queries with `useQuery` / `useMutation` wrapping `directHttpClient`.
- **Mutations & Optimistic Updates**: Execute 5-step optimistic updates and revalidation matrix as governed by `tanstack-query` rules.

## 3. Zustand Scope & Next.js SSR Dehydration Guard

To prevent memory leaks and **cross-request state pollution (User A's data leaking to User B)** in Next.js Server Runtimes:

- **Strict Client-Only Scoping**: Never store server API entity arrays (`products`, `orders`) in Zustand.
- **Server Data Hydration Rule**:
  - **Primary Pattern (Recommended)**: Use TanStack Query `<HydrationBoundary>` for all server state hydration.
  - **Zustand Store Provider Pattern (When Initial Server Props are Needed)**: If a Zustand store must be initialized with data from a Server Component (e.g. initial cart count or theme preference), NEVER use a global module singleton (`export const useStore = create(...)`). You MUST wrap the store in a **React Context + `useRef` Store Factory (`createStore`)**:

```typescript
// src/shared/providers/app-store-provider.tsx (Pattern for SSR-safe Zustand initialization)
'use client';

import { createContext, useRef, useContext, type ReactNode } from 'react';
import { createStore, useStore } from 'zustand';

interface AppStoreProps {
  initialTheme?: 'light' | 'dark';
}

interface AppState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const createAppStore = (initProps: AppStoreProps) => {
  return createStore<AppState>((set) => ({
    theme: initProps.initialTheme || 'light',
    toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  }));
};

type AppStoreApi = ReturnType<typeof createAppStore>;
const AppStoreContext = createContext<AppStoreApi | null>(null);

export function AppStoreProvider({ children, initialTheme }: AppStoreProps & { children: ReactNode }) {
  const storeRef = useRef<AppStoreApi | null>(null);
  if (!storeRef.current) {
    storeRef.current = createAppStore({ initialTheme });
  }
  return <AppStoreContext.Provider value={storeRef.current}>{children}</AppStoreContext.Provider>;
}

export function useAppStore<T>(selector: (state: AppState) => T): T {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider');
  return useStore(ctx, selector);
}
```

## 4. Anti-Patterns & Prohibitions

- **DO NOT** use `useState(loading)` or `useState(error)` to manage asynchronous API execution states in Client components/hooks. All async server interactions MUST be delegated to TanStack Query (`useQuery` / `useMutation`).
- **DO NOT** create monolithic "God Hooks" bundling multiple queries and mutations together (e.g. `useUser()`); always construct atomic single-purpose custom hooks per SOLID principles (SRP & ISP).
- **DO NOT** dispatch `setProducts(data)` into Zustand after fetching. Server state belongs exclusively to TanStack Query.
- **DO NOT** lift transient local component state (e.g. dropdown open state) into global Zustand stores.
- **DO NOT** use `useEffect` for data fetching; use Server Components or TanStack Query.
