---
metadata:
  agent-artifact:
    id: module-savings-knowledge
    type: documentation
    depends_on:
      - apps/api/src/finance/savings.service.ts
      - apps/api/src/finance/savings.controller.ts
      - apps/api/src/finance/saving-ledger.ts
      - apps/api/src/database/entities/saving-group.entity.ts
      - apps/api/src/database/entities/saving-movement.entity.ts
      - apps/api/src/database/migrations/1725000000000-AddSavingGroups.ts
      - apps/web/src/modules/savings/presentation/components/savings-screen.tsx
      - apps/web/src/shared/store/include-savings-store.ts
      - packages/contracts/src/index.ts
---

# Savings Module

Owner: Core Engineering Team · Status: active

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/savings/README.md)

## Purpose

Savings groups hold money that should not count as spendable, without recording it as an expense. Recording savings as an expense inflates spending and lowers `netSavingsRate`, so a move between the wallet and a group is its own record. Dashboard only: there is no Zalo tool, card or chat line for savings.

Savings follow the shared ledger: no `user_id`, every signed-in user sees every group. Hiding means **out of the wallet balance**, not hidden from other users.

## Data

- `saving_groups`: `name`, unique `normalized_name` (`normalizeIdentity`; archived groups keep their name reserved), `note`, `archived_at`, `created_by_user_id`, `created_by_name`.
- `saving_movements`: `group_id` (FK `RESTRICT`), `type`, `amount` (positive integer VND), `occurred_at`, `note`, creator columns. Not in `finance_transactions`: ledger code treats every non-income row as an expense.

| Type | Wallet | Savings | Use |
| --- | --- | --- | --- |
| `deposit` | − amount | + amount | Move money into a group |
| `withdrawal` | + amount | − amount | Move money back; spending it is a separate expense |
| `opening` | unchanged | + amount | Money saved before the app |

## Rules

- Withdrawal cannot exceed the group balance. Add and remove lock the group row (`pessimistic_write`), so concurrent withdrawals cannot overdraw.
- A deposit may exceed the wallet balance: the wallet may already be negative.
- Movements are not edited: delete and add again. Removing one is refused if it would leave the group negative.
- Archived groups take no new or removed movements. Only a group with balance 0 can be archived. Groups are never deleted.

## API (`SavingsController`, dashboard access token required)

- `GET /saving-groups` → `ISavingGroupListResponse { groups, savingsTotal, ledgerBalance }`; `POST` creates.
- `GET/PATCH /saving-groups/:id`; `DELETE` archives (409 while it holds money).
- `GET/POST /saving-groups/:id/movements`; `DELETE /saving-groups/:id/movements/:movementId`.
- Conflicts return 409 with a Vietnamese message the web shows as is. Ids go through `ParseUUIDPipe`.

Balance effects on other APIs: see [Finance Domain](../../global/finance-domain.md#wallet-balance-and-savings).

## UI (`/savings`)

- Navigation: Finance section of the sidebar and the phone More sheet, available to every signed-in user.
- Metrics: wallet balance, total savings, wallet + savings. Amounts use the money visibility toggle.
- `DataTable` of groups (`saving_groups`), archived hidden unless "Show archived groups" is on. Phone: list row with a detail sheet holding the actions.
- Row actions: deposit, withdraw (off at balance 0), opening balance, history, edit, archive (off while it holds money). Archived rows keep history only.
- Movement dialog: amount, date-time (default now), note. Withdrawal shows the group balance and blocks a higher amount.
- History dialog: movements newest first, delete with confirm; a refusal shows above the list.
- Load failure uses `SessionStateScreen` like other pages.

## "Include savings" toggle

`useIncludeSavingsStore`: in-memory, off on every page load, display only. Shown on Transactions and Analytics when savings total is not 0. See dashboard module.

Invalidation: movements and group edits refetch `['savings']`, `['transactions']`, `['dashboard']`, `['finance-analytics']`.

## Amount visibility

Savings amounts have their own eye (`SavingsVisibilityToggle`, `useSavingsVisibilityStore`), independent from the global amounts switch: in memory, hidden on every load, one shared state across `/savings`, `/analytics`, `/transactions` and the history dialog.

- `useSavingsMoney`: group balances, total, movements, withdrawal limit, movement rows in the ledger.
- `useCombinedSavingsMoney` needs both eyes: wallet + savings, net worth, running balance while "Include savings" is on. Under the global eye alone, subtracting the wallet would reveal savings.
- Known gap: with the global eye open, the wallet balance before and after a movement row, and the analytics trend balance (income − expense) against the wallet, still let someone work out savings.
