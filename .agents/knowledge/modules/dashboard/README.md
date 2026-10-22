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

`user { name, isAdmin, googleConnected }`, `finance { income, expense, balance, receivable, payable }` (income/expense/balance = **current calendar month**), `transactions` (current month, newest first, **max 20**, with `placeId`, `placeName`, `allocations[]`), active `debts`, upcoming `calendar` and `tasks` (both from the DB, ≤50 tasks, independent of Google), `reminders` (≤10), `activity` (10 latest audit rows), `admin { userCount, googleConnectedCount }` for admins.

## Home (`DashboardHomeScreen`)

- `?status=logged_out` → `SessionStateScreen reason="logged_out"` (query disabled). Query error → `reason="expired"` with retry. Loading → `DashboardHomeSkeleton`.
- KPI metrics: income, expense, balance, receivable, payable, attention items.
- Quick links bar: Transactions, Adjust balance (opens `AdjustBalanceModal`), Debts, Analytics, Calendar, Tasks, Reminders, Contacts.
- Admin strip (admins only): user count, Google-connected count.
- Read-only panels, each with its own search box: Tasks, Reminders, Calendar, Transactions, Open debts (titles link via `DataPanel titleHref` to their pages) and Activity (audit log, no link). Table ids `home-*`.
- **Compact (<= 960px, `useIsCompact`)**: each panel is a preview: only the first `HOME_COMPACT_ROW_LIMIT` = 5 rows in API order (newest transactions/activity, nearest tasks/reminders/events; Open debts limits root debts, children stay nested) render through the tables' DataTable mobile list (where the table declares `mobileSlot`s), followed by a 40px "View all" (`dashboard.viewAll`) link to the page (`APP_ROUTES`; Activity has no page, so no link). Activity list: primary `action · tableName`, trailing date.
- **Phone (<= 640px, `useIsPhone`)**: per-panel search inputs are not rendered and their queries are ignored (a query typed before rotating stops filtering). Quick links (8) form a 4-column grid, two rows, no sideways scroll (`QUICK_LINKS_PHONE`; tiles `min-h-10`, 12px centered text that may wrap to 2 lines). KPI cards stay 2 per row, 52px tall, 14px values. Skeleton mirrors this (8 placeholders in the same grid, no search placeholders).

## Transactions (`TransactionsScreen`)

- Data: `useTransactionsInfiniteQuery` → `GET /api/transactions` with `type` (from `?type=`), `startAt`/`endAt` (period bounds; omitted for the `all` grain), `search` (300 ms debounce) and the column filters below (lists sent as repeated keys via `paramsSerializer: { indexes: null }`). Filtering is server-side. Pages of `TRANSACTIONS_PAGE_SIZE` = 100 rows; a **Load more** button under the table fetches the next page while `offset + loaded < total`. Counter shows `table.loadedOf` until all rows are loaded. `keepPreviousData` keeps rows visible while a new period/filter loads.
- Running balance per row = server `runningBalance` (wallet balance after that transaction over the whole ledger, filter-independent). `TrendSummaryStrip` totals = server `summary` (whole period, both types); its buckets use loaded rows only.
- `usePeriodFilter('month')` + `PeriodFilterToolbar` (default grains `week / month / quarter / year`; URL `?period=&ref=`), `TrendSummaryStrip`.
- Type filter pills All / Income / Expense synced to `?type=`; search over category, note, place name; Adjust balance button.
- **Column header filters** (server-side, `transaction-column-filters.ts` + `column-filter-popover.tsx`): a funnel button in the header (dot when active) opens a portalled panel (`role="dialog"`, focuses its first input on open, Escape/outside click closes and refocuses the button) with "Clear filter". At phone width (`useIsPhone`) the same content opens in the shared `Modal` bottom sheet instead (backdrop/scroll lock/Escape from `Modal`, no auto-focused input so the keyboard does not pop, 40px inputs/option rows/clear button). Columns: type (radio, shares `?type=` with the pills), category (multi-select from `facets.categories`), note (contains, 400 ms debounce), place (multi-select from `usePlacesQuery` + "No place" = `TRANSACTION_FILTER_NO_PLACE`), created by (multi-select from `facets.creators`; empty name shown as "Không rõ tên (…<last 4 of id>)"), receipt (all / with / without image), amount (min–max, digits only, 400 ms debounce, reversed range swapped). State lives in the URL (`category`, `note`, `place`, `creator`, `receipt=yes|no`, `amountMin`, `amountMax`, repeated keys for lists) so reload/share keeps it; other params untouched. Toolbar shows "Clear all filters (N)" when any column filter (excluding type) is active. Filter buttons render only when `onChangeColumnFilters` is passed, so the home dashboard table has none.
- `TransactionsTable` (`id="transactions"`) columns: type badge, category (non-hideable), note, place, **created by** (creator name + source line `Nhóm <name>` / `Chat riêng` / `Dashboard`, `—` when unknown), **receipt** (`hasReceipt` rows show a 🧾 icon button and load no image; header toggle 🖼 (`aria-pressed`, `transactions.receipt.showAll|hideAll`) switches every row to an uncropped `object-contain` preview ~64px high / max 96px wide, column `minWidth` 72px → 112px; state is component-local and NOT persisted, so each load starts with icons only to avoid fetching all receipts; icon or preview click → lightbox `Modal` with full image + "Mở ảnh" new tab), amount (non-hideable; proportional bar only while amounts are revealed), running balance, occurredAt, actions (non-hideable, `minWidth: 130px`, Edit + Delete).
- Every row is expandable (chevron in the note cell): details panel (creator, source, createdAt, payment method, currency, full wrapped note, large receipt image) followed by the allocations sub-table when present. Receipt `<img>` src = `getTransactionReceiptUrl(id)` (`API_ROUTES.transactionReceipt`, cookie-authenticated, lazy, inline error "Không tải được ảnh"). Components: `transaction-receipt.tsx` (`describeTransactionSource`, `ReceiptImage`, `ReceiptCell`, `ReceiptColumnHeader`, internal `ReceiptDialog`). Receipts are never loaded from the raw Drive link: the API proxy reads them (shared token → creator token → public link, see global/finance-domain.md).
- Finance data is one shared store (see global/finance-domain): every user sees the same ledger here; the creator column tells members apart.
- Inline edit: type, category and place via shared `CategoryAutocomplete` (portal listbox; focus/click opens, typing filters, ArrowUp/Down + Enter selects, first Escape closes menu, next Escape cancels; free text allowed), note (required), amount (>0), occurredAt. Category options: configured categories of the edited type (`useCategoriesQuery`), historical categories of that type, `DEFAULT_INCOME_CATEGORIES`/`DEFAULT_EXPENSE_CATEGORIES`. Place options: `usePlacesQuery` names. Save sends `placeName`, or `placeId: null` when the place is cleared (detaches only).
- Save is disabled when the type changes on a transaction with allocations, or the amount drops below the allocated sum (title explains why).
- Allocations: note cell shows an expand chevron and a `🔗 N allocations` badge (opens `DebtAllocationModal`); while editing, a `🔗` action button opens it too. Expanded row (`renderExpandedRow`, full `colSpan`) lists counterparty, amount, note per allocation.
- Delete opens `DeleteTransactionModal`: summary (type, category, place, amount, time, note), balance impact (expense → emerald `+amount`; income → amber `-amount`), rose warning when allocations exist (their debt balances will be restored). Escape/backdrop close unless pending.
- Transactions query error → `SessionStateScreen reason="expired"` (retry = refetch). The screen no longer reads `/api/dashboard`.
- **Compact width (<= 960px)**: no `MobileActionBar` — Adjust balance is rarely used, so it stays as the toolbar chip (end of the scrolling chip row) instead of a pinned bottom bar. Toasts use `TOAST_POSITION`.
- **Phone width (<= 640px)**: `TransactionsTable` renders the DataTable mobile list by default (`mobileList` defaults to `true`; active up to 960px) (see [web-ui-direction](../../global/web-ui-direction.md#mobile-list-mode-datatable--640px)). Row: note + signed amount (no ratio bar), then category · date (dd/MM) · creator · place. Tap → detail sheet with every column (inline edit works there, actions in the sticky footer, ID row → `IdExplainerDialog`) and the details/receipt/allocations panel. Column filters move to a horizontal filter strip above the list (type, category, note, place, creator, receipt, amount). Toolbar pills + "Adjust balance" + "Clear all filters" form one horizontally scrolling 40px row; search sits on its own full-width 40px row; Load more, filter triggers, and edit inputs/buttons are 40px. Home's transaction table uses the list too (5-row preview, see Home).
- **Phone header height**: `TrendSummaryStrip` (shared, also Expenses) collapses to one 44px line of income / expense / net totals (same masking formatter); tapping it (`aria-expanded`, sr-only "Show/Hide chart") reveals the micro bar chart and any `extraMetrics`. Starts collapsed on phones; desktop strip unchanged (CSS swap at 640px, no hydration flash). Section gap shrinks to 8px. In the detail sheet the allocations sub-table becomes a vertical list (counterparty + amount, note below), "Edit allocations" and the `🔗 N allocations` badge are 40px, the expand chevron is hidden in list mode (the sheet always shows details), and the emoji-only `🔗` edit-mode button has `aria-label` `transactions.actions.allocateDebts`.

## `DebtAllocationModal`

- Loads `useCandidateDebtsQuery` and `useTransactionAllocationsQuery` (stable `EMPTY_*` fallbacks). Candidates: shared-ledger debts with direction `income→receivable`, `expense→payable`, filtered by the transaction's `contactId` when set, newest first, excluding fully paid debts not already allocated.
- Shows total / allocated / unallocated, per-debt amount + note inputs, "allocate max" helper (min of unallocated and debt remaining). Client validates totals; server errors shown inline.
- Submit `POST /api/transactions/:id/allocations` **replaces** the transaction's whole allocation set (reverts old allocations and their `debt_payments`, applies new ones atomically). Rows with amount 0 are dropped, so removing an allocation = saving it with 0.
- Phones: `phoneLayout="fullscreen"`; the candidate list's `max-h-72` scroll box is removed (the dialog scrolls); amount/note inputs and "Allocate max" are 40px; summary bar stacks. All copy is i18n (`transactions.allocation.candidatesTitle|loadingCandidates|allocateMax|originalAmount|remainingAmount|amountLabel`; type badge reuses `table.filter.income|expense`).

## Dialogs on phones (shared rules)

- `AdjustBalanceModal`, `DebtAllocationModal`, `DeleteTransactionModal`, `CombinePlacesDialog`, receipt dialog: ✕ gets `MODAL_CLOSE_TAP`, footer buttons `MODAL_FOOTER_TAP` (40px, share the row); footers are sticky with a solid background. No input autofocuses when a dialog opens (AdjustBalance target input no longer has `autoFocus`). AdjustBalance footer spans the sheet edge to edge on phones with bottom padding. Combine dialog: candidate list is not a nested scroll box on phones, rows >= 44px, name input 40px; its leftover hardcoded copy moved to `places.combineModal.newNameHint|setLead|topBadge`. Receipt dialog: "Open image" link and ✕ are 40px; the receipt cell icon button is 40px on phones.

## `AdjustBalanceModal`

- Opened from Home quick links, Transactions toolbar, Settings. `currentBalance` = all-time ledger balance: `ledgerBalance` from the transactions list response on Transactions, `dashboard.finance.ledgerBalance` on Home and Settings.
- The target field is prefilled with `currentBalance` only while amounts are revealed; with amounts hidden it opens empty (read once at open from `useMoneyVisibilityStore`), since a prefilled input would print the real balance on a hidden-amounts screen.
- User enters target balance; diff > 0 creates an `income`, diff < 0 an `expense` with category `t('category.balanceAdjustment')` (`Điều chỉnh số dư` / `Balance Adjustment` by locale), editable auto note, datetime. Diff 0 makes submit a no-op. Uses `useCreateTransactionMutation`.

## Analytics (`AnalyticsScreen`)

- `usePeriodFilter('month')` + toolbar; `useFinanceAnalyticsQuery({ startAt, endAt, grain })` (no dates for `all`).
- Selected-period `MetricGrid`: income, expense, net savings, savings rate. Separate "current position" grid (not period-filtered): cashflow balance (all-time), receivable, payable, net worth.
- Cashflow panel: `Button` toggle chart/table; `CashflowTrendChart` (Recharts `ComposedChart`: income/expense bars + cumulative balance line) or `DataTable` of buckets.
- Phones: Chart/Table toggle buttons are 40px and share the row (`aria-pressed`). The breakdown table is per period bucket (not per category), so its mobile list maps primary = period label, trailing = net cashflow (signed, colored), secondary = `Income +x` · `Expense -y`; balance shows only in the sheet. In table mode the panel padding drops at <= 960px so the list is edge to edge. `MetricGrid` (shared) keeps 2 cards per row at <= 640px, 52px tall, 14px values.
- `CategoryDonutChart` (Recharts `PieChart`, all expense categories, scrollable legend) and `DebtStructureChart` (receivable vs payable ratio + top 3 counterparties each side; ratio and per-counterparty bars render only while amounts are revealed). Charts live in `shared/ui/charts/`.
- Only `SessionStateScreen reason="expired"` (on dashboard query error). Loading skeleton is inline (`MetricGridSkeleton` + placeholder blocks); there is no `AnalyticsSkeleton` component. Retry invalidates dashboard + finance-analytics.

## Places (`PlacesScreen`, `/places`)

- `DataTable id="places"` (auto `stt`/`id` system columns) with `select`, `name` (inline edit, Enter/Escape), `transactionCount`, `createdAt`, `actions` (Edit, two-step inline delete). Search, quick Add place form. On compact screens (<= 960px) "+ Create" moves from the toolbar to the `MobileActionBar` (hidden while the inline form is open; the form's input/buttons are 40px and full width on phones). Toast uses `TOAST_POSITION`.
- Mobile list (<= 960px): primary name, trailing transaction count, secondary created date; Edit/Delete live in the sheet footer (double-click edit stays desktop-only); the 🗑️ button has an `aria-label`. The `select` column is dropped on compact (it would show as a sheet field).
- Compact selection mode: a "Select"/"Done" chip (`places.selectMode|selectModeDone`, `aria-pressed`) swaps the list for flat 52px rows whose whole row is the checkbox's label (same checkbox look). Select all / "N selected ✕" chips appear only in this mode. With >= 2 selected the `MobileActionBar` shows "Combine (N)" instead of "+ Create"; leaving the mode or a successful combine clears the selection. Phone toolbar: one sideways-scrolling 40px chip row, then the create form, then full-width 40px search.
- Combine: 2+ selected → `CombinePlacesDialog`: candidates ranked by `transactionCount` desc then earliest `createdAt`; pick lead + final name; `POST /api/places/combine { placeIds, targetPlaceId, name }` → `{ leadPlace, mergedPlacesCount, affectedTransactionsCount }`. Backend rejects a name already used by another place.
- Deleting a place never deletes transactions (`place_id ON DELETE SET NULL`).

## Calendar / Tasks / Reminders screens

- `CalendarScreen`: see calendar module (summary strip, month grid + day/upcoming side column or list via `CalendarTable`, details/create/edit sheet, `ConfirmDialog` delete; phones default to the agenda view; on phones the toolbar is one row with the month title never wrapping and the 4 summary tiles stay on one compact row).
- `TasksScreen`: `useTasksQuery` (no dashboard fallback), period toolbar with grains `day / week / month / quarter / year / all`, summary cards (total, pending, completed, overdue), status filter All / Needs action / Completed, inline edit, `ConfirmDialog` delete, origin column, reminder column (`showReminder`: `ReminderTimesSummary` + `ReminderTargetSummary`, edited inline with compact `ReminderTimesField` + `ReminderTargetFields`; `CreateTaskDialog` has the same two); tasks are DB-only with no Google sync, see `modules/tasks/README.md`. The Home Tasks panel has no connect-Google hint.
- `RemindersScreen` / `CreateReminderDialog`: reminder target (`ReminderTargetFields`; `Call` only for the own private chat) and a `target` column (`showTarget`, this page only) edited inline; see `modules/reminders/README.md#reminder-targets`.
- `RemindersScreen`: `useRemindersQuery`, search, inline edit, confirm delete, and create via `CreateReminderDialog` (toolbar `+ Add reminder` on desktop, `MobileActionBar` on compact; rules in [reminders](../reminders/README.md#web-ui-remindersscreen)).
- Phone toolbars: Tasks status chips in one sideways-scrolling 40px row (`MOBILE_TOOLBAR_ROW`); Tasks/Reminders search full width 40px. Tasks and Reminders create from a toolbar button (desktop) / `MobileActionBar` (compact): `CreateTaskDialog`, `CreateReminderDialog`.
- Mobile list mode (<= 960px; same mapping wherever the table renders, incl. Home): `TasksTable` primary title, trailing due `dd/MM`, secondary status · notes; `RemindersTable` primary title, trailing remind time `dd/MM HH:mm`, secondary notify type · repeat; `CalendarTable` primary title, trailing start, secondary location · description. Edit = the row sheet's footer Edit button (cells render inputs while editing; title inputs do not autofocus on compact). Task status checkbox label has a 40px tap area on compact. Double-click edit stays on desktop.

## Shared UI behavior

- `WorkspaceHeader`: route title/subtitle, money visibility toggle, Refresh (= `queryClient.invalidateQueries()` for all queries), Logout.
- Money visibility (`useMoneyVisibilityStore` Zustand store, `useMoneyVisibility`/`useMoneyFormatter` hooks): default hidden; in-memory only (no `persist`, no `localStorage`), so every page load/F5 resets to hidden; masked as `••••••` in KPIs, tables, tooltips; amount ratio bars in Transactions/Expenses tables are hidden while masked; edit inputs unmasked.
- `DataTable`: column visibility (`zalobot:table-columns:<id>`) and widths (`zalobot:table-widths:<id>`) persisted per table id; `allColumnsKey` + equality guards prevent render loops. `usePeriodFilter` result is memoized.
- `AppNavigation`: 210px docked sidebar (sections Overview, Finance, Planning, Data, System); ≤960px becomes sticky top bar + slide-out drawer. Footer: theme toggle (`useThemeStore`, localStorage, first visit follows system) and vi/en locale selector.

- `DebtAllocationModal`, `AdjustBalanceModal`, `DeleteTransactionModal`, `CombinePlacesDialog`: Dialogs render through the shared `Modal` shell (bottom sheet on mobile, sticky header/actions above the on-screen keyboard); see [web-ui-direction](../../global/web-ui-direction.md#mobile-dialogs--on-screen-keyboard). Screen toasts (Home, Transactions, Places, Tasks, Reminders, Calendar) use the shared `TOAST_POSITION` (bottom-right on desktop; full width above the bottom tab bar on compact screens, offset by `env(safe-area-inset-bottom)`).

## Integration seams

- Dashboard link: user sends `/dashboard` in Zalo → `DashboardToolStrategy` replies with a one-time `/api/access?token=` URL (20 min) → API redirects to `/dashboard#dashboard_token=<access>` (see auth module). There is no callback button.
- HTTP base: relative `/api/...` on localhost / Cloudflare tunnel / ngrok / loca.lt hosts, else `NEXT_PUBLIC_API_URL` (origin without `/api`; route constants already include `/api`). In `next dev` (port `FE_PORT`, default 5173) `/api/*` is rewritten to `NEXT_PUBLIC_API_URL` (default `http://localhost:${NGINX_PORT|3000}`). Production is a static export; Nginx serves it and proxies `/api/*`.

## Known issues

- Home's Transactions panel and the "Balance" KPI still use the dashboard payload (current month; panel ≤20 rows) by design.
- Trend buckets on Transactions only cover loaded rows when a period has more than one page.

## Corner radius

- Buttons, inputs, cards/panels and dialog panels in this module use `rounded-[3px]` (max `rounded`, 4px); no `rounded-lg/xl/2xl`. `rounded-full` only for avatars, status dots, switches, spinners and progress fills. See [web-ui-direction](../../global/web-ui-direction.md).

## Dark-mode buttons

- Primary actions use the sky tone in dark mode (`dark:bg-sky-600 dark:text-white`), never the near-white inverted `dark:bg-slate-100`: create buttons on Places/Tasks/Reminders/Calendar (toolbar and mobile action bar), row primaries in the common tables and the combine-places submit; the Analytics chart/table toggle uses the selected tone; screen toasts use the dark toast tone. See [web-ui-direction](../../global/web-ui-direction.md).
