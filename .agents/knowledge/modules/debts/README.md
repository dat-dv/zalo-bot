# Debts Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/debts/README.md)

## Purpose

`apps/web/src/modules/debts` shows the system-wide (shared) receivables and payables (active and settled) on `/debts`, with create, inline editing, delete, quick full repayment, payment history, and consolidation of several debts under one parent.

## Files

- `api/debts-api.ts`: `getDebts` (`GET API_ROUTES.debts`, no query params), `createDebt` (`POST API_ROUTES.debts`, body `ICreateDebtRequest`), `deleteDebt` (`DELETE /api/debts/:id`), `updateDebt` (`PATCH /api/debts/:id`), `createDebtPayment` (`POST API_ROUTES.debtPayments(debtId)` = `/api/debts/:id/payments`, body without `debtId`, returns the `payment` part of the `{ debt, payment }` response), `combineDebts` (`POST API_ROUTES.debtsCombine` = `/api/debts/combine`), `deleteDebtPayment` (`DELETE API_ROUTES.debtPaymentDetail(debtId, paymentId)`).
- `api/debts-query.ts`: key `['debts']`; `useDebtsQuery`, `useCreateDebtMutation`, `useDeleteDebtMutation`, `useUpdateDebtMutation`, `useCreateDebtPaymentMutation`, `useDeleteDebtPaymentMutation`, `useCombineDebtsMutation`. Every mutation invalidates `['debts']` and `['dashboard']`; create/delete also invalidate `['contacts']` (create may add a person).
- `model/debt-create-form.ts` (pure, unit-tested): `matchContact` (exact case-insensitive match on display name or alias, shared with the inline edit), `buildCreateDebtRequest` (draft → `ICreateDebtRequest` or error `counterpartyRequired` | `amountInvalid` | `newContactRequired`); the due date uses the shared `dueDateToIso` (`apps/web/src/shared/lib/local-date-input.ts`).
- `presentation/components/create-debt-dialog.tsx`: create form on the shared `FormDialog` (`apps/web/src/shared/ui/form-dialog.tsx`).
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
- Create: `+ Add debt` toolbar button (desktop) / `MobileActionBar` (compact, when fewer than 2 rows are selected) opens `CreateDebtDialog`: direction chips (default receivable), person (same datalist), amount (> 0), occurred-at (`datetime-local`, default now), due date (optional, `<date>T23:59:59.000Z`), note. A name matching a contact sends `contactId` with the stored name/alias. An unmatched name shows a "create new person «name»" checkbox (+ optional alias); Save stays disabled until it is ticked, then `createNewContact: true` is sent. API errors stay inside the dialog.
- Delete: the row/sheet `✕` action (`debts.actions.delete`) opens `ConfirmDialog` (not `window.confirm`) naming person and original amount, plus warnings when the debt has payments (deleted with it) or children (split off). On success the id leaves the selection, inline edit closes if it was that row, toast; failures show as a toast.
- Screen refresh/retry invalidates `['debts']` and `['contacts']`.

- `CombineDebtsDialog`: Dialogs render through the shared `Modal` shell (bottom sheet on mobile, sticky header/actions above the on-screen keyboard); see [web-ui-direction](../../global/web-ui-direction.md#mobile-dialogs--on-screen-keyboard).

## Compact / phone layout

Desktop (> 960px) is unchanged. See [Mobile List Mode](../../global/web-ui-direction.md#mobile-list-mode-datatable-compact--960px).

- **List mapping** (`DebtsTable`, also on Home): primary `counterparty` (+ ` · alias`, prefixed `✓ ` when selected), trailing `remainingAmount` (masked via `useMoneyFormatter`, colored like the cell: emerald receivable / amber payable / slate when 0), secondary direction · status · due date (+ `debts.paidPercent` when partially paid). On compact the direction column precedes status so the row reads in that order; the expand chevron is hidden because the sheet always shows sub-details.
- **Detail sheet**: every column via `cell`; footer = Select toggle (see below), Repay, Edit, Delete (`✕`). Edit switches the sheet cells to the inline inputs (40px), including `type="date"` due date; Save/✕ in the footer. Double-click editing stays desktop-only.
- **Sub-details in the sheet** (`renderExpandedRow`, `useIsCompact`): child debts and payment history render as flat two-line lists (min 52px, `border-b`) instead of nested horizontal tables; each payment row has a 40×40px delete button (still `window.confirm`).
- **Selection on compact**: list rows are one button, so the `select` checkbox column is dropped and the sheet footer gets a `debts.selectOne` / `debts.deselectOne` toggle (`aria-pressed`). Toolbar Select all / clear-selection chips still work. `MobileActionBar` always shows one action: Combine with >= 2 selected, otherwise `+ Add debt`; the toolbar copies are `max-[960px]:hidden`.
- **Toolbar (<= 640px)**: no sideways scrolling. Status (All / Active / Settled) and direction (All / Receivable / Payable) are two full-width 3-segment rows (`grid-cols-3`, 32px `PHONE_CHIP`, `aria-pressed`, groups labelled `debts.columns.status` / `dashboard.columns.direction`; the "all" segment uses the short `table.filter.all`, desktop keeps `debts.filter.allStatus` / `allDirections`), then a full-width 36px search (`PHONE_TOOLBAR_INPUT`), then the selection chips (Select all / Selected n ✕) in a wrapping row (`order-last`). Reason: in the old single scrolling row the Settled filter sat off-screen. Toast uses `TOAST_POSITION`; Retry is 40px.
- **CombineDebtsDialog**: `phoneLayout="fullscreen"`; ✕ `MODAL_CLOSE_TAP`; footer buttons `MODAL_FOOTER_TAP`; inputs `TAP_INPUT`; the selected-debts table's `max-h-40` scroll box becomes `max-sm:max-h-none max-sm:overflow-visible` so only the panel scrolls.

## Backend rules (`FinanceService`)

- `POST /api/debts` (`createDebt`): requires `direction`, `counterparty`, `amount`, plus either an existing `contactId` or `createNewContact: true` (creates the contact from name/alias); otherwise it throws (surfaces as a server error, so the dialog blocks it client-side). `occurredAt` defaults to now.
- `DELETE /api/debts/:id` (`deleteDebt`): hard delete. Payments and transaction allocations cascade (FK `ON DELETE CASCADE`), but the income/expense transactions those payments created are NOT deleted (unlike `DELETE …/payments/:id`), so they stay in the ledger; children of a combined parent get `parentDebtId = NULL` and reappear as roots. Remaining amounts of other debts are not recomputed.

- `PATCH /api/debts/:id`: editing `remainingAmount` sets `status`/`settledAt` (`settled` at 0); `amount` (alternative) keeps the paid part and rejects values below it.
- `POST /api/debts/:id/payments` (`recordDebtPayment`, one DB transaction): debt must be active and payment ≤ remaining; decrements remaining (settles at 0), creates a finance transaction (receivable → `income` category `Thu hồi nợ`, payable → `expense` category `Trả nợ`, same amount/currency/contact/date), then creates the `debt_payments` row linked to it via `financeTransactionId`. Payments recorded before this change have no link (not backfilled).
- `DELETE /api/debts/:id/payments/:paymentId` (one DB transaction): restores remaining (capped at original), reactivates the debt, recomputes the parent's remaining from its children, deletes the linked finance transaction when `financeTransactionId` is set (manual payments and allocation-originated payments).
- Allocation payments: existing transactions can be allocated to debts via `/api/transactions/:id/allocations` (see dashboard module); those create `debt_payments` with `financeTransactionId`.
- `POST /api/debts/combine` (one DB transaction): ≥2 existing debts, same direction and same currency, else error. Creates a parent with summed original/remaining amounts; children get `parentDebtId` (FK `ON DELETE SET NULL`); existing grandchildren are re-parented to the new parent (one-level tree).
- Contact combine with `consolidateDebts: true` reuses `combineDebts` per direction + currency group (see contacts module).

## Known issues

- The list is capped at 200 debts (children included) with no pagination.

## Buttons

- Colours come from `BUTTON_TONE`; cursor, disabled dimming, focus outline and transitions come from the base layer, so buttons here never re-spell them. Create (toolbar and mobile action bar), the combine-debts submit and the `DebtsTable` row primary are `primary`; status/direction filters (`filterChipClass`) and the create-dialog chips are `chip`/`chipSelected`; debt and payment delete are `dangerSoft`; Retry is `danger`. The screen toast uses the dark toast tone. See [web-ui-direction](../../global/web-ui-direction.md#button-interaction-states).
