# Debts Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/debts/README.md)

## Purpose

`apps/web/src/modules/debts` shows the system-wide (shared) receivables and payables (active and settled) on `/debts`, with inline editing, quick full repayment, payment history, and consolidation of several debts under one parent.

## Files

- `api/debts-api.ts`: `getDebts` (`GET API_ROUTES.debts`, no query params), `updateDebt` (`PATCH /api/debts/:id`), `createDebtPayment` (`POST API_ROUTES.debtPayments(debtId)` = `/api/debts/:id/payments`, body without `debtId`, returns the `payment` part of the `{ debt, payment }` response), `combineDebts` (`POST API_ROUTES.debtsCombine` = `/api/debts/combine`), `deleteDebtPayment` (`DELETE API_ROUTES.debtPaymentDetail(debtId, paymentId)`).
- `api/debts-query.ts`: key `['debts']`; `useDebtsQuery`, `useUpdateDebtMutation`, `useCreateDebtPaymentMutation`, `useDeleteDebtPaymentMutation`, `useCombineDebtsMutation`. Every mutation invalidates `['debts']` and `['dashboard']`.
- `presentation/components/debts-screen.tsx`, `debts-table.tsx`, `combine-debts-dialog.tsx` (re-exported via `view/`). `DebtsTable` is also used read-only on the Home overview (`id="home-debts"`).

## API data

- `GET /api/debts?status=active|settled` (`ReportsController` → `FinanceService.listDebts`): unscoped `debtRepo.find` (shared finance store) ordered `occurredAt DESC, createdAt DESC, id DESC`, `take: 200`, with relations contact, payments (+ finance transaction), children (+ contact, payments), parentDebt. The web never sends `status`; filtering is client-side.
- Item (`mapDebt`): `id`, `direction`, `counterparty`, `counterpartyAlias`, `contactId`, `parentDebtId`, `originalAmount`, `remainingAmount`, `status` (fallback from `remainingAmount`), `currency`, `note`, `occurredAt` (falls back to `createdAt`), `dueAt`, `settledAt`, `createdAt`, `updatedAt`, `childCount`, `children[]`, `payments[]` (`id`, `debtId`, `amount`, `paymentDate`, `note`, `financeTransactionId`, `createdAt`).
- Child debts also appear as their own items (with `parentDebtId`); the table shows only roots and renders children inside the parent's expanded panel.

## Screen (`DebtsScreen`)

- Header comes from the private layout `WorkspaceHeader`.
- KPI cards: active receivable total and active payable total (root debts only, `remainingAmount`), masked via `useMoneyFormatter()` (shared Zustand store `apps/web/src/shared/store/money-visibility-store.ts`; also used by `DebtsTable` and `CombineDebtsDialog`).
- Filters: status pills All / Active / Settled with counts (roots), direction pills All / Receivable / Payable, search over counterparty, alias, note (also matches children).
- Status helper: settled when `remainingAmount === 0` or `settledAt` set.
- Table `DebtsTable` (`id="debts"`) columns: `select`, `status` (non-hideable), `direction`, `counterparty` (non-hideable; expand chevron), `originalAmount`, `remainingAmount` (non-hideable; micro progress bar + tooltip when partially paid), `currency`, `dueAt`, `settledAt`, `note`, `actions` (non-hideable, `minWidth: 140px`).
- Inline edit (double-click or Edit; `Enter`/`Escape`): direction, counterparty (datalist `debt-contacts-autocomplete` from `useContactsQuery`, sets `contactId`/alias), original amount, remaining amount, note, due date (sent as `<date>T23:59:59.000Z`). `occurredAt` is not editable from the UI although the API accepts it.
- Quick Repay (`+`, active rows only): calls `createDebtPayment({ debtId, amount: remainingAmount, note })` — always the full remaining amount.
- Expanded panel: child-debt mini grid and payment-history mini grid (amount, date, note, linked-transaction marker, delete). Deleting a payment asks `window.confirm` first.
- Combine: button when 2+ roots selected opens `CombineDebtsDialog` (note, due date; shows errors and disables submit on direction or currency mismatch). Success clears selection and refreshes.
- Screen refresh/retry invalidates `['debts']` and `['contacts']`. No delete-debt action is rendered.

- `CombineDebtsDialog`: Dialogs render through the shared `Modal` shell (bottom sheet on mobile, sticky header/actions above the on-screen keyboard); see [web-ui-direction](../../global/web-ui-direction.md#mobile-dialogs--on-screen-keyboard).

## Backend rules (`FinanceService`)

- `PATCH /api/debts/:id`: editing `remainingAmount` sets `status`/`settledAt` (`settled` at 0); `amount` (alternative) keeps the paid part and rejects values below it.
- `POST /api/debts/:id/payments` (`recordDebtPayment`, one DB transaction): debt must be active and payment ≤ remaining; decrements remaining (settles at 0), creates a finance transaction (receivable → `income` category `Thu hồi nợ`, payable → `expense` category `Trả nợ`, same amount/currency/contact/date), then creates the `debt_payments` row linked to it via `financeTransactionId`. Payments recorded before this change have no link (not backfilled).
- `DELETE /api/debts/:id/payments/:paymentId` (one DB transaction): restores remaining (capped at original), reactivates the debt, recomputes the parent's remaining from its children, deletes the linked finance transaction when `financeTransactionId` is set (manual payments and allocation-originated payments).
- Allocation payments: existing transactions can be allocated to debts via `/api/transactions/:id/allocations` (see dashboard module); those create `debt_payments` with `financeTransactionId`.
- `POST /api/debts/combine` (one DB transaction): ≥2 existing debts, same direction and same currency, else error. Creates a parent with summed original/remaining amounts; children get `parentDebtId` (FK `ON DELETE SET NULL`); existing grandchildren are re-parented to the new parent (one-level tree).
- Contact combine with `consolidateDebts: true` reuses `combineDebts` per direction + currency group (see contacts module).

## Known issues

- The list is capped at 200 debts (children included) with no pagination.
