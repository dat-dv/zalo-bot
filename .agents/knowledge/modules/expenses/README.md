# Expenses Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/expenses/README.md)

## Purpose

`apps/web/src/modules/expenses` contains an expense-only history screen and its data layer. **The screen is not routed**: `/expenses` redirects to `/transactions?type=expense` (and `/income` to `/transactions?type=income`) via `app/(private)/expenses/page.tsx` and `income/page.tsx`. Expense browsing in the product happens in the dashboard module's `TransactionsScreen`. The module is kept as code; its query key `['expenses']` is still invalidated by transaction, place, and contact mutations elsewhere.

## Files

- `api/expenses-api.ts`: `getExpenses` (`GET API_ROUTES.expenses`), `updateExpense` (`PATCH /api/transactions/:id`, `IUpdateExpenseRequest`), `deleteExpense` (`DELETE /api/transactions/:id`).
- `api/expenses-query.ts`: key `['expenses']`; `useExpensesQuery`, `useUpdateExpenseMutation`, `useDeleteExpenseMutation`. Both mutations invalidate `['expenses']`, `['transactions']`, `['dashboard']`.
- `presentation/components/expenses-screen.tsx` (re-exported via `view/expenses-screen.tsx`): `ExpensesScreen`.

## API data

`GET /api/expenses` (`ReportsController` → `FinanceService.listExpenses`): caller-scoped `type = expense`, ordered `occurredAt DESC`, `take: 200`. Returns only `id`, `category`, `note`, `amount`, `occurredAt`.

## `ExpensesScreen` behavior (if mounted)

- `usePeriodFilter('month')` + `PeriodFilterToolbar` with its default grains `week / month / quarter / year` (no `all` button). Period filtering is client-side over the ≤200 loaded rows.
- `TrendSummaryStrip` (expense total + buckets) plus a category-count card.
- Category filter `<select>` (categories present in the period) and search over category/note.
- `DataTable` `id="expenses"` columns: `category` (non-hideable), `note`, `amount` (non-hideable; proportional bar vs period max), `paymentMethod`, `currency`, `occurredAt`, `actions` (non-hideable).
- Inline edit: category (datalist `expense-categories-autocomplete` from `useCategoriesQuery('expense')`, loaded expense categories, `DEFAULT_EXPENSE_CATEGORIES`), note, amount (>0), payment method, occurredAt. Delete uses `window.confirm`.
- Money masked via `useMoneyFormatter()`; inputs stay unmasked. Error banner Retry invalidates `['expenses']` and `['categories']`.

## Known issues

- `paymentMethod` and `currency` columns always show "not set"/`VND` because `GET /api/expenses` does not return those fields (the entity and `PATCH /api/transactions/:id` do support `paymentMethod`).
- 200-row cap; periods older than the newest 200 expenses appear empty.
