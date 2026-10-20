---
metadata:
  agent-artifact:
    id: global-backend-crud-api-knowledge
    type: documentation
    depends_on:
      - apps/api/src/finance/finance.controller.ts
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/users/users.controller.ts
      - apps/api/src/reminders/reminders.controller.ts
      - apps/api/src/google/google-resources.controller.ts
      - apps/api/src/zalo/text/text-tool.enum.ts
      - apps/api/src/zalo/text/text-tool.definitions.ts
      - packages/contracts/src/index.ts
---

# Backend CRUD API

REST surface of `apps/api` (global prefix `/api`). The API is organized by top-level areas (`finance`, `reports`, `users`, `reminders`, `google`, `zca`), not `src/modules/<feature>`. Route strings consumed by the web live in `API_ROUTES` (`packages/contracts/src/index.ts`).

## Identity & Scoping

- Caller identity comes only from the dashboard Bearer access token (`getDashboardUserId`). No endpoint accepts a client `userId` for scoping.
- Finance data (transactions, places, contacts, debts, payments, allocations, categories) is ONE shared store: every signed-in user reads and writes all of it; the token only authenticates (see finance-domain). Reminder, calendar, and task records stay scoped to the caller; calendar/task calls act on the caller's linked Google account. OAuth tokens and audit rows are never returned.
- `/api/users*` requires admin (`UsersService.isAdmin`: the ZCA own account or a user with admin role); otherwise `403`.
- `POST /api/drive/share`, `GET /api/drive/folder-link`, `GET /api/photos/album-link` require a dashboard admin (`requireDashboardAdmin`, Bearer); `GET /api/drive/open`, `GET /api/photos/open` are `<a href>` links and accept the Bearer token or the dashboard refresh cookie, admin only (`getDashboardUserIdFromBrowser` + `assertDashboardAdmin`). 401 without a token, 403 for non-admins.

## Endpoints

| Area | Endpoints |
| --- | --- |
| Transactions | `GET /api/transactions?type&startAt&endAt&search&categories&note&placeIds&createdByUserIds&hasReceipt&amountMin&amountMax&limit&offset` (→ `ITransactionListResponse`, see finance-domain), `GET/PATCH/DELETE /api/transactions/:id`, `POST /api/transactions` |
| Receipt image | `GET /api/transactions/:id/receipt` (Bearer or refresh cookie; any signed-in user) |
| Allocations | `GET /api/transactions/:id/candidate-debts`, `GET/POST /api/transactions/:id/allocations` (body `allocations: [{ debtId, amount, note? }]`), `DELETE /api/transactions/:id/allocations/:allocationId` (`debt_payment_allocations`) |
| Categories | `GET /api/categories?type=`, `POST /api/categories` (`type`, `name`, `color?`, `icon?`), `PATCH/DELETE /api/categories/:id` (`user_categories`) |
| Places | `GET/POST /api/places`, `PATCH/DELETE /api/places/:id`, `POST /api/places/combine` (`placeIds` and/or `targetPlaceId` + `sourcePlaceIds`, optional `name`; ≥2 distinct ids) |
| Contacts | `GET /api/contacts` (max 200, served by reports controller), `GET/PATCH/DELETE /api/contacts/:id`, `POST /api/contacts`, `POST /api/contacts/combine` (≥2 ids; optional `consolidateDebts: true`), `POST /api/contacts/sync-users` (admin: users → shared contacts + phone backup) |
| Debts | `GET /api/debts?status=active\|settled` (reports controller), `GET/PATCH/DELETE /api/debts/:id`, `POST /api/debts`, `POST /api/debts/combine` (`debtIds` ≥2 → parent debt via `parent_debt_id`) |
| Debt payments | `GET/POST /api/debts/:id/payments` (`amount`, `paymentDate?`, `note?`), `DELETE /api/debts/:id/payments/:paymentId` |
| Reports | `GET /api/dashboard`, `GET /api/expenses`, `GET /api/finance/analytics?startAt&endAt&grain` |
| Reminders | `GET/POST /api/reminders`, `GET/PATCH/DELETE /api/reminders/:id` (`title`, `remindAt`, `notifyType`, `repeatType`) |
| Users (admin) | `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`, `POST /api/users/sync-zca`, `PATCH /api/users/:id/grant-access`, `GET /api/users/:id/merge-preview?targetUserId=`, `POST /api/users/:id/merge`, `GET /api/users/:id/linked-contacts` |
| Google | `GET/POST /api/calendar/events`, `GET/PATCH/DELETE /api/calendar/events/:id`, `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id` |

## Business Rules

- Debt payment (`debt_payments`: `debt_id`, `amount`, `payment_date`, `note`, optional `finance_transaction_id`) lowers `remainingAmount`; at zero the debt becomes `settled` with `settledAt`; deleting a payment reverts the status to `active` when needed.
- Transaction input fields: `type`, `amount`, `currency?`, `category?`, `paymentMethod?`, `receiptUrl?`, `contactId?`, `placeId?` (`null` unlinks), `placeName?`, `note`, `occurredAt?`.
- Debt contacts carry `phoneNumber`, `bankAccountNumber`, `bankCode`, `bankName`, `avatarUrl`, `linkedUserId` (admin-only to change; see contacts module "Contact ↔ user account link").
- Reminders track `status` (`pending|completed|snoozed|cancelled`), `snoozeCount`, `snoozedUntil`, `completedAt`; the API does not accept `isTriggered` (scheduler-owned).
- `DELETE /api/users/:id` removes the user row (via `banUser`) and refuses admins (`404`). Users carry `role`, `grantAccess`, `preferredLocale`, `timezone`, `phoneNumber`, `avatarUrl`, `status`, Drive folder fields.
- The `invites` table was dropped (migration `DropInvitesTable`); there is no invite API.

## Bot Tool Catalog (LLM function calling)

`TextToolType` (`apps/api/src/zalo/text/text-tool.enum.ts`) holds fast-path commands (`START`, `HELP`, `TODAY`, `WEEK`, `FINANCE`, `DEBTS`, `TASKS`, `REMINDERS`, `DASHBOARD`, `USERS`, `BAN`, `ZALO_LOGIN`, `ZALO_LOGOUT`, `SHARE_DRIVE`, ...) and LLM tools. `ZALO_TOOL_DEFINITIONS` exposes: `MANAGE_DEBT`, `RECORD_TRANSACTION` (one transaction per call; `type`, `amount` required; optional `category`, `note`, `occurredAt`, `placeName`, `paymentMethod`, `receiptUrl`), `DELETE_TRANSACTION`, `SET_REMINDER`, `GET_REPORT`, `CREATE_CALENDAR_EVENT`, `LIST_CALENDAR_EVENTS`, `DELETE_CALENDAR_EVENT`, `CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK`, `LOGIN_GOOGLE`, `CREATE_PLACE`, `GET_STORAGE_LINKS`.

- A `placeName` with no existing caller place creates a companion pending `CREATE_PLACE` action instead of a debt contact.
- Passive (un-mentioned) group messages may only trigger `PASSIVE_EXPENSE_TOOLS` (`RECORD_TRANSACTION`, `MANAGE_DEBT`) or `PASSIVE_CALENDAR_TOOLS` (`CREATE_CALENDAR_EVENT`, `SET_REMINDER`) per thread config.
