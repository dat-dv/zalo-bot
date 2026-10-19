# Users Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/users/README.md)

## Purpose

`apps/api/src/users` and `apps/web/src/modules/users` manage multi-tenant user accounts, role-based authorization (Admin / User), bot access grants (`grantAccess`), and user-scoped Google Drive storage partitions.

## Backend Architecture & Rules

- **Entity Schema (`UserEntity`)**:
  - `id`: Zalo user identifier.
  - `firstName`: Display name.
  - `role`: `admin` or `user` (`UserRole`).
  - `grantAccess`: `granted`, `denied`, or `pending` (`GrantAccessStatus`).
  - `driveFolderId`, `driveFolderUrl`, `driveFolderPath`: Per-user Google Drive folder (`zalobot/u-<userId>`).
- **Authorization & Access Control**:
  - Admin sources: DB `role=admin` only — first user to chat when no admin/granted user exists (`InitialAdminBootstrapGuard` → `bootstrapFirstAdmin`) or role set on the dashboard — plus the bot's own ZCA account (`zcaService.getOwnId()`, recreated as admin by `refreshMemoryCache()`). Env admin variables (`ADMIN_USER_IDS`, `ZALO_ADMIN_ID`, …) are not supported.
  - Manages invite code lifecycle (24h validity).
  - Toggles runtime access privileges (`setGrantAccess`, `banUser`). When access is revoked, existing sessions and Google tokens are suspended.
- **User record lifecycle**:
  - The Users module records WHO may interact with the bot. A row is created only by `registerPendingUser` (ZCA L1 direct guard), `bootstrapFirstAdmin`, or dashboard `upsertUser`/`allowUser`.
  - `saveDriveFolderInfo` only updates an existing user; unknown ids are skipped with a warning (it previously created DENIED users, which turned group ids into fake "pending" rows).
  - A group thread id is never a user. `syncUsersWithZca` only maps ZCA threads with `type === 'user'`.
  - L2 passive group text checks `isGrantAccess` silently and never calls `registerPendingUser` (see zca module "Message Flows").
- **Cleanup script** `apps/api/scripts/cleanup-group-users.ts` (`npm run users:cleanup-groups --workspace @zalobot/api [-- --apply]`): candidates = users whose id equals a `zca_thread_configs.thread_id` with `thread_type='group'`; skips admins and ids with rows in any `userId` table (`finance_*`, `debt*`, `reminders`, `user_categories`, `user_tokens`, `dashboard_exchange_tokens`). Default dry-run prints a table; `--apply` deletes in one transaction (audit subscriber logs each delete) and clears Redis `whitelist:user:<id>` when `REDIS_URL` is set.

## Account Merge (Duplicate Zalo Identities)

- **Why**: One person can reach the bot through two channels with different IDs — the legacy official Zalo Bot webhook gives an app-scoped ID (20-hex, e.g. `573462d8909179cf2080`), ZCA (`zca-js`) gives the personal Zalo UID (numeric). `GrantAccessGuard` (ZCA) auto-registers unknown IDs as pending users, so the same person appears twice and their data is split. `users.id` is the only identity; there is no identity-link table.
- **Service**: `UserMergeService` (`apps/api/src/users/user-merge.service.ts`) with DI tokens `USER_MERGE_UNIT_OF_WORK` (wraps `DataSource.manager` / `DataSource.transaction`) and `USER_MERGE_USERS_PORT` (`UsersService`).
- **Preview** (`preview(source, target)`): read-only; per-table counts (`USER_MERGE_TABLES`), conflicts (places, contacts, categories), Google token decision, `sourceIsBotAccount`.
- **Merge** (`merge(source, target, actor)`), single transaction, all-or-nothing:
  1. Reject self-merge, unknown users, and the bot's own ZCA account as source (`isBotAccount`) — it is recreated as admin on every startup.
  2. `finance_places` with same `normalizedName` on target: repoint `finance_transactions.placeId`, delete source place; move the rest.
  3. `debt_contacts` with same `normalizedName|normalizedAlias`: repoint `debts.contactId` and `finance_transactions.contactId`, delete source contact; move the rest; rewrite `linkedUserId` source → target.
  4. `user_categories` with same `type|lower(trim(name))`: delete source copy (transactions store the category name); move the rest.
  5. Move `userId` on `finance_transactions`, `debts`, `debt_payments`, `debt_payment_allocations`, `reminders`.
  6. `user_tokens` (Google): keep the only token, else the one with a refresh token, else the newest `updatedAt`.
  7. Delete source `dashboard_exchange_tokens`.
  8. Target profile: fill empty `firstName/username/phoneNumber/avatarUrl/driveFolder*` from source; role ADMIN if either is admin; `grantAccess` GRANTED if either granted or admin; earliest `createdAt`.
  9. Delete source user; insert one `audit_logs` row (`tableName=users`, `action=update`, `afterData.operation=merge`, counts). Existing audit rows are never rewritten.
- **After commit**: `UsersService.afterUsersMerged()` drops source caches + Redis `whitelist:user:<source>` and rebuilds caches. Dashboard sessions of the source ID become invalid (`sourceWasCurrentSession` in result).

## Web UI (`UsersScreen`)

- **Screen (`apps/web/src/modules/users/view/users-screen.tsx`)**:
  - Filter bar supporting queries across all users, granted, pending, and admin tiers.
  - Interactive "Thêm người dùng" modal with validation.
  - Data table displaying Zalo ID with 1-click clipboard copy, user avatars, role badges, direct grant-access toggle switch, and delete action with confirmation.
  - Row action "Merge into…" (every row, incl. admins) opens `MergeUserDialog` (`presentation/components/merge-user-dialog.tsx`): target select (excludes source), live preview (loading skeleton / error / empty / counts), conflict + Google token notes, bot-account warning that blocks merge, mandatory "irreversible" checkbox, destructive confirm. On success: invalidate all queries, banner message; extra notice when the merged source was the signed-in session.

## Integration Seams & Contracts

- Endpoints in `API_ROUTES`: `users`, `usersGrantAccess(id)`, `usersMergePreview(id)` (`GET ?targetUserId=`), `usersMerge(id)` (`POST { targetUserId }`, `MergeUserDto`). Admin only.
- Contracts in `packages/contracts`: `IUserListItem`, `UserRole`, `GrantAccessStatus`, `USER_MERGE_TABLES`, `UserMergeTable`, `IUserMergeRequest`, `IUserMergeSummary`, `IUserMergeResult`, `IUserMergeConflicts`; i18n keys `users.merge.*` (vi + en).
- Web hooks: `useUserMergePreviewQuery(source, target)` (key `usersQueryKeys.mergePreview`), `useMergeUserMutation()`.
