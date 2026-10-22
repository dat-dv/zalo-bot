# Settings Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/settings/README.md)

## Purpose

`apps/web/src/modules/settings` manages the user's income/expense transaction categories and shows workspace preferences.

## Code layout

- `api/categories-api.ts`: `getCategories(type?)` (`API_ROUTES.categories`, optional `?type=income|expense`), `createCategory`, `updateCategory`, `deleteCategory` (`/api/categories/:id`).
- `api/categories-query.ts`: `categoriesQueryKeys.all` (`['categories']`), `list(type)`; hooks `useCategoriesQuery`, `useCreateCategoryMutation`, `useUpdateCategoryMutation`, `useDeleteCategoryMutation`. Mutations invalidate `categoriesQueryKeys.all`.
- `presentation/components/settings-screen.tsx` (`SettingsScreen`), re-exported by `view/settings-screen.tsx`.
- `presentation/components/install-app-row.tsx` (`InstallAppRow`): the Preferences "Mobile app" row.
- Backend endpoints live in `apps/api/src/finance/finance.controller.ts` (`GET/POST /categories`, `PATCH/DELETE /categories/:id`).

## UI (`SettingsScreen`)

- Page header (title, subtitle, Refresh, Logout) comes from the private layout `WorkspaceHeader`; the screen renders none.
- Two tabs: `categories` (default) and `preferences`.
- **Categories tab**: two `DataPanel`s (expense, income). Each has client search by name, inline add (`settings.categories.addExpense` / `addIncome`; Enter saves, Escape cancels), inline rename (double-click or Edit; Enter/Escape), delete with `window.confirm`. Action buttons use `flex-nowrap whitespace-nowrap` / `shrink-0`. Loading and empty (`settings.categories.empty`) states come from the table; error state shows an alert with Retry.
- **Preferences tab** (static info + tools):
  - Language and Theme: informational rows with a "Supported" badge (no switcher here).
  - Mobile app (`InstallAppRow`, after Theme): the only install entry point of the PWA (see `global/pwa.md`). Reads `usePwaStore`: `installed` -> "Installed" badge; a captured `installPrompt` (Chromium) -> "Install app" button calling `prompt()` (a dismissed prompt is dropped, it can be used once); otherwise a hint chosen by user agent: Zalo in-app browser -> open in Safari/Chrome, iOS -> Share -> Add to Home Screen, else unsupported. User agent is read with `useSyncExternalStore` (empty on the server).
  - Wallet & Balance: button opens `AdjustBalanceModal` (`@/modules/dashboard/presentation/components/adjust-balance-modal`) to reconcile the ledger balance with a real wallet balance; `currentBalance` = `dashboard.finance.ledgerBalance` (all-time income − expense).
  - React Scan: toggle bound to `useReactScan()`.
- **Compact / phone** (desktop unchanged): both category `DataTable`s use the mobile list (<= 960px): primary `name`, secondary type label; no trailing (categories carry no count/usage). Rename goes through the sheet footer Edit (input 40px), Save/✕ and Delete sit in the sheet footer. At <= 640px the tabs are one sideways-scrolling row of 40px chips (`MOBILE_TOOLBAR_ROW`); panel toolbars stack a full-width 40px search (`TAP_INPUT`) over a full-width 40px Add button; the inline add row's input and ✓/✕ are 40px (`TAP_CONTROL`); Preferences buttons are 40px and the panel padding shrinks. Category panels stack at 640px (`grid-cols-1`). Toast uses `TOAST_POSITION`; Retry 40px.

## React Scan (known gap)

- `ReactScanProvider` (`apps/web/src/shared/providers/react-scan-provider.tsx`) only stores a boolean in `localStorage` key `zalobot-react-scan-enabled` (default off) and exposes it via context.
- Nothing imports `react-scan` (the package is declared in `apps/web/package.json`), so toggling it currently has **no effect** on rendering or profiling.

## Dark-mode buttons

- Primary actions use the sky tone in dark mode (`dark:bg-sky-600 dark:text-white`), never the near-white inverted `dark:bg-slate-100`: the small primary buttons in `SettingsScreen`; its toast uses the dark toast tone. See [web-ui-direction](../../global/web-ui-direction.md).
