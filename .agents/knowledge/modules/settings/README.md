# Settings Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/settings/README.md)

## Purpose

`apps/web/src/modules/settings` manages the user's income/expense transaction categories and shows workspace preferences.

## Code layout

- `api/categories-api.ts`: `getCategories(type?)` (`API_ROUTES.categories`, optional `?type=income|expense`), `createCategory`, `updateCategory`, `deleteCategory` (`/api/categories/:id`).
- `api/categories-query.ts`: `categoriesQueryKeys.all` (`['categories']`), `list(type)`; hooks `useCategoriesQuery`, `useCreateCategoryMutation`, `useUpdateCategoryMutation`, `useDeleteCategoryMutation`. Mutations invalidate `categoriesQueryKeys.all`.
- `presentation/components/settings-screen.tsx` (`SettingsScreen`), re-exported by `view/settings-screen.tsx`.
- Backend endpoints live in `apps/api/src/finance/finance.controller.ts` (`GET/POST /categories`, `PATCH/DELETE /categories/:id`).

## UI (`SettingsScreen`)

- Page header (title, subtitle, Refresh, Logout) comes from the private layout `WorkspaceHeader`; the screen renders none.
- Two tabs: `categories` (default) and `preferences`.
- **Categories tab**: two `DataPanel`s (expense, income). Each has client search by name, inline add (`settings.categories.addExpense` / `addIncome`; Enter saves, Escape cancels), inline rename (double-click or Edit; Enter/Escape), delete with `window.confirm`. Action buttons use `flex-nowrap whitespace-nowrap` / `shrink-0`. Loading and empty (`settings.categories.empty`) states come from the table; error state shows an alert with Retry.
- **Preferences tab** (static info + tools):
  - Language and Theme: informational rows with a "Supported" badge (no switcher here).
  - Wallet & Balance: button opens `AdjustBalanceModal` (`@/modules/dashboard/presentation/components/adjust-balance-modal`) to reconcile the ledger balance with a real wallet balance.
  - React Scan: toggle bound to `useReactScan()`.

## React Scan (known gap)

- `ReactScanProvider` (`apps/web/src/shared/providers/react-scan-provider.tsx`) only stores a boolean in `localStorage` key `zalobot-react-scan-enabled` (default off) and exposes it via context.
- Nothing imports `react-scan` (the package is declared in `apps/web/package.json`), so toggling it currently has **no effect** on rendering or profiling.
