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
      - apps/api/src/finance/receipt-source.ts
      - apps/api/src/database/migrations/1724780000000-AddSharedLedgerAndTransactionCreator.ts
      - apps/api/src/database/migrations/1724790000000-RemoveFinanceUserScope.ts
      - apps/api/src/database/audit-log.subscriber.ts
---

# Finance Domain (Backend)

Owner: Core Engineering Team · Status: active

Human guide: [Finance Domain](../../docs/global/finance-domain.md).

## Purpose

`apps/api/src/finance` (`FinanceService`, `FinanceController`) owns the single, system-wide store of income/expense transactions, places, debt contacts, debts, debt payments, transaction-to-debt allocations, and user categories. It is backend-only; there is no `apps/web/src/modules/finance`. Web UX lives in the dashboard module docs.

## Single shared finance store

- **Rule**: the system has exactly ONE finance store. Every user (any dashboard login, any Zalo ID messaging the bot) reads and writes ALL finance data. There is no per-user ledger and no "ledger owner".
- Finance tables have **no `user_id`**: `finance_transactions`, `finance_places`, `debt_contacts`, `debts`, `debt_payments`, `debt_payment_allocations`, `user_categories`. `FinanceService` methods take no user argument and never filter by user. `users.is_ledger_owner`, `LedgerService`, `finance-data-mover.ts` and the `/finance/ledger*` admin API were removed.
- Who did it is display-only: `finance_transactions.created_by_user_id` / `created_by_name` / `source` / `source_chat_id` (see below). Never used as a filter.
- Still per user (not finance): reminders, Google Tasks/Calendar, Drive/Photos uploads (sender's Google token), pending confirmation cards (`pending.userId` = sender), admin role, audit `actor_id`.
- Dashboard finance routes still require a signed-in user (`FinanceController.authenticate(req)` → Bearer token, 401 otherwise); authentication only, not scoping.
- Audit: `AuditLogSubscriber` sets `actor_id` = row `userId`, else `createdByUserId` (finance rows have no owner), so dashboard activity still shows the transactions a user created.
- Migration `1724790000000-RemoveFinanceUserScope` (plain SQL, one transaction, idempotent guard on `finance_transactions.user_id`): backfill `created_by_user_id = user_id` where null; fold duplicates across old ledgers — places by `normalized_name` (repoint `finance_transactions.place_id`), contacts by `normalized_name + COALESCE(normalized_alias,'')` (keeper = earliest, inherits missing phone/avatar/linked user; repoint `debts.contact_id`, `finance_transactions.contact_id`), categories by `type + lower(trim(name))`; keep only the earliest contact link per `linked_user_id`; write one `audit_logs` row (`operation: remove-finance-user-scope`, per-ledger counts before); drop `user_id` (+ indexes) on the 7 tables, add unique `UQ_finance_places_normalized_name`; drop `users.is_ledger_owner`. `down()` restores empty columns only — the old split needs the pre-migration backup.

## Transaction creator and receipt

- `finance_transactions` columns: `created_by_user_id`, `created_by_name` (display-name snapshot), `source` (`zalo` | `dashboard`), `source_chat_id` (Zalo thread). Chat writes sender id/name + chat id; dashboard writes the signed-in user + `source = 'dashboard'`. Rows older than creator tracking got `created_by_user_id` backfilled from their former `user_id` by the migration; `created_by_name` may be null (UI falls back to the user's current name or "—").
- DTO (`toTransactionItems`): `createdByName` = current `users.firstName` of the creator (batched lookup), fallback snapshot; `sourceChatName`/`sourceChatType` from `zca_thread_configs` (batched); `hasReceipt` — the raw `receiptUrl` is never sent to the web.
- `GET /transactions/:id/receipt` streams the image: auth via Bearer or the dashboard refresh cookie (`getDashboardUserIdFromBrowser`, so `<img src>` works); any signed-in user may view it (404 when the row or receipt is missing). `parseReceiptSource`: Drive link → `GoogleDriveService.downloadFile(fileId, createdByUserId)` (404 when no creator: only the creator's Google token can read their Drive); Zalo CDN (`https`, host ending `.zadn.vn`, `.zdn.vn`, `.zalo.me`, `.zaloapp.com`) → server fetch (10 s timeout); any other host → 404 (no open proxy/SSRF). Max 10 MB, only `image/*` relayed, `Cache-Control: private, max-age=3600`.
- `getLatestTransaction(senderId)` prefers the sender's own latest row (by `created_by_user_id`) so "xoá giao dịch vừa tạo" never picks another member's row; falls back to the newest row overall.

## Data model

| Table | Notes |
| --- | --- |
| `finance_transactions` | `type` income/expense, positive integer `amount` (VND), `currency` default `VND`, `category` default `Khác`, required `note`, `occurredAt` default now, optional `paymentMethod`, `receiptUrl`, `contact_id`, `place_id`. |
| `finance_places` | Merchant/venue. Unique `normalized_name` (`UQ_finance_places_normalized_name`). Distinct from debt contacts. |
| `debt_contacts` | People/counterparties, one shared directory. Lookup by normalized name (+ optional normalized alias), exact match. |
| `debts` | `direction` receivable/payable, `originalAmount`, `remainingAmount`, `status` active/settled, `settledAt`, optional `parent_debt_id` (self-reference). |
| `debt_payments` | Repayments; optional `finance_transaction_id`. |
| `debt_payment_allocations` | Links a transaction amount to a debt. |
| `user_categories` | Shared income/expense category list (table name kept). Seeded with defaults when empty. |

Foreign keys: `finance_transactions.place_id` and `.contact_id` -> `ON DELETE SET NULL` (deleting a place/contact never deletes history); `debts.contact_id` and `debts.parent_debt_id` -> `SET NULL`; `debt_payments.debt_id` -> `CASCADE`, `.finance_transaction_id` -> `SET NULL`; allocations -> `CASCADE` on both transaction and debt.

Identity normalization (`normalizeIdentity`): NFD, strip diacritics, `vi-VN` lowercase, non-letter/digit runs -> single space, trim. Used for places and contacts.

## REST API (all under `/api`, dashboard access token required, data is system-wide)

### Transactions
- `GET /transactions` — query `type?`, `startAt?`, `endAt?` (ISO; `startAt <= endAt`), `search?` (ILIKE on category, note, place name), column filters `categories?` (exact, OR), `note?` (ILIKE), `placeIds?` (OR; `none` = no place, its own OR branch), `createdByUserIds?` (OR), `hasReceipt?` (`true|false`; blank `receipt_url` = no receipt), `amountMin?`/`amountMax?` (integers ≥ 0, min ≤ max) — lists accept repeated keys, ≤ 50 values each; all filters AND together and with `search` (a column filter and the search branch on the same column are combined with TypeORM `And`), `limit?` (default 100, max 500), `offset?`. Invalid params → 400. Returns `ITransactionListResponse { items, total, limit, offset, summary, ledgerBalance, facets }` ordered `occurredAt, createdAt, id` DESC. `items[].runningBalance` = wallet balance after that row computed over the whole shared ledger in chronological order (`computeLedger`), independent of filters/paging. `summary { income, expense, count }` covers the period only (ignores `type`/`search`/column filters). `facets { creators: { id, name }[], categories: string[] }` = filter options over the period only (also ignores filters, so dropdowns do not shrink); creator name = current `users.firstName`, else `createdByName` snapshot, else `''` (web labels it `table.columnFilter.unknownCreator` "Không rõ tên (…<last 4 of id>)"; unnamed creators sort last); both come from the same ledger-row load (no extra transaction query). `ledgerBalance` = all-time income − expense (`getLedgerBalance`, also exposed as dashboard `finance.ledgerBalance`). Entity → DTO mapping shared with the dashboard via `toTransactionItem`. `listTransactions` (newest 200) remains for the chat `DELETE_TRANSACTION` tool.
- `GET/PATCH/DELETE /transactions/:id`, `POST /transactions`.
- Body accepts `placeId` or `placeName`. `placeId` must exist; `placeName` resolves-or-creates a place; `placeId: null` unlinks.
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
- `GET /contacts` lives in `ReportsController` (max 200, with `debtCount`, `transactionCount`, `linkedUser`). `GET/PATCH/DELETE /contacts/:id`, `POST /contacts` in `FinanceController`. Changing `linkedUserId` is admin-only and validated (user exists, not linked to another contact) — see contacts module.
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
- `POST /categories` (`type`, `name`, `color?`, `icon?`; unique per type+name), `PATCH /categories/:id`, `DELETE /categories/:id`.
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
