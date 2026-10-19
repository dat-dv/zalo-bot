---
trigger: model_decision
description: Query Key Factory pattern, SOLID atomic single-purpose custom hooks, 5-step Optimistic Mutations, and Revalidation Matrix coordination.
metadata:
  agent-artifact:
    id: tanstack-query-rule-03
    type: rule
    explanation: .agents/system-explain/plugins/tanstack-query/rules/03-query-keys-and-mutations.md
    depends_on:
      - .claude/skills/tanstack-query/rules/01-architecture-and-dual-fetching.md
---

# Query Keys, SOLID Atomic Hooks, Mutations, & Revalidation Rules

## 1. SOLID Principles for API Custom Hooks: Atomic Single-Purpose Hooks

Custom React hooks wrapping TanStack Query or async API calls MUST strictly follow the **Single Responsibility Principle (SRP)** and **Interface Segregation Principle (ISP)**:

- **1 Operation = 1 Atomic Hook**: Each custom hook MUST handle exactly ONE discrete operation (one specific Query or one specific Mutation).
- **Prohibition of "God Hooks"**: Grouping multiple queries and mutations into a single monolithic entity hook (e.g., `useUser()` returning `{ userList, userDetail, createUser, updateUser, deleteUser }`) is **STRICTLY FORBIDDEN**.
- **Anti-Pattern Hazards of God Hooks**:
  1. *Unnecessary Re-renders & Stale Data*: Calling `useUser()` in a simple Delete button triggers unwanted query executions, background re-fetching, and cascading component re-renders.
  2. *Violates SRP & ISP*: Components are tightly coupled to state and functions they never consume.
  3. *Uncontrollable Lifecycle & Cache*: Prevents granular `enabled` flags, independent error boundaries, and fine-grained cache invalidation.

### Standard Atomic Hook Naming & Separation Pattern:

```typescript
// features/<feature>/application/hooks/

// 1. Query Hooks (Read / Fetching)
export function useUserListQuery(params?: UserFilterParams, options?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: userQueryKeys.list(params || {}),
    queryFn: ({ signal }) => userRepository.getUsers(params, signal),
    ...options,
  });
}

export function useUserDetailQuery(userId: string, options?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: userQueryKeys.detail(userId),
    queryFn: ({ signal }) => userRepository.getUserById(userId, signal),
    enabled: !!userId,
    ...options,
  });
}

// 2. CRUD Mutation Hooks (Write / Update / Delete)
export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => userRepository.createUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => userRepository.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
    },
  });
}

// 3. Trigger / Imperative Action Mutation Hooks (Health Check / Sync / Tool Execution)
// BẮT BUỘC: Mọi thao tác async API (kể cả trigger action 1 lần) phải bọc useMutation, CẤM tự tạo useState(loading)
export function useAccountHealthCheckMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => accountHttpRepository.checkHealth(undefined, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
    },
  });
}

export function useTriggerSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: string) => campaignHttpRepository.triggerSync(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignQueryKeys.lists() });
    },
  });
}
```

---

## 2. Structured Query Key Factory Pattern

All query keys MUST use structured, feature-scoped tuples following the format `[context, entity, { params }]` instead of inline string arrays.

```typescript
// features/<feature>/presentation/queries/query-keys.ts
export const droneQueryKeys = {
  all: ['fleet', 'drones'] as const,
  lists: () => [...droneQueryKeys.all, 'list'] as const,
  list: (filters: DroneFilterParams) => [...droneQueryKeys.lists(), filters] as const,
  details: () => [...droneQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...droneQueryKeys.details(), id] as const,
};
```

---

## 3. 5-Step Optimistic Mutation Workflow

When latency negatively impacts user experience (e.g. toggling status, reordering items, bookmarking), mutations MUST follow the 5-step lifecycle:

```typescript
export function useUpdateDroneStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { id: string; status: DroneStatus }) =>
      droneRepository.updateStatus(variables.id, variables.status),
    
    // Step 1 & 2 & 3: On Mutate
    onMutate: async (newStatusData) => {
      const queryKey = droneQueryKeys.detail(newStatusData.id);
      
      // 1. Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey });

      // 2. Snapshot previous value
      const previousDrone = queryClient.getQueryData<DroneViewModel>(queryKey);

      // 3. Optimistically update cache
      if (previousDrone) {
        queryClient.setQueryData<DroneViewModel>(queryKey, {
          ...previousDrone,
          status: newStatusData.status,
        });
      }

      return { previousDrone, queryKey };
    },

    // Step 4: On Error -> Rollback snapshot
    onError: (_err, _newStatusData, context) => {
      if (context?.previousDrone) {
        queryClient.setQueryData(context.queryKey, context.previousDrone);
      }
    },

    // Step 5: On Settled -> Invalidate queries
    onSettled: (_data, _error, _variables, context) => {
      if (context?.queryKey) {
        queryClient.invalidateQueries({ queryKey: context.queryKey });
        queryClient.invalidateQueries({ queryKey: droneQueryKeys.lists() });
      }
    },
  });
}
```

---

## 4. Revalidation Coordination Matrix

| Action Type | Target Cache Owner | Synchronization Method |
| :--- | :--- | :--- |
| **BFF Server Action Mutation** | RSC Route Cache & Query Cache | Call `revalidateTag()` / `revalidatePath()` in Server Action AND trigger `queryClient.invalidateQueries()` on Client. |
| **Direct Client Mutation** | TanStack Query Client Cache | Call `queryClient.invalidateQueries({ queryKey })` or `queryClient.setQueryData()`. |
| **Navigation & Filter Change** | URL Search Params + TanStack Query | Push new URL search params; query hook re-runs automatically based on parameterized `queryKey`. |
