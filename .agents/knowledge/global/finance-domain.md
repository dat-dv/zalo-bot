---
metadata:
  agent-artifact:
    id: global-finance-domain-knowledge
    type: documentation
    depends_on:
      - apps/api/src/finance/finance.service.ts
      - apps/api/src/finance/transaction-item.mapper.ts
      - apps/api/src/finance/finance.controller.ts
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/database/entities/finance-place.entity.ts
      - apps/api/src/database/entities/finance-transaction.entity.ts
      - apps/api/src/database/entities/debt.entity.ts
      - apps/api/src/database/entities/debt-payment.entity.ts
      - apps/api/src/database/entities/debt-payment-allocation.entity.ts
      - apps/api/src/zalo/text/text-tool.definitions.ts
      - apps/api/src/zalo/text/text-input.service.ts
      - apps/api/src/zalo/text/strategies/record-transaction-tool.strategy.ts
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
      - packages/contracts/src/index.ts
      - apps/api/src/finance/ledger.service.ts
      - apps/api/src/finance/finance-data-mover.ts
      - apps/api/src/finance/receipt-source.ts
      - apps/api/src/database/migrations/1724780000000-AddSharedLedgerAndTransactionCreator.ts
---

# Finance Domain (Backend)

Owner: Core Engineering Team · Status: active

Human guide: [Finance Domain](../../docs/global/finance-domain.md).

## Purpose

`apps/api/src/finance` (`FinanceService`, `FinanceController`) owns caller-scoped income/expense transactions, places, debt contacts, debts, debt payments, transaction-to-debt allocations, and user categories. It is backend-only; there is no `apps/web/src/modules/finance`. Web UX lives in the dashboard module docs.

## Shared ledger (single ledger owner)

- `users.is_ledger_owner` (unique partial index: at most one owner). `LedgerService.resolveLedgerUserId(actorId)` returns the owner id when set, else `actorId` (per-user ledgers, backward compatible). Owner id cached in memory; `setOwner` refreshes it.
- With an owner, ALL finance data (transactions, places, contacts, debts, payments, allocations, categories) is read and written under the owner's `user_id`:
  - Dashboard: `FinanceController.ledgerUserId(req)` for every finance route; `ReportsController` dashboard finance block, `/contacts`, `/debts`, `/expenses`.
  - Zalo chat: 8 strategies (record, manage-debt, create-place, delete, today, get-report, finance-quick, debts-quick) resolve the ledger from `senderId`; `TransactionConfirmationService` re-resolves `payload.userId` / `pending.userId` at commit, so cards queued before an owner was set still land in the shared ledger. Who may confirm a card is unchanged (`pending.userId` = sender).
  - Not shared: reminders, Google Tasks/Calendar, Drive/Photos uploads (sender's Google token), admin role.
- Any user allowed to use the bot sees the same shared ledger on the dashboard.
- Admin API: `GET /finance/ledger` → `ILedgerInfo` (owner + every other `user_id` found in finance tables, incl. ids without a users row, with counts); `PATCH /finance/ledger/owner` `{ userId | null }`; `POST /finance/ledger/consolidate` → `ILedgerConsolidateResult`.
- Consolidation (one DB transaction, audit-logged, no user deleted): backfill `created_by_user_id = user_id` where null, then `moveFinanceData(manager, source, owner)` for every other ledger. `moveFinanceData` (`finance-data-mover.ts`) de-duplicates places (normalized name), contacts (name + alias) and categories (type + name), then repoints transactions, debts, payments, allocations. `UserMergeService` reuses it (plus `linkedUserId` / `createdByUserId` remap, since an identity merge is the same person).

## Transaction creator and receipt

- `finance_transactions` columns: `created_by_user_id`, `created_by_name` (display-name snapshot), `source` (`zalo` | `dashboard`), `source_chat_id` (Zalo thread). Chat writes sender id/name + chat id; dashboard writes the signed-in user + `source = 'dashboard'`. Older rows are null (shown as "—"), except after consolidation (`created_by_user_id` backfilled).
- DTO (`toTransactionItems`): `createdByName` = current `users.firstName` of the creator (batched lookup), fallback snapshot; `sourceChatName`/`sourceChatType` from `zca_thread_configs` (batched); `hasReceipt` — the raw `receiptUrl` is never sent to the web.
- `GET /transactions/:id/receipt` streams the image: auth via Bearer or the dashboard refresh cookie (`getDashboardUserIdFromBrowser`, so `<img src>` works); row must belong to the caller's ledger (else 404). `parseReceiptSource`: Drive link → `GoogleDriveService.downloadFile(fileId, createdByUserId || userId)`; Zalo CDN (`https`, host ending `.zadn.vn`, `.zdn.vn`, `.zalo.me`, `.zaloapp.com`) → server fetch (10 s timeout); any other host → 404 (no open proxy/SSRF). Max 10 MB, only `image/*` relayed, `Cache-Control: private, max-age=3600`.
- `getLatestTransaction(ledger, senderId)` prefers the sender's own latest row so "xoá giao dịch vừa tạo" never picks another member's row.

## Data model

| Table | Notes |
| --- | --- |
| `finance_transactions` | `type` income/expense, positive integer `amount` (VND), `currency` default `VND`, `category` default `Khác`, required `note`, `occurredAt` default now, optional `paymentMethod`, `receiptUrl`, `contact_id`, `place_id`. |
| `finance_places` | Merchant/venue. Unique `(user_id, normalized_name)` (`UQ_finance_places_user_normalized_name`). Distinct from debt contacts. |
| `debt_contacts` | People/counterparties. Lookup by normalized name (+ optional normalized alias), exact match. |
| `debts` | `direction` receivable/payable, `originalAmount`, `remainingAmount`, `status` active/settled, `settledAt`, optional `parent_debt_id` (self-reference). |
| `debt_payments` | Repayments; optional `finance_transaction_id`. |
| `debt_payment_allocations` | Links a transaction amount to a debt. |
| `user_categories` | Per-user income/expense category list. |

Foreign keys: `finance_transactions.place_id` and `.contact_id` -> `ON DELETE SET NULL` (deleting a place/contact never deletes history); `debts.contact_id` and `debts.parent_debt_id` -> `SET NULL`; `debt_payments.debt_id` -> `CASCADE`, `.finance_transaction_id` -> `SET NULL`; allocations -> `CASCADE` on both transaction and debt.

Identity normalization (`normalizeIdentity`): NFD, strip diacritics, `vi-VN` lowercase, non-letter/digit runs -> single space, trim. Used for places and contacts.

## REST API (all under `/api`, dashboard access token, caller-scoped)

### Transactions
- `GET /transactions` — query `type?`, `startAt?`, `endAt?` (ISO; `startAt <= endAt`), `search?` (ILIKE on category, note, place name), `limit?` (default 100, max 500), `offset?`. Invalid params → 400. Returns `ITransactionListResponse { items, total, limit, offset, summary, ledgerBalance }` ordered `occurredAt, createdAt, id` DESC. `items[].runningBalance` = wallet balance after that row computed over the caller's whole ledger in chronological order (`computeLedger`), independent of filters/paging. `summary { income, expense, count }` covers the period only (ignores `type`/`search`). `ledgerBalance` = all-time income − expense (`getLedgerBalance`, also exposed as dashboard `finance.ledgerBalance`). Entity → DTO mapping shared with the dashboard via `toTransactionItem`. `listTransactions` (newest 200) remains for the chat `DELETE_TRANSACTION` tool.
- `GET/PATCH/DELETE /transactions/:id`, `POST /transactions`.
- Body accepts `placeId` or `placeName`. `placeId` must belong to caller; `placeName` resolves-or-creates a place; `placeId: null` unlinks.
- `PATCH` guards: cannot change `type` while allocations exist; new `amount` cannot be below allocated sum.
- `DELETE` (not one DB transaction): for each allocation, `debt.remainingAmount += allocation.amount`; deletes the transaction's allocations and linked `debt_payments`; removes the transaction. Debt `status`/`settledAt` are not recomputed on this path.

### Allocations (transactional)
- `GET /transactions/:id/candidate-debts` — debts with matching direction (income->receivable, expense->payable), filtered to the transaction's `contactId` if set; `remainingAmount` reported as remaining + already allocated by this transaction.
- `GET /transactions/:id/allocations`.
- `POST /transactions/:id/allocations` body `{ allocations: [{ debtId, amount, note? }] }` — replaces the full allocation set: reverts old allocations, deletes old allocations and linked payments, validates (no duplicate debt, total <= transaction amount, direction parity, amount <= debt remaining), writes allocation + `debt_payments` row per item, recomputes status/settledAt. Returns `{ allocations, remainingUnallocated }`.
- `DELETE /transactions/:id/allocations/:allocationId` — restores debt remaining, reactivates debt, deletes matching payment.

### Places
- `GET /places` (max 200, ordered by name, with `transactionCount`), `POST /places` (resolve-or-create by normalized name), `PATCH /places/:id` (rejects duplicate normalized name), `DELETE /places/:id`.
- `POST /places/combine` body `placeIds` / `targetPlaceId` / `sourcePlaceIds` / `name` (>= 2 distinct ids). Lead = `targetPlaceId`, else most transactions then oldest. Rejects a `name` colliding with a place outside the merge set. Reassigns transactions, removes sources, renames lead. Not wrapped in a DB transaction.

### Contacts
- `GET /contacts` lives in `ReportsController` (max 200, with `debtCount`, `transactionCount`, `linkedUser`). `GET/PATCH/DELETE /contacts/:id`, `POST /contacts` in `FinanceController`. Changing `linkedUserId` is admin-only and validated (exists, not owner, unique per owner) — see contacts module.
- `POST /contacts/combine` (>= 2 ids). Lead = `targetContactId`, else: has `linkedUserId` > most debts+transactions > oldest. Lead inherits missing linked user, phone, bank account (+code/name), avatar. Reassigns debts (also rewrites `counterparty`/`counterpartyAlias`) and transactions, removes sources. Optional `consolidateDebts: true` then calls `combineDebts` per direction+currency group of >= 2 top-level debts. `combineContacts` itself is NOT one DB transaction; only each nested `combineDebts` is.

### Debts
- `GET /debts?status=active|settled` (`ReportsController`): up to 200, no status = all; includes children/payments.
- `GET/PATCH/DELETE /debts/:id`, `POST /debts`.
- `POST /debts` requires `contactId` (owned) or `createNewContact: true`; otherwise error. `counterparty` is copied from the contact.
- `PATCH` with `remainingAmount` sets status (0 -> settled); with `amount` rebases original while keeping paid portion (cannot drop below paid).
- `POST /debts/combine` (transactional): >= 2 owned debts, same direction, same currency. Creates a parent debt (sums original/remaining, latest `occurredAt`, first `dueAt`), re-parents the children and any grandchildren.

### Debt payments
- `GET /debts/:id/payments`, `POST /debts/:id/payments` body `{ amount, paymentDate?, note? }`, `DELETE /debts/:id/payments/:paymentId`.
- Record (transactional): debt must be active, amount <= remaining; writes payment, reduces remaining (0 -> settled), and creates a cashflow transaction (`income`/`Thu hồi nợ` for receivable, `expense`/`Trả nợ` for payable). The payment row stores that transaction's id in `finance_transaction_id` (older payments are not backfilled).
- Delete (transactional): restores remaining (capped at original), reactivates; recomputes parent remaining from children; removes the linked transaction only if `finance_transaction_id` is set.
- Web route constants: `API_ROUTES.debtPayments(debtId)`, `API_ROUTES.debtPaymentDetail(debtId, paymentId)`.

### Categories
- `GET /categories?type=` seeds defaults on first call when the user has none (`seedDefaultCategories`, `isDefault: true`) from `DEFAULT_EXPENSE_CATEGORIES` / `DEFAULT_INCOME_CATEGORIES` in `@zalobot/contracts`.
- `POST /categories` (`type`, `name`, `color?`, `icon?`; unique per user+type+name), `PATCH /categories/:id`, `DELETE /categories/:id`.
- Transactions store category as free text; categories are not foreign keys.

### Balance adjustment
- No dedicated endpoint. `Điều chỉnh số dư` is a default category of both types (i18n key `category.balanceAdjustment`). The web adjust-balance modal posts a normal transaction: positive diff -> `income`, negative -> `expense`, amount = |diff|.

### Analytics
- `GET /finance/analytics?startAt&endAt&grain` (`AnalyticsGrain`: day/week/month/quarter/year/all; default `month`).
- Returns `summary` (income, expense, balance, `netSavingsRate`, receivable/payable totals), `currentPosition` (all-time cashflow balance, receivable, payable, `netWorth`), `trend`, `categories` keyed by `${type}:${category}` with per-type percentage, `debts` (top receivables/payables from active top-level debts).
- Trend buckets: `week` = 7 weekday buckets T2..CN; `month` = 6 day ranges (1-5 … 26-end); `quarter` = 3 months; anything else = 12 months. Running balance starts from the opening balance before `startAt`.

## Zalo chat integration (LLM tools)

Tools from `ZALO_TOOL_DEFINITIONS` relevant to finance (see [LLM Providers](llm-providers.md)):
- `RECORD_TRANSACTION` (type, amount, category, note, occurredAt, placeName, paymentMethod, receiptUrl) -> pending confirmation; on confirm `FinanceService.createTransaction`.
- If `placeName` matches no existing place (`resolvePlaces`) and no pending place exists, `RecordTransactionToolStrategy` also queues a separate `CREATE_PLACE` confirmation (`createPendingPlace`). Confirming the transaction auto-recalls and drops the companion place card; the place is still created by `createTransaction` via `resolveOrCreatePlace`.
- `CREATE_PLACE` (name) -> pending confirmation unless the place exists.
- `DELETE_TRANSACTION` (transactionId or query; UUID also extracted from raw text; "gần nhất/mới nhất" -> latest) -> pending confirmation -> `deleteTransaction`.
- `MANAGE_DEBT` (direction, counterparty, amount, note, occurredAt, dueAt) (+ optional `counterpartyAlias`) -> `ManageDebtToolStrategy` resolves the contact with `resolveContacts` (exact normalized name/alias): 1 match -> `contactId`; 0 -> `createNewContact: true`; >1 -> no card, bot lists `Name (alias)` options and asks the user to resend with the alias -> pending confirmation -> `createDebt`.
- `GET_REPORT` (grain day/month/year) for chat summaries.
- No LLM tool exists for allocations, contacts, categories, or combine operations (dashboard only).
- No call coalescing. Multiple tool calls run sequentially; `TextInputService.propagateSharedTransactionContext` copies a single shared `occurredAt`, and (when times agree) a single shared `placeName`/`paymentMethod`, to sibling `RECORD_TRANSACTION` calls missing them.
- Fast-path commands `/finance` (today summary) and `/debts` (active debts) read directly without LLM.
