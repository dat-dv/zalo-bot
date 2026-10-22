# Users Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/users/README.md)

## Purpose

`apps/api/src/users` and `apps/web/src/modules/users` record WHO may interact with the bot: Zalo identities, role (admin/user), bot access (`grantAccess`), per-user Google Drive folder info, and duplicate-account merge.

## Entity (`UserEntity`, table `users`)

| Field | Notes |
| --- | --- |
| `id` | Zalo id (string, PK). The only system identity |
| `username`, `firstName` | Optional display data |
| `role` | `UserRole`: `admin` / `user` (default `user`) |
| `grantAccess` | `GrantAccessStatus` int: `DENIED = 0` (default), `GRANTED = 1`. "Pending" is only a UI label for DENIED |
| `phoneNumber`, `avatarUrl` | Optional, filled by dashboard edit or ZCA sync |
| `preferredLocale` | `SupportedLocale`, default `vi` |
| `timezone` | default `Asia/Ho_Chi_Minh` |
| `status` | `'active' \| 'suspended'`, default `active`. No code path sets `suspended` |
| `driveFolderId`, `driveFolderUrl`, `driveFolderPath` | Personal-chat Drive folder `zalobot/<sanitized chatId>` (`getChannelDriveFolderPath`, `apps/api/src/google/channel-storage.util.ts`; root `GG_DRIVE_ROOT_FOLDER = 'zalobot'`, no `u-` prefix) |
| `createdAt`, `updatedAt` | Timestamps |

## Access control (`UsersService`)

- Admin sources: DB `role=admin` only — first user when no admin/granted user exists (`InitialAdminBootstrapGuard` → `bootstrapFirstAdmin`), role set on the dashboard — plus the bot's own ZCA account (`zcaService.getOwnId()`, recreated as admin/granted by `refreshMemoryCache()` on module init and Redis ready). Env admin variables (`ADMIN_USER_IDS`, `ZALO_ADMIN_ID`, …) are not supported.
- `isGrantAccess(id)`: admin → true; else Redis `whitelist:user:<id>` (`'1'`/`'0'`); miss → DB (`role=admin` or `grantAccess=GRANTED`), then caches the result.
- `setGrantAccess(id, status)`: updates (or creates, with `role=user`) the row, updates the in-memory allow cache and Redis whitelist. It does not touch dashboard sessions or Google tokens.
- `banUser(id)`: refuses admins; otherwise deletes the `users` row and clears caches + Redis whitelist. No token revocation.
- `checkCooldown(id)`: in-memory 2s per user, admins exempt.
- No invite-code flow exists.

## User record lifecycle

- A row is created only by `registerPendingUser` (ZCA L1 `GrantAccessGuard`, `grantAccess=DENIED`), `bootstrapFirstAdmin`, dashboard `POST /api/users` (`upsertUser`, defaults `role=user`, `grantAccess=GRANTED`), `setGrantAccess` on an unknown id (dashboard grant), `allowUser`, `setPreferredLocale` (via `upsertUser`), or the bot-account bootstrap.
- `saveDriveFolderInfo` only updates an existing user; unknown ids are skipped with a warning (it previously created DENIED users, which turned group ids into fake "pending" rows).
- A group thread id is never a user. `syncUsersWithZca` only maps ZCA threads with `type === 'user'` and fills avatar, phone, and a generic/empty `firstName` from ZCA alias/name.
- Phone backup: `updateUserProfile`, `upsertUser`, `syncUsersWithZca` call `fillLinkedContactPhones(userId, phone)` → fills linked `debt_contacts` with null/empty phone (never overwrites). `syncUsersWithZca` still overwrites `users.phoneNumber` when ZCA returns a different non-empty number (no manual-phone lock).
- `getUsers()` enriches rows with ZCA thread data (`alias`, `displayName`, `zaloName`, avatar/phone fallback) without writing.
- Group text that does not address the bot (no mention/prefix) is ignored before any access check, so it never calls `registerPendingUser` (see zca module "Message Flows").
- Per-thread access (zca `memberAccess`) is separate from `grantAccess`: a sender granted only by a group is still registered as a DENIED ("pending") row by `GrantAccessGuard`, is allowed in that group, and gains no global access (see modules/zca/member-access.md).
- **Cleanup script** `apps/api/scripts/cleanup-group-users.ts` (`npm run users:cleanup-groups --workspace @zalobot/api [-- --apply]`): candidates = users whose id equals a `zca_thread_configs.thread_id` with `thread_type='group'`; skips admins and ids still referenced by real data (`finance_transactions.created_by_user_id`, `debt_contacts.linked_user_id`, `user_tokens`, `reminders`, `dashboard_exchange_tokens` by `user_id`; finance tables have no owner column). Default dry-run prints a table; `--apply` deletes in one transaction (audit subscriber logs each delete) and clears Redis `whitelist:user:<id>` when `REDIS_URL` is set.

## Account Merge (Duplicate Zalo Identities)

- Legacy official-bot ids cannot receive ZCA messages: reminders treat them like `dashboard-owner` (no private chat, delivery skipped; see reminders module). Merging the legacy id into the ZCA uid is the fix for existing data.
- **Why**: One person can reach the bot through two channels with different IDs — the legacy official Zalo Bot webhook (removed; old IDs remain in `users`) gave an app-scoped ID (20-hex, e.g. `573462d8909179cf2080`), ZCA (`zca-js`) gives the personal Zalo UID (numeric). `GrantAccessGuard` (ZCA) auto-registers unknown IDs as pending users, so the same person appears twice (authorship, contact links, reminders, reminder targets and Google token split across IDs; finance data itself is shared, see global/finance-domain.md). `users.id` is the only identity; there is no identity-link table.
- **Service**: `UserMergeService` (`apps/api/src/users/user-merge.service.ts`) with DI tokens `USER_MERGE_UNIT_OF_WORK` (wraps `DataSource.manager` / `DataSource.transaction`) and `USER_MERGE_USERS_PORT` (`UsersService`), declared in `user-merge.types.ts`.
- **Preview** (`preview(source, target)`): read-only; counts (`USER_MERGE_TABLES` = `financeTransactions` created by source, `debtContacts` linked to source, `reminders`, `googleToken`), conflicts (`linkedContacts` = source links that will be dropped because the target already links to a contact; Google token decision), `sourceIsBotAccount`.
- **Merge** (`merge(source, target, actor)`), single transaction, all-or-nothing:
  1. Reject self-merge, unknown users, and the bot's own ZCA account as source (`isBotAccount`) — it is recreated as admin on every startup.
  2. Finance rows are shared and untouched (no owner column); only authorship follows: `finance_transactions.createdByUserId` source → target.
  3. `debt_contacts.linkedUserId` source → target; if the target already links to a contact (a user links to at most one), the source links are set to `null` instead.
  4. Move `reminders.userId`; authorship `tasks.createdByUserId` and `calendar_events.createdByUserId`; reminder targets: `reminders.chatId` and `tasks.remindChatId` equal to source ⇒ target, and the source among `remind_users` (jsonb, reminders and tasks) ⇒ target (`replaceRemindUser`: dropped when the target is already listed). Preview counts are unchanged (`USER_MERGE_TABLES`).
  5. `user_tokens` (Google): keep the only token, else the one with a refresh token, else the newest `updatedAt`.
  6. Delete source `dashboard_exchange_tokens`.
  7. Target profile: fill empty `firstName/username/phoneNumber/avatarUrl/driveFolder*` from source; role ADMIN if either is admin; `grantAccess` GRANTED if either granted or admin; earliest `createdAt`.
  8. Delete source user; insert one `audit_logs` row (`tableName=users`, `action=update`, `actorSource=dashboard`, `afterData.operation=merge`, counts). Existing audit rows are never rewritten.
- **After commit**: `UsersService.afterUsersMerged()` drops source caches + Redis `whitelist:user:<source>` and rebuilds caches. Dashboard sessions of the source ID become invalid (`sourceWasCurrentSession` in result).
- Tests (`user-merge.service.spec.ts`): token choice, preview validation, preview counts/conflicts, merge moves authorship+links and keeps shared finance rows/admin/audits, merge moves task/calendar authorship and reminder targets, `replaceRemindUser`, drops the source link when the target already has one, "merge is refused when the source is the bot own ZCA account", rollback on failure.

## Backend API (`UsersController`, admin only via `UsersService.isAdmin(dashboard user)`)

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/users` | `getUsers()` (ZCA-enriched) + `linkedContactCount` (one `GROUP BY linked_user_id` query, `UserLinkedContactsService.countByLinkedUser`) |
| GET | `/api/users/:id/linked-contacts` | `IUserLinkedContactItem[]`: contacts of the shared debt directory linked to `:id` (`contactId`, `displayName`, `alias`, `debtCount`, `createdAt`), oldest first |
| GET | `/api/users/:id` | One user, 404 if missing |
| POST | `/api/users/sync-zca` | `syncUsersWithZca()` → `{ syncedCount, totalUsers }` |
| POST | `/api/users` | Upsert `{ id, role?, grantAccess?, firstName?, phoneNumber?, avatarUrl? }` |
| PATCH | `/api/users/:id` | Update `role`, `grantAccess`, `firstName`/`phoneNumber`/`avatarUrl`; 404 if missing |
| PATCH | `/api/users/:id/grant-access` | `setGrantAccess` (missing value → GRANTED; any value ≠ 1 → DENIED) |
| GET | `/api/users/:id/merge-preview?targetUserId=` | Merge preview |
| POST | `/api/users/:id/merge` | `{ targetUserId }` (`MergeUserDto`); merges `:id` into target |
| DELETE | `/api/users/:id` | `banUser` → deletes the row; 404 if missing or admin |

## Web (merged into the ZCA page)

- There is no standalone Users page: user management (grant/revoke, add, edit name/phone/role, merge, delete, sync from ZCA) is on the "Zalo & Users" page — see zca module "Web UI".
- `apps/web/src/modules/users` keeps only:
  - `api/users-api.ts`: `getUsers`, `createUser`, `setGrantAccess`, `updateUser`, `updateUserRole`, `syncUsersWithZca`, `deleteUser`, `getUserMergePreview`, `mergeUser`, `getUserLinkedContacts`.
  - `api/users-query.ts`: `usersQueryKeys` (`all`, `mergePreview`, `linkedContacts`), `useUsersQuery` (no retry on 403; `isSuccess` doubles as the "viewer is admin" signal on the contacts page), `useUserLinkedContactsQuery`, `useCreateUserMutation`, `useSetGrantAccessMutation`, `useUpdateUserMutation`, `useUpdateUserRoleMutation`, `useSyncUsersWithZcaMutation`, `useDeleteUserMutation`, `useUserMergePreviewQuery`, `useMergeUserMutation` (invalidates all queries: creator names, links, reminders, users). Also used by contacts `combine-contacts-dialog.tsx`.
  - `presentation/components/merge-user-dialog.tsx` (`MergeUserDialog`): target select (excludes source), live preview (loading / error / empty / counts), conflict + Google token notes, bot-account warning that blocks merge, mandatory "irreversible" checkbox, destructive confirm. On success the ZCA page shows a banner (extra notice when the merged source was the signed-in session).
  - `presentation/components/linked-contacts-dialog.tsx` (`LinkedContactsDialog`): reverse view of the contact ↔ user link (see contacts module); loading / error+retry / empty / list with alias and debt count, link to `APP_ROUTES.contacts`. Opened from the ZCA row badge "🔗 N" or menu item.
- Routes in `API_ROUTES`: `users`, `usersSyncZca`, `usersGrantAccess(id)`, `usersMergePreview(id)`, `usersMerge(id)`, `usersLinkedContacts(id)`; `GET/PATCH/DELETE :id` are built as `${API_ROUTES.users}/${id}`.
- Contracts: `IUserListItem` (`linkedContactCount?`), `IUserLinkedContactItem`, `UserRole`, `GrantAccessStatus`, `USER_MERGE_TABLES`, `UserMergeTable`, `IUserMergeRequest`, `IUserMergeSummary`, `IUserMergeResult`, `IUserMergeConflicts`; i18n keys `users.merge.*`, `users.linkedContacts.*` (vi + en).

- `MergeUserDialog`: Dialogs render through the shared `Modal` shell (bottom sheet on mobile, sticky header/actions above the on-screen keyboard); see [web-ui-direction](../../global/web-ui-direction.md#mobile-dialogs--on-screen-keyboard).
- Phones (`MergeUserDialog`, `LinkedContactsDialog`): ✕ gets `MODAL_CLOSE_TAP`, footer buttons/link `MODAL_FOOTER_TAP` (sticky footer already), target select 40px, "irreversible" checkbox label and Retry 40px tall. Desktop unchanged.

## Corner radius

- Buttons, inputs, cards/panels and dialog panels in this module use `rounded-[3px]` (max `rounded`, 4px); no `rounded-lg/xl/2xl`. `rounded-full` only for avatars, status dots, switches, spinners and progress fills. See [web-ui-direction](../../global/web-ui-direction.md).

## Dark-mode buttons

- Primary actions use the sky tone in dark mode (`dark:bg-sky-600 dark:text-white`), never the near-white inverted `dark:bg-slate-100`: the `LinkedContactsDialog` primary. See [web-ui-direction](../../global/web-ui-direction.md).
