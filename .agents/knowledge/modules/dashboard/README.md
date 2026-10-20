# Dashboard Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/dashboard/README.md)

## Purpose

`apps/web/src/modules/dashboard` is the main authenticated web workspace. It renders the Home overview from one dashboard payload and owns most routed screens: Transactions, Analytics, Places, Calendar, Tasks, Reminders. The `calendar`, `tasks`, `reminders` modules only provide API/query layers (calendar also `CalendarGrid` + date utils).

## Routes → screens (`apps/web/app/(private)/`)

| Route | Screen (dashboard module unless noted) |
| --- | --- |
| `/`, `/dashboard` | `DashboardHomeScreen` |
| `/transactions` (`?type=income\|expense`) | `TransactionsScreen` |
| `/expenses`, `/income` | redirect to `/transactions?type=expense` / `?type=income` |
| `/analytics` | `AnalyticsScreen` |
| `/places` | `PlacesScreen` |
| `/calendar` | `CalendarScreen` |
| `/tasks`, `/reminders` | `TasksScreen`, `RemindersScreen` |
| `/debts`, `/contacts`, `/zca`, `/settings` | other modules |

`dashboard-screen.tsx` re-exports screens and a legacy `DashboardScreen({ page })` wrapper. The private layout renders `AppNavigation` + `WorkspaceHeader` once; screens never render their own header.

## API layer (`api/`)

- `dashboard-api/query`: `getDashboard` → `GET API_ROUTES.dashboard`; key `['dashboard']`; `useDashboardQuery({ enabled? })`.
- `analytics-api/query`: `getFinanceAnalytics` → `GET /api/finance/analytics?startAt&endAt&grain`; key `['finance-analytics', grain, startAt, endAt]`; `staleTime` 60s.
- `transactions-api/query`: create/update/delete via `API_ROUTES.transactions` (no list query; screens read transactions from the dashboard payload). Create invalidates dashboard, transactions, expenses, finance-analytics, places; update invalidates dashboard, transactions, expenses, places; delete invalidates dashboard, transactions, expenses.
- `places-api/query`: `GET/POST /api/places`, `PATCH/DELETE /api/places/:id`, `POST API_ROUTES.placesCombine` (`/api/places/combine`); keys `['places']`, `['places','list']`. Combine invalidates places, transactions, expenses, dashboard; other mutations invalidate places list + dashboard.
- `allocations-api/query`: `useCandidateDebtsQuery(txId)` → `GET /api/transactions/:id/candidate-debts`; `useTransactionAllocationsQuery(txId)` → `GET /api/transactions/:id/allocations`; `useAllocateTransactionMutation` → `POST /api/transactions/:id/allocations`; `useDeleteDebtAllocationMutation` → `DELETE /api/transactions/:id/allocations/:allocationId` (not used by any UI). Mutations invalidate candidate/allocation keys, dashboard, transactions, debts.

## Dashboard payload (`GET /api/dashboard`, `ReportsController`)

`user { name, isAdmin, googleConnected }`, `finance { income, expense, balance, receivable, payable }` (income/expense/balance = **current calendar month**), `transactions` (current month, newest first, **max 20**, with `placeId`, `placeName`, `allocations[]`), active `debts`, upcoming `calendar` and `tasks` (Google, if connected), `reminders` (≤10), `activity` (10 latest audit rows), `admin { userCount, googleConnectedCount }` for admins.

## Home (`DashboardHomeScreen`)

- `?status=logged_out` → `SessionStateScreen reason="logged_out"` (query disabled). Query error → `reason="expired"` with retry. Loading → `DashboardHomeSkeleton`.
- KPI metrics: income, expense, balance, receivable, payable, attention items.
- Quick links bar: Transactions, Adjust balance (opens `AdjustBalanceModal`), Debts, Analytics, Calendar, Tasks, Reminders, Contacts.
- Admin strip (admins only): user count, Google-connected count.
- Read-only panels, each with its own search box: Tasks, Reminders, Calendar, Transactions, Open debts (titles link via `DataPanel titleHref` to their pages) and Activity (audit log, no link). Table ids `home-*`.

## Transactions (`TransactionsScreen`)

- Data: `useTransactionsInfiniteQuery` → `GET /api/transactions` with `type` (from `?type=`), `startAt`/`endAt` (period bounds; omitted for the `all` grain) and `search` (300 ms debounce). Filtering is server-side. Pages of `TRANSACTIONS_PAGE_SIZE` = 100 rows; a **Load more** button under the table fetches the next page while `offset + loaded < total`. Counter shows `table.loadedOf` until all rows are loaded. `keepPreviousData` keeps rows visible while a new period/filter loads.
- Running balance per row = server `runningBalance` (wallet balance after that transaction over the whole ledger, filter-independent). `TrendSummaryStrip` totals = server `summary` (whole period, both types); its buckets use loaded rows only.
- `usePeriodFilter('month')` + `PeriodFilterToolbar` (default grains `week / month / quarter / year`; URL `?period=&ref=`), `TrendSummaryStrip`.
- Type filter pills All / Income / Expense synced to `?type=`; search over category, note, place name; Adjust balance button.
- `TransactionsTable` (`id="transactions"`) columns: type badge, category (non-hideable), note, place, **created by** (creator name + source line `Nhóm <name>` / `Chat riêng` / `Dashboard`, `—` when unknown), **receipt** (32px thumbnail when `hasReceipt`, click → lightbox `Modal` with full image + "Mở ảnh" new tab), amount (non-hideable; proportional bar only while amounts are revealed), running balance, occurredAt, actions (non-hideable, `minWidth: 130px`, Edit + Delete).
- Every row is expandable (chevron in the note cell): details panel (creator, source, createdAt, payment method, currency, full wrapped note, large receipt image) followed by the allocations sub-table when present. Receipt `<img>` src = `getTransactionReceiptUrl(id)` (`API_ROUTES.transactionReceipt`, cookie-authenticated, lazy, inline error "Không tải được ảnh"). Components: `transaction-receipt.tsx` (`describeTransactionSource`, `ReceiptImage`, `ReceiptThumbnail`).
- Finance data is one shared store (see global/finance-domain): every user sees the same ledger here; the creator column tells members apart.
- Inline edit: type, category and place via shared `CategoryAutocomplete` (portal listbox; focus/click opens, typing filters, ArrowUp/Down + Enter selects, first Escape closes menu, next Escape cancels; free text allowed), note (required), amount (>0), occurredAt. Category options: configured categories of the edited type (`useCategoriesQuery`), historical categories of that type, `DEFAULT_INCOME_CATEGORIES`/`DEFAULT_EXPENSE_CATEGORIES`. Place options: `usePlacesQuery` names. Save sends `placeName`, or `placeId: null` when the place is cleared (detaches only).
- Save is disabled when the type changes on a transaction with allocations, or the amount drops below the allocated sum (title explains why).
- Allocations: note cell shows an expand chevron and a `🔗 N allocations` badge (opens `DebtAllocationModal`); while editing, a `🔗` action button opens it too. Expanded row (`renderExpandedRow`, full `colSpan`) lists counterparty, amount, note per allocation.
- Delete opens `DeleteTransactionModal`: summary (type, category, place, amount, time, note), balance impact (expense → emerald `+amount`; income → amber `-amount`), rose warning when allocations exist (their debt balances will be restored). Escape/backdrop close unless pending.
- Transactions query error → `SessionStateScreen reason="expired"` (retry = refetch). The screen no longer reads `/api/dashboard`.

## `DebtAllocationModal`

- Loads `useCandidateDebtsQuery` and `useTransactionAllocationsQuery` (stable `EMPTY_*` fallbacks). Candidates: shared-ledger debts with direction `income→receivable`, `expense→payable`, filtered by the transaction's `contactId` when set, newest first, excluding fully paid debts not already allocated.
- Shows total / allocated / unallocated, per-debt amount + note inputs, "allocate max" helper (min of unallocated and debt remaining). Client validates totals; server errors shown inline.
- Submit `POST /api/transactions/:id/allocations` **replaces** the transaction's whole allocation set (reverts old allocations and their `debt_payments`, applies new ones atomically). Rows with amount 0 are dropped, so removing an allocation = saving it with 0.

## `AdjustBalanceModal`

- Opened from Home quick links, Transactions toolbar, Settings. `currentBalance` = all-time ledger balance: `ledgerBalance` from the transactions list response on Transactions, `dashboard.finance.ledgerBalance` on Home and Settings.
- User enters target balance; diff > 0 creates an `income`, diff < 0 an `expense` with category `t('category.balanceAdjustment')` (`Điều chỉnh số dư` / `Balance Adjustment` by locale), editable auto note, datetime. Diff 0 makes submit a no-op. Uses `useCreateTransactionMutation`.

## Analytics (`AnalyticsScreen`)

- `usePeriodFilter('month')` + toolbar; `useFinanceAnalyticsQuery({ startAt, endAt, grain })` (no dates for `all`).
- Selected-period `MetricGrid`: income, expense, net savings, savings rate. Separate "current position" grid (not period-filtered): cashflow balance (all-time), receivable, payable, net worth.
- Cashflow panel: `Button` toggle chart/table; `CashflowTrendChart` (Recharts `ComposedChart`: income/expense bars + cumulative balance line) or `DataTable` of buckets.
- `CategoryDonutChart` (Recharts `PieChart`, all expense categories, scrollable legend) and `DebtStructureChart` (receivable vs payable ratio + top 3 counterparties each side; ratio and per-counterparty bars render only while amounts are revealed). Charts live in `shared/ui/charts/`.
- Only `SessionStateScreen reason="expired"` (on dashboard query error). Loading skeleton is inline (`MetricGridSkeleton` + placeholder blocks); there is no `AnalyticsSkeleton` component. Retry invalidates dashboard + finance-analytics.

## Places (`PlacesScreen`, `/places`)

- `DataTable id="places"` (auto `stt`/`id` system columns) with `select`, `name` (inline edit, Enter/Escape), `transactionCount`, `createdAt`, `actions` (Edit, two-step inline delete). Search, quick Add place form.
- Combine: 2+ selected → `CombinePlacesDialog`: candidates ranked by `transactionCount` desc then earliest `createdAt`; pick lead + final name; `POST /api/places/combine { placeIds, targetPlaceId, name }` → `{ leadPlace, mergedPlacesCount, affectedTransactionsCount }`. Backend rejects a name already used by another place.
- Deleting a place never deletes transactions (`place_id ON DELETE SET NULL`).

## Calendar / Tasks / Reminders screens

- `CalendarScreen`: see calendar module (grid/table toggle, month nav, search, `window.confirm` delete, `CalendarTable`).
- `TasksScreen`: `useTasksQuery`, period toolbar with grains `day / week / month / quarter / year / all`, status filter All / Needs action / Completed, inline edit, confirm delete.
- `RemindersScreen`: `useRemindersQuery`, search, inline edit, confirm delete.

## Shared UI behavior

- `WorkspaceHeader`: route title/subtitle, money visibility toggle, Refresh (= `queryClient.invalidateQueries()` for all queries), Logout.
- Money visibility (`useMoneyVisibilityStore` Zustand store, `useMoneyVisibility`/`useMoneyFormatter` hooks): default hidden; in-memory only (no `persist`, no `localStorage`), so every page load/F5 resets to hidden; masked as `••••••` in KPIs, tables, tooltips; amount ratio bars in Transactions/Expenses tables are hidden while masked; edit inputs unmasked.
- `DataTable`: column visibility (`zalobot:table-columns:<id>`) and widths (`zalobot:table-widths:<id>`) persisted per table id; `allColumnsKey` + equality guards prevent render loops. `usePeriodFilter` result is memoized.
- `AppNavigation`: 210px docked sidebar (sections Overview, Finance, Planning, Data, System); ≤960px becomes sticky top bar + slide-out drawer. Footer: theme toggle (`useThemeStore`, localStorage, first visit follows system) and vi/en locale selector.

- `DebtAllocationModal`, `AdjustBalanceModal`, `DeleteTransactionModal`, `CombinePlacesDialog`: Dialogs render through the shared `Modal` shell (bottom sheet on mobile, sticky header/actions above the on-screen keyboard); see [web-ui-direction](../../global/web-ui-direction.md#mobile-dialogs--on-screen-keyboard). Screen toasts offset by `env(safe-area-inset-bottom)`.

## Integration seams

- Dashboard link: user sends `/dashboard` in Zalo → `DashboardToolStrategy` replies with a one-time `/api/access?token=` URL (20 min) → API redirects to `/dashboard#dashboard_token=<access>` (see auth module). There is no callback button.
- HTTP base: relative `/api/...` on localhost / Cloudflare tunnel / ngrok / loca.lt hosts, else `NEXT_PUBLIC_API_URL` (origin without `/api`; route constants already include `/api`). In `next dev` (port `FE_PORT`, default 5173) `/api/*` is rewritten to `NEXT_PUBLIC_API_URL` (default `http://localhost:${NGINX_PORT|GATEWAY_PORT|3000}`). Production is a static export; Nginx serves it and proxies `/api/*`.

## Known issues

- Home's Transactions panel and the "Balance" KPI still use the dashboard payload (current month; panel ≤20 rows) by design.
- Trend buckets on Transactions only cover loaded rows when a period has more than one page.
