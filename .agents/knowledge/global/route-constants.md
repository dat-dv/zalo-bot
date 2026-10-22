---
metadata:
  agent-artifact:
    id: global-route-constants-knowledge
    type: documentation
    depends_on:
      - packages/contracts/src/index.ts
      - apps/web/src/shared/api/http-client.ts
      - apps/web/src/shared/ui/app-navigation.tsx
      - apps/api/src/google/google-auth.service.ts
      - .claude/rules/strict-routes-and-paths.md
---

# Global Route & Path Constants Architecture

## Purpose

Single source of truth for navigation paths and API endpoints shared by `apps/web` and `apps/api`, preventing dead links and contract drift.

## Registries (`packages/contracts/src/index.ts`, `@zalobot/contracts`)

- **`API_ROUTES`** (`as const`): flat camelCase keys with the full `/api` prefix, e.g. `transactions: '/api/transactions'`, `debtsCombine`, `usersSyncZca`, `zcaThreadConfigs`, `googleAuthCallback: '/api/oauth2callback'`, `swaggerDocs: '/api/docs'`. Dynamic segments are typed builders: `usersGrantAccess(id)`, `usersMergePreview(id)`, `usersMerge(id)`, `transactionCandidateDebts(id)`, `transactionAllocations(id)`, `transactionAllocationDetail(txId, allocId)`, `zcaThreadConfig(threadId)`, `zcaSyncThreadMedia(threadId)`.
- **`APP_ROUTES`** (`as const`): `home`, `dashboard`, `about`, `privacy`, `terms`, `transactions`, `expenses`, `income`, `debts`, `analytics`, `analyticsSpending`, `analyticsCashflow`, `analyticsDebts`, `calendar`, `tasks`, `reminders`, `contacts`, `places`, `zca`, `zcaThreadPage` (`/zca/thread`), `zcaThread(threadId)` (→ `/zca/thread?id=<encoded>`), `settings`. The `analytics*` sub-routes have no page under `apps/web/app/`. Detail pages use a query param, never a dynamic segment: the static export cannot pre-render `/zca/[id]`, so the page is static and reads `?id=` via `useSearchParams` inside `<Suspense>`.
- There is no `PROXY_ROUTES`, no `src/shared/constants/`, and no `/api/v1` versioning. The web is a static export with no BFF: `httpClient` calls the Nest API directly (`NEXT_PUBLIC_API_URL` origin or same-origin relative URL).

## Invariants

1. No hardcoded route or endpoint literals in application code; import `API_ROUTES` / `APP_ROUTES`.
2. Parameterized endpoints should be typed builder functions in the contract. Existing web code also composes `${API_ROUTES.debts}/${id}` style suffixes; new endpoints should prefer builders.
3. Consumers: `<Link href={APP_ROUTES.home}>`, `router.replace(...)`, ``redirect(`${APP_ROUTES.transactions}?type=expense`)``, `httpClient.get(API_ROUTES.debts)`, `httpClient.post(API_ROUTES.transactionAllocations(id), ...)`, backend `API_ROUTES.googleAuthCallback` for the OAuth redirect URI.
4. NestJS controller decorators (`@Get('transactions')`) define server paths relative to the global `/api` prefix; any change must update `API_ROUTES` in the same change.

## Known Literal Leftovers

`auth-storage.ts` redirects to a literal `/api/access?token=`; `app/sitemap.ts` lists `/about`, `/privacy`, `/terms` literally.
