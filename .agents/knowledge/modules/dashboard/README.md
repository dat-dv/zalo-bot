# Dashboard Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/dashboard/README.md)

## Purpose

`apps/web/src/modules/dashboard` renders the authenticated personal overview and statistics pages from one dashboard payload. It combines finance, active debts, tasks, reminders, calendar, audit activity, and optional admin metrics for fast scanning.

## UI and state

The module provides comprehensive loading skeletons adhering to 1:1 structural fidelity (`DashboardHomeSkeleton`, `AnalyticsSkeleton`), error handling via `SessionStateScreen` with retry/clear and zalo bot redirect, empty tables, and populated states. Skeletons preserve all outer containers (`DataPanel` with `border border-slate-200` and `border-b` headers), Quick Links pill bars, `PeriodFilterToolbar` blocks, chart wireframes, and `DataTable` cell borders (`border-r`, `border-b`) with column widths. All components across overview, statistics, transactions, tasks, reminders, and calendar views are styled with 100% Tailwind CSS utility classes and responsive modifiers, supporting complete light and dark theme styling via `dark:`. External links across all screens (such as Google Calendar event links and external resources) open securely in new tabs (`target="_blank" rel="noopener noreferrer"`). Home surfaces attention items, quick links, and responsive grid tables; operational table headers on the home overview (`Tasks`, `Reminders`, `Calendar`, `Transactions`, `Debts`) are interactive links with hover transitions and directional indicator arrows (`titleHref` on `DataPanel`) routing directly to dedicated full-page management views (`/tasks`, `/reminders`, `/calendar`, `/transactions`, `/debts`); statistics and transactions screens surface financial totals, dense operational tables, interactive period filtering (`PeriodFilterToolbar` with day/week/month/quarter/year/all ranges), and visual trend summaries (`TrendSummaryStrip` with income/expense KPI metrics and `MicroBarChart` distribution bars).

### Visual Analytics Dashboard (`/analytics`)

The Analytics screen (`AnalyticsScreen`) provides a unified, single-page visual analytics dashboard focused purely on financial insights, trends, and breakdowns:

- **Single-Page Layout**:
  - **Multi-grain Period Filter**: `PeriodFilterToolbar` and `usePeriodFilter` supporting day, week, month, quarter, year, and all-time ranges with URL sync (`?period=...&ref=...`).
  - **Selected-period results**: four cards (Total Income, Total Expense, Net Savings, Savings Rate) always use the active period filter.
  - **Current financial position**: a separate, unfiltered panel exposes ledger cashflow balance (all-time income minus expense), outstanding receivables, outstanding payables, and net worth (`cashflowBalance + receivable - payable`). This is not a bank-account balance because the product does not track opening account balances.
  - **Common UI seam**: analytics KPI groups use the shared `MetricGrid`; all period controls and chart/table controls use the shared `Button`. The Analytics feature contains no raw interactive HTML tags.
  - **Cashflow Trend Panel**: Full-width interactive `CashflowTrendChart` built with Recharts `ComposedChart` (Income bars in sky, Expense bars in amber, and cumulative Wallet Balance trend line in violet), with a segmented toolbar toggle switching between visual chart and detailed period breakdown table (`DataTable` showing Income, Expense, Period Cashflow, and Cumulative Balance).
  - **Spending Distribution Panel** (Left Column): `CategoryDonutChart` built with Recharts `PieChart` (inner/outer radius donut) showing top spending categories by proportion plus remaining aggregated categories, paired with interactive progress tracks and percentages.
  - **Debt Structure Panel** (Right Column): `DebtStructureChart` displaying proportional ratio comparison (Receivables vs Payables) and horizontal comparative tracks for top counterparties.
- **Dedicated CRUD Separation**: Operational tables (`TransactionsTable`, `DebtsTable`) are intentionally separated to their respective dedicated pages (`/transactions`, `/debts`), keeping Analytics lean, high-performing, and free from redundant CRUD states.
- **Real-time Analytics Query**: `useFinanceAnalyticsQuery({ startAt, endAt, grain })` communicates with `GET /api/finance/analytics`. Its `summary` is period-scoped; `currentPosition` is all-time/current; `debts` remains the current debt breakdown for the debt chart.
- **Modern Recharts Suite**:
  - `CashflowTrendChart`: Responsive composed chart with animated bars for period income/expense, smooth spline/line for cumulative wallet balance progression, currency axis formatting, and dark/light mode Tailwind tooltips displaying income, expense, period cashflow, and cumulative wallet balance.
  - `CategoryDonutChart`: Responsive SVG pie/donut with hover highlight and custom Tailwind tooltip.
  - `DebtStructureChart`: Proportional ratio bar and horizontal comparative tracks showing top receivables (lent) and payables (borrowed) counterparties.

All operational tables use unified Common Table components: Transactions (`TransactionsTable` featuring income/expense direction badges and chronological running balance tracking via `runningBalance`), Debts (`DebtsTable`), Tasks (`TasksTable`), Reminders (`RemindersTable`), and Calendar (`CalendarTable`). These components are shared across Home overview and dedicated management screens (`TransactionsScreen`, `DebtsScreen`, `TasksScreen`, `RemindersScreen`, `CalendarScreen`), eliminating duplicated column definitions. All tables feature double-click cell inline editing with category autocomplete suggestions (`<datalist>` combining `DEFAULT_INCOME_CATEGORIES` / `DEFAULT_EXPENSE_CATEGORIES`, user-configured custom categories from `useCategoriesQuery()`, and past transaction categories), extended action columns (`actions` with `minWidth: 130px`, `flex-nowrap whitespace-nowrap`, and `shrink-0` buttons to prevent wrapping during inline edit/delete), inline save/cancel/delete/repay triggers, keyboard shortcuts (`Enter`/`Escape`), and dynamic toast notifications. Calendar screen (`CalendarScreen`) supports a flexible view mode toggle switching between a rich monthly calendar matrix (`CalendarGrid` with event badges, quick date selection, and inline event editing/deletion) and a data-dense list (`CalendarTable`), along with previous/next/today navigation and instant search. In the list, Description defaults to a compact multi-line column; users can resize headers and each table remembers its column widths locally by its `DataTable` id. It queries the full visible grid-month range directly, rather than falling back to the dashboard's calendar summary, so each month always renders its own events. Refresh invalidates every calendar-query range as well as the dashboard query. Data tables support column visibility settings and persistence via unique table IDs (such as `id="transactions"`, `id="debts"`, and `id="tasks"`), responsive minimum column widths (`minWidth`), non-hideable key identifiers, and inline proportional bar tracks for financial amounts. Financial values use tabular numbers (`tabular-nums`) and semantic tones for positive, warning, and negative meaning. Google connection state remains available to determine Calendar and Tasks empty messages, but it is not rendered as a persistent navigation or header status label. Navigation is an enterprise docked sidebar on desktop (sharp 2px-4px radius, compact 30px-34px row height, sticky table headers, search & filter toolbars on all data panels, and fluid 100% fullscreen layout) and smoothly transitions on mobile viewports (<= 960px) to a sticky Mobile Header with an accessible Hamburger toggle button that summons a slide-out Navigation Drawer with backdrop overlay. Its footer has an accessible light/dark toggle and multi-language selector (Vietnamese/English); the selected theme is stored locally in the browser and the first visit follows the system preference.

When an unauthenticated visit or session error occurs, `DashboardHomeScreen` and `AnalyticsScreen` render `SessionStateScreen` (`reason="expired"` or `reason="logged_out"`), presenting primary buttons to open the zalo Bot, close the mini app if inside zalo, or clear the session cache and retry.

## Global money visibility toggle and persistence

A global `MoneyVisibilityProvider` manages `isMoneyVisible` in React context, defaulting to `false` (hidden/masked by default for privacy). The accessible toggle button is rendered by the common `WorkspaceHeader` in the private layout (not by individual screen files). It masks (`••••••`) across financial summaries, table amount cells, and chart tooltips. The user's preference is persisted in browser `localStorage` (`zalobot-money-visibility`). Editable input fields during inline editing remain unmasked so user input and adjustments proceed without disruption.

## Transactions category combobox

During inline transaction editing, Category is a controlled combobox rather than a native datalist. It draws type-specific defaults, configured user categories, and historical categories. Focus or click opens choices, typing filters them, Arrow keys plus Enter choose a value, and Escape closes the menu before a later Escape cancels the edit. The component permits new category text and portals its listbox above the scrollable data table.

## Transaction places & Dedicated Places Page (/places)

- **Transaction Place Column**: Transactions include an optional `placeId`/`placeName` from the Finance module. The table displays a Place column, includes it in text search, and its inline combobox loads saved places with `usePlacesQuery`. New typed names are resolved by the API; clearing the field sends `placeId: null` to detach the place without removing the transaction.
- **Dedicated Places Screen (`/places` - `PlacesScreen`)**:
  - Independent management page for venues, restaurants, stores, and hospitals.
  - Data table utilizes `DataTable` (`id="places"`), which automatically prepends non-hideable `stt` and `id` system columns, paired with domain columns: `name` (inline edit on double-click with `Enter`/`Escape`), `createdAt`, and `actions` (Edit, 2-step safe inline deletion).
  - Search toolbar and quick Add Place form (`+ Add place`).
  - Integrated into navigation drawer and sidebar under `DATA` (`nav.section.data`) with a dedicated location pin icon.
- **Transaction Deletion & Balance Impact Modal (`DeleteTransactionModal`)**:
  - Replaces native browser `window.confirm` dialogs on `TransactionsScreen` with a dedicated, accessible confirmation modal (`DeleteTransactionModal`).
  - Renders complete transaction summary (type, category, place, amount, occurredAt, note) alongside color-coded cashflow balance impact callouts:
    - **Expense deletion**: Emerald refund card informing the user that wallet cashflow balance will increase (`+amount`).
    - **Income deletion**: Amber/rose deduction card informing the user that wallet cashflow balance will decrease (`-amount`).
    - **Allocated transactions**: Alert warning that deleting the transaction will restore unpaid balances on linked debts.
  - Supports keyboard Escape, backdrop dismiss, and disabled states during mutation pending.
- **Wallet Balance Adjustment & Reconciliation Modal (`AdjustBalanceModal`)**:
  - Provides a dedicated modal accessible from Dashboard Home Quick Actions, the Transactions Screen toolbar, and Settings Preferences (`apps/web/src/modules/dashboard/presentation/components/adjust-balance-modal.tsx`).
  - Allows users to enter their actual real-world wallet/bank balance (`targetAmount`).
  - Automatically calculates the difference between current ledger balance and target balance:
    - **Positive difference (`diff > 0`)**: Creates an `income` transaction categorized under `Điều chỉnh số dư` (`category.balanceAdjustment`).
    - **Negative difference (`diff < 0`)**: Creates an `expense` transaction categorized under `Điều chỉnh số dư`.
  - Automatically formats the adjustment note (`Cân chỉnh số dư ví: {current} ➔ {target}`) with customizable override, datetime picker, error boundaries, and reactive query invalidation across dashboard, transactions, and analytics keys.
- **Debt Transaction Allocation & Inline Expandable Rows (`DebtAllocationModal` & `TransactionsTable`)**:
  - Clicking the dropdown button expands a dedicated master-detail Sub-panel (`renderExpandedRow`, `colSpan={columns.length}`) indented beneath the parent transaction, displaying an allocations sub-grid with counterparty, amount, note, and an edit button opening `DebtAllocationModal`.
  - The Allocation Modal (`DebtAllocationModal`, `apps/web/src/modules/dashboard/presentation/components/debt-allocation-modal.tsx`) fetches candidate debts matching the transaction's contact and direction (`useDebtAllocationCandidatesQuery`), splits/allocates transaction amounts across debts, and calls `POST /api/debts/allocations` (`useAllocateTransactionMutation`).
  - Preserves traceability between cashflow events and debt payments.
  - All modal callbacks (`onClose`, `onSuccess`) and transaction table handlers are memoized via `useCallback` to prevent superfluous re-renders.

## High-performance Data Tables & Render Loop Prevention

- `DataTable` (`src/shared/ui/data-table.tsx`) utilizes `allColumnsKey` string dependency tracking alongside functional state equality guards (`setVisibleColumnIds`, `setColumnWidths`). State updates from `localStorage` (`zalobot:table-columns:*`, `zalobot:table-widths:*`) only commit when values actually diverge from previous state, eliminating infinite render loops across dense views like `TransactionsScreen`.
- `usePeriodFilter` memoizes its returned state object with `useMemo`, preventing downstream cascade renders when the active period date range is unchanged.
- `DebtAllocationModal` (`apps/web/src/modules/dashboard/presentation/components/debt-allocation-modal.tsx`) utilizes static constant empty array references (`EMPTY_CANDIDATE_DEBTS`, `EMPTY_ALLOCATIONS`) as fallback values for query data hooks (`useCandidateDebtsQuery`, `useTransactionAllocationsQuery`), eliminating reference churn and re-render loops when query responses are pending or undefined.

## Integration seams

`getDashboard` consumes `API_ROUTES.dashboard` through the shared HTTP client. API route constants include `/api`; `NEXT_PUBLIC_API_URL` is therefore the public origin without `/api` (for example `https://zalobot.datintech.site`). In local development, Next rewrites `/api/*` on port 5173 to this origin (default `http://localhost:3000`); in production Nginx routes `/api/*` to NestJS and serves the static dashboard for all other paths. The access exchange endpoint redirects valid one-time links to root `/` with `#dashboard_token=...` and returns a readable HTTP 401 page for missing, expired, or consumed links. The `/help` and `/start` dashboard control is a zalo callback that issues a new one-time URL only after the user taps it. `useDashboardQuery` defines the cache key, accepts an optional `{ enabled?: boolean }` config, and supports manual invalidation. Logout calls the shared dashboard logout route, clears authentication state, clears query cache, and redirects to `${APP_ROUTES.home}?status=logged_out`.
