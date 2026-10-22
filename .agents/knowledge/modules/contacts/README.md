# Contacts Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/contacts/README.md)

## Purpose

`apps/web/src/modules/contacts` shows the current user's debt-contact directory (people/counterparties linked to debts and transactions), lets the user edit contact details inline, and combine duplicate contacts. Places (merchants/venues) are NOT here; they live on `/places` in the dashboard module.

## Files

- `api/contacts-api.ts`: `getContacts` (`GET API_ROUTES.contacts`), `updateContact` (`PATCH /api/contacts/:id`, `IUpdateContactRequest`), `combineContacts` (`POST API_ROUTES.contactsCombine` = `/api/contacts/combine`), `deleteContact` (`DELETE /api/contacts/:id`).
- `api/contacts-query.ts`: key `['contacts']`; `useContactsQuery`, `useUpdateContactMutation`, `useCombineContactsMutation`, `useDeleteContactMutation`. Profile: key `['contacts','profile',id]` (prefix of the list key, so list invalidation refetches it), `useContactProfileQuery`, `useSaveContactProfileMutation`.
- `api/contacts-api.ts` also: `createContact` (`POST API_ROUTES.contacts`), `getContactProfile` / `updateContactProfile` (`API_ROUTES.contactProfile(id)`).
- Profile page: `model/contact-profile-form.ts` (+ spec), `view/contact-profile-screen.tsx`, `view/use-open-contact-profile.ts`, `presentation/components/contact-profile/*` (header, info panel, debts/transactions tables, styles). Route `app/(private)/contacts/profile/page.tsx`.
- `presentation/components/contacts-screen.tsx`, `presentation/components/combine-contacts-dialog.tsx` (re-exported via `view/`). Route `/contacts`.

## API data (`GET /api/contacts`, `ReportsController`)

- One shared directory for all users (no owner), ordered `displayName ASC, createdAt DESC`, max 200 rows (`FinanceService.listContacts`).
- Fields: `id`, `displayName`, `alias`, `descriptor`, `phoneNumber`, `bankAccountNumber`, `bankCode`, `bankName`, `avatarUrl`, `linkedUserId`, `linkedUser { id, username, firstName, avatarUrl }`, `debtCount`, `transactionCount`, `createdAt`, `updatedAt`.

## Screen (`ContactsScreen`)

- Header (title/Refresh/Logout/money toggle) comes from the private layout `WorkspaceHeader`; the screen renders only a `DataPanel` + `DataTable` (`id="contacts"`).
- Columns: `select` (checkbox, select-all in header), `displayName` (non-hideable), `alias`, `descriptor`, `phoneNumber`, `bankAccountNumber`, `bankName`, `linkedUser` (plain text `firstName @username`, username muted, or `#<id prefix>`), `resources` (one line `N nợ · N giao dịch`, debt count in amber text, only non-zero parts), `createdAt`, `actions` (non-hideable, `minWidth: 120px`, Edit only).
- Values are plain text; there are no external phone/map links. No chips/pills or emoji in cells (same flat style as the `/zca` table).
- One line per cell: display text is `whitespace-nowrap` and truncated (`max-w` per column: name 220px, alias 160px, descriptor 260px, bank name 140px, linked user 200px) with the full value in `title`. Inline-edit inputs are unchanged.
- Inline edit (double-click a cell or Edit): `displayName` (required), `alias`, `descriptor`, `phoneNumber`, `bankAccountNumber`, `bankName`, and — admins only — `linkedUser` (select from `useUsersQuery`, option "Not linked"). `linkedUserId` is sent only when it changed (`null` = unlink). `Enter` saves, `Escape` cancels. Empty optional fields are sent as `undefined`; the API clears `alias`/`descriptor` on empty but leaves phone/bank fields unchanged, so those cannot be cleared from the UI.
- Toolbar: Combine button when 2+ rows selected, select/deselect all, selected-count chip, search (displayName/alias/descriptor).
- States: loading via `DataTable`, empty message, error banner with Retry (invalidates `['contacts']`), toast after save/combine (`TOAST_POSITION`).
- **Compact (<= 960px)**: `DataTable` mobile list. Slots: primary `displayName (alias)` (prefixed `✓` while selected), trailing `phoneNumber` (there is no balance column), secondary linked account (`firstName (@username)`; `firstName` alone when the user has no username, never `@null`; `#<id prefix>` when unresolved) · resources (`N nợ · N giao dịch`). The `select` column is dropped on compact (its sheet row would read "Select all"); selecting for Combine is the sheet footer toggle `contacts.actions.select` / `contacts.actions.selected` (`aria-pressed`). Sheet footer also has `Hồ sơ` (link) and Edit; Edit turns the sheet rows into inputs and the footer into Save/✕ (double-click edit stays desktop-only in practice). With 2+ selected, Combine moves to `MobileActionBar` (toolbar copy `max-[960px]:hidden`).
- **Phone (<= 640px) toolbar**: Sync / Combine / Select all / selected-count chips in one sideways-scrolling row (`MOBILE_TOOLBAR_ROW`, 40px chips), search on its own full-width 40px row. Suggestion panel ✕ and Link buttons are 40px.
- `useDeleteContactMutation` exists but no delete action is rendered.

## Combine (`CombineContactsDialog`)

- Candidate ranking (same as backend fallback): has linked user → most `debtCount + transactionCount` → earliest `createdAt`. Top candidate is the default lead; user can pick another lead via radio.
- Prefills name/alias from the lead, descriptor = all distinct descriptors joined, `linkedUserId` from lead or any source.
- Linked-user select is rendered only for admins (`useUsersQuery().isSuccess`); non-admins send no `linkedUserId` and the backend inherits a source contact's link.
- `consolidateDebts` checkbox, default on. Escape closes unless pending; errors shown inline.
- Payload: `{ targetContactId, sourceContactIds, displayName, alias, descriptor, linkedUserId, consolidateDebts }`.
- Success invalidates `contacts`, `users`, `debts`, `transactions`, `expenses`, `dashboard`. Update/delete invalidate `contacts`, `users`, `debts`, `dashboard` (`users` carries `linkedContactCount` for the ZCA page).

- `CombineContactsDialog`: Dialogs render through the shared `Modal` shell (bottom sheet on mobile, sticky header/actions above the on-screen keyboard); see [web-ui-direction](../../global/web-ui-direction.md#mobile-dialogs--on-screen-keyboard). Phones: `phoneLayout="fullscreen"` (long form); the inner `max-h-[75vh]` body and `max-h-48` candidate list stop scrolling (`max-sm:max-h-none overflow-visible`) so the panel is the only scroller; inputs/select 40px, consolidate-debts label 40px, footer buttons `MODAL_FOOTER_TAP`, ✕ `MODAL_CLOSE_TAP`.

## Contact ↔ user account link (`linkedUserId`)

- **Why**: a debt contact is only a name in the shared debt directory; the link says which system user (`users.id`, the ZCA/Zalo identity) that person is. The reverse view lives on the ZCA page (users module `LinkedContactsDialog`).
- Column `debt_contacts.linked_user_id` (nullable, indexed, no DB FK); entity types `linkedUserId?: string | null`, `linkedUser?: UserEntity | null`, `ON DELETE SET NULL` in the relation.
- **Admin only**: `FinanceController.linkedUserId()` returns 403 when a non-admin sends `linkedUserId` (incl. `null`) to `POST /api/contacts`, `PATCH /api/contacts/:id`, `POST /api/contacts/combine`. Reason: picking a user needs the admin-only user list. Omitting the field never changes the link.
- **Validation** (`FinanceService.resolveLinkedUser`): `undefined` = unchanged; `null`/empty = unlink; otherwise the user must exist (400) and must not already be linked to another contact (409, message suggests Combine) — a user links to at most one contact system-wide. Any user may be linked, including the one editing (no directory owner). Combine excludes all candidate contacts from the duplicate check.
- Writes set both `linkedUserId` and the `linkedUser` relation: `getContact` loads the relation, and TypeORM would otherwise persist the stale relation FK (old bug: unlink did nothing).
- Bot flows never set the link (no auto-link from mentions/UID).
- **Phone backup** (Zalo often hides numbers; `fillMissingPhones` in `apps/api/src/finance/contact-user-sync.ts`): fill-empty-only, never overwrite. On link (create/update/combine) the contact takes the user's phone if empty, and the user takes the contact's phone if empty (`FinanceService.backfillLinkedPhones`). When a user's phone is set (`UsersService.updateUserProfile`, `upsertUser`, `syncUsersWithZca`), `UsersService.fillLinkedContactPhones` fills linked contacts whose phone is null/empty. Both phones set and different → both kept; UI shows amber text `· Zalo: <user phone>` (no background) after the phone (`contacts.phone.zaloMismatch`). `GET /api/contacts` returns `linkedUser.phoneNumber` for this.

## Sync Zalo users into contacts (`POST /api/contacts/sync-users`, admin only)

- **Why**: show every system user in the shared debt-contact table (users table is otherwise only on the ZCA page) and back up their phones.
- Manual, idempotent button "👥 Đồng bộ người dùng Zalo" (toolbar, admins only). Not run on page load (no writes in reads).
- Target = the shared directory. Skips only the bot ZCA account (admins are added like everyone else).
- Pure planner `planContactUserSync` per user: already linked contact → phone sync only; an UNLINKED contact with the same normalized name → suggestion only (no auto-create: would make bot debt text like "cho Trí mượn 30k" ambiguous; no auto-link: same name ≠ same person); otherwise create contact (`displayName` = `firstName` → `username` → `Zalo <id tail>`, phone, avatar, `linkedUserId`). Same-name contacts already linked to another user do not block creation.
- Result `IContactUserSyncResult { created, phoneFilled, suggestions[] }` → toast + amber suggestions panel; "Link" sends `PATCH` with current `displayName/alias/descriptor` + `linkedUserId` (PATCH clears alias/descriptor when omitted). API error messages (e.g. 409) are shown in the toast.
- Service `ContactUserSyncService` (`apps/api/src/finance/contact-user-sync.service.ts`); tests `contact-user-sync.spec.ts`.
- Tests: `apps/api/src/finance/finance-contact-link.spec.ts`.

## Profile page (`/contacts/profile?id=<contactId>`)

- **Root = debt contact.** A "profile" is one `debt_contacts` row + the Zalo user linked to it (`linked_user_id`, at most one contact per user, so 1–1). Debts and transactions already carry `contact_id`.
- Route: static export has no dynamic segments → `APP_ROUTES.contactProfile(id)` = `/contacts/profile?id=…` (`APP_ROUTES.contactProfilePage` for the header title map). Page wraps the screen in `<Suspense>` for `useSearchParams`.
- **Data** (migration `1724850000000-AddProfileFieldsToDebtContacts`, columns on `debt_contacts`): `notes text`, `birthday date` (`YYYY-MM-DD`), `address`, `workplace`, `relationship` (`family|friend|colleague|partner|other`, `CONTACT_RELATIONSHIPS`), `extra_phones jsonb [{value,label?}]`, `extra_bank_accounts jsonb [{accountNumber,bankName?,bankCode?,label?}]` (default `[]`). Primary phone/account stay in `phone_number` / `bank_*` (bot, phone backup and the table keep using them); extras are stored only. jsonb (not a child table) because the lists are short, always read with the contact, and never searched.
- **API** (`FinanceController`, signed-in dashboard user, shared ledger):
  - `GET /api/contacts/:id/profile` → `IContactProfileResponse { contact: IContactProfile, summary, debts, recentTransactions }`. `debts` = root debts only (`parent_debt_id IS NULL`, combined debts already carry their children). `recentTransactions` = latest `CONTACT_PROFILE_LIMITS.RECENT_TRANSACTIONS` (50). `summary` (pure `summarizeContactProfile` in `apps/api/src/finance/contact-profile.ts`): open receivable/payable remaining (active, remaining > 0), open/total debt counts, income/expense totals and count over **all** transactions (grouped SQL). `linkedUser.role` / `grantAccess` only for admins. 404 when the contact does not exist.
  - `PATCH /api/contacts/:id/profile` (`IUpdateContactProfileRequest`): profile fields only; omitted = unchanged, `null`/empty = clear. Separate from `PATCH /api/contacts/:id` because that one requires `displayName` and clears alias/descriptor when omitted. Body validated by shared `validateContactProfileUpdate` (contracts): trims, empty → `null`, `birthday` real date and not in the future, relationship in list, extra phones `[+\d\s.-]` with 8–15 digits, account numbers digits only 6–20, labels ≤ 40, address/workplace ≤ 200, notes ≤ 5000, ≤ 10 rows per list; blank and duplicate rows dropped. Errors → 400 `{ errors: { field: { code, index? } } }`.
  - Audit: `audit-log.subscriber` records the update like any entity change.
- **Screen** (`ContactProfileScreen`): flat single canvas, square controls (same as the `/zca` and `/contacts` tables).
  - Header: back link, square avatar (contact or linked user), name `(alias)`, descriptor, `Tài khoản Zalo: name @username · ● access` (+ link to `/zca` for admins) or "not linked".
  - `MetricGrid` 4 cells (lent still owed, borrowed still owing, total income, total expense; amounts follow the money visibility toggle) + one line `N open · N transactions`.
  - Desktop: left "Details" `DataPanel` (~320–400px), right debts table + recent transactions table (`DataTable`, mobile list slots). Mobile: stacked. Phones: `profile-styles.ts` buttons and inputs grow to 40px (`max-[640px]:` only), back link 40px, toast uses `TOAST_POSITION`.
  - Details view: phones / accounts (primary first with "Primary"), birthday, relationship, address, workplace, notes (pre-line). Edit: "Sửa" turns the panel into an in-place form (name, alias, descriptor, primary + extra phones/accounts with add/remove rows, birthday, relationship, address, workplace, notes); "Lưu"/"Huỷ". Save = validate with the same contracts rules (field errors under each field, row index for lists) → `PATCH /api/contacts/:id` only if base fields changed (same body as the table inline edit; empty primary phone/bank keeps the value) → `PATCH …/profile`.
  - States: missing `id`, loading skeleton, not found (404, e.g. deleted/merged), error + retry, data; empty tables show an empty row.
- **Entry points**: `/contacts` actions column "Hồ sơ" link (name click stays inline edit); `/zca` row "⋯" menu for rows with a `users` row: "Xem hồ sơ" (has linked contact) or "Tạo hồ sơ" (none: `useOpenContactProfile` creates a contact named after the user with its phone and `linkedUserId`, admin-only, then opens it).
- Not in scope: bot reading/writing profile notes, lookup by extra phone, avatar upload.

## Backend combine semantics (`FinanceService.combineContacts`)

- Requires ≥2 existing contacts. Lead = `targetContactId` if given, else the ranking above.
- Applies name/alias/descriptor/linkedUserId (validated as above); inherits missing phone, bank (number+code+name), avatar from sources.
- Profile fields (`mergeContactProfileFields`, pure, spec `contact-profile.spec.ts`): birthday/address/workplace/relationship fill only when the lead's is empty; source notes appended as `— Gộp từ <name>:\n<notes>`; extra phones/accounts = union of lead + sources (deduped by digits), and every source primary phone/account that is not the lead's primary is added to the extras. The merge does not cap the lists at 10, so nothing is lost; a later profile edit must trim them to 10.
- Reassigns sources' debts (`contactId`, `counterparty`, `counterpartyAlias`) and transactions (`contactId`) to the lead, deletes sources, then if `consolidateDebts` groups the lead's top-level debts by direction + currency and calls `combineDebts` for groups of ≥2.
- NOT a single DB transaction: the steps are sequential saves; a failure midway (e.g. during debt consolidation) leaves earlier steps committed. Each `combineDebts` call is itself transactional.

## Corner radius

- Buttons, inputs, cards/panels and dialog panels in this module use `rounded-[3px]` (max `rounded`, 4px); no `rounded-lg/xl/2xl`. `rounded-full` only for avatars, status dots, switches, spinners and progress fills. See [web-ui-direction](../../global/web-ui-direction.md).
