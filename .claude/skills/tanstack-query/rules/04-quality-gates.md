---
trigger: model_decision
description: Quality gates, type safety rules, AbortSignal integration, and anti-pattern enforcement for TanStack Query.
metadata:
  agent-artifact:
    id: tanstack-query-rule-04
    type: rule
    explanation: .agents/system-explain/plugins/tanstack-query/rules/04-quality-gates.md
    depends_on:
      - .claude/skills/tanstack-query/rules/01-architecture-and-dual-fetching.md
---

# TanStack Query Quality Gates & Anti-Patterns

## 1. Quality Gates Checklist

All TanStack Query implementations MUST pass the following quality gates:

1. **Type Safety Gate**:
   - Query hooks MUST specify explicit types for both QueryFn return data and transformed select data: `useQuery<DroneDto, DomainError, DroneViewModel>`.
   - Never use `any` or loose untyped return values.
2. **AbortSignal Gate**:
   - Query functions MUST forward `{ signal }` from TanStack Query `QueryFunctionContext` to repository methods and HTTP clients to support automatic request cancellation.
3. **Query Key Factory Gate**:
   - Inline string literals as query keys (e.g. `['drones']`) are strictly forbidden. All keys MUST be declared in feature Query Key Factories.
4. **SOLID Atomic Hook Gate**:
   - Custom API hooks MUST follow Single Responsibility (SRP) and Interface Segregation (ISP): 1 discrete query/mutation per hook.
   - Monolithic "God Hooks" bundling multiple queries and mutations together (e.g. `useUser()`) are strictly forbidden.
5. **Zero-Manual-Async-State Gate (Strict Mutation & Query Encapsulation)**:
   - 100% of asynchronous API interactions, actions, and mutations on the React Client MUST be encapsulated inside TanStack Query hooks (`useQuery` for reads, `useMutation` for writes and imperative actions).
   - Manually managing async state via `const [loading, setLoading] = useState(...)` or `const [error, setError] = useState(...)` wrapping direct Repository calls is **STRICTLY FORBIDDEN**.
   - This applies to ALL client-side async action types: CRUD operations, connection/health checks (`checkHealth`), browser automation triggers (`loginProfile`), sync/crawler actions (`triggerSync`), status toggles, and batch operations.

---

## 2. Anti-Patterns & Prohibitions

- **DO NOT** manually create `useState(loading)` or `useState(error)` to invoke HttpRepository methods directly in React Client components or custom hooks. Every asynchronous client action MUST be modeled as a TanStack Query `useMutation` hook (or `useQuery` for data fetching) to guarantee unified `isPending`, `error`, retry, rollback, and lifecycle callbacks (`onSuccess`, `onError`, `onSettled`).
- **DO NOT** bundle queries and mutations into monolithic entity hooks (e.g. `useUser()` returning `{ userList, userDetail, createUser, deleteUser }`). Always decompose into discrete atomic hooks (`useUserListQuery`, `useUserDetailQuery`, `useCreateUserMutation`, `useDeleteUserMutation`).
- **DO NOT** duplicate Server State into Zustand or `useState`. TanStack Query is the single source of truth for remote state.
- **DO NOT** trigger data fetching inside `useEffect` when `useQuery` or RSC fetching can achieve the same goal.
- **DO NOT** use `isSuccess` or boolean flags inside `useEffect` to trigger secondary mutations; use mutation callbacks (`onSuccess`, `onError`) or direct handler callbacks instead.
- **DO NOT** instantiate `new QueryClient()` inside component render bodies without `useState` or `getQueryClient()` helper.
