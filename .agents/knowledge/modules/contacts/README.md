# Contacts Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/contacts/README.md)

## Purpose

`apps/web/src/modules/contacts` shows the current user's debt-contact directory (people/counterparties linked to debts and transactions), lets the user edit contact details inline, and combine duplicate contacts. Places (merchants/venues) are NOT here; they live on `/places` in the dashboard module.

## Files

- `api/contacts-api.ts`: `getContacts` (`GET API_ROUTES.contacts`), `updateContact` (`PATCH /api/contacts/:id`, `IUpdateContactRequest`), `combineContacts` (`POST API_ROUTES.contactsCombine` = `/api/contacts/combine`), `deleteContact` (`DELETE /api/contacts/:id`).
- `api/contacts-query.ts`: key `['contacts']`; `useContactsQuery`, `useUpdateContactMutation`, `useCombineContactsMutation`, `useDeleteContactMutation`.
- `presentation/components/contacts-screen.tsx`, `presentation/components/combine-contacts-dialog.tsx` (re-exported via `view/`). Route `/contacts`.

## API data (`GET /api/contacts`, `ReportsController`)

- Caller-scoped, ordered `displayName ASC, createdAt DESC`, max 200 rows (`FinanceService.listContacts`).
- Fields: `id`, `displayName`, `alias`, `descriptor`, `phoneNumber`, `bankAccountNumber`, `bankCode`, `bankName`, `avatarUrl`, `linkedUserId`, `linkedUser { id, username, firstName, avatarUrl }`, `debtCount`, `transactionCount`, `createdAt`, `updatedAt`.

## Screen (`ContactsScreen`)

- Header (title/Refresh/Logout/money toggle) comes from the private layout `WorkspaceHeader`; the screen renders only a `DataPanel` + `DataTable` (`id="contacts"`).
- Columns: `select` (checkbox, select-all in header), `displayName` (non-hideable), `alias`, `descriptor`, `phoneNumber`, `bankAccountNumber`, `bankName`, `linkedUser` (badge `firstName (@username)` or `#<id prefix>`), `resources` (debt/transaction count badges), `createdAt`, `actions` (non-hideable, `minWidth: 120px`, Edit only).
- Values are plain text; there are no external phone/map links.
- Inline edit (double-click a cell or Edit): `displayName` (required), `alias`, `descriptor`, `phoneNumber`, `bankAccountNumber`, `bankName`. `Enter` saves, `Escape` cancels. Empty optional fields are sent as `undefined`; the API clears `alias`/`descriptor` on empty but leaves phone/bank fields unchanged, so those cannot be cleared from the UI.
- Toolbar: Combine button when 2+ rows selected, select/deselect all, selected-count chip, search (displayName/alias/descriptor).
- States: loading via `DataTable`, empty message, error banner with Retry (invalidates `['contacts']`), toast after save/combine.
- `useDeleteContactMutation` exists but no delete action is rendered.

## Combine (`CombineContactsDialog`)

- Candidate ranking (same as backend fallback): has linked user → most `debtCount + transactionCount` → earliest `createdAt`. Top candidate is the default lead; user can pick another lead via radio.
- Prefills name/alias from the lead, descriptor = all distinct descriptors joined, `linkedUserId` from lead or any source.
- Linked-user select is loaded with `useUsersQuery` (`GET /api/users`, admin-only); non-admins get only the "not set" option.
- `consolidateDebts` checkbox, default on. Escape closes unless pending; errors shown inline.
- Payload: `{ targetContactId, sourceContactIds, displayName, alias, descriptor, linkedUserId, consolidateDebts }`.
- Success invalidates `contacts`, `debts`, `transactions`, `expenses`, `dashboard`. Update/delete invalidate `contacts`, `debts`, `dashboard`.

- `CombineContactsDialog`: Dialogs render through the shared `Modal` shell (bottom sheet on mobile, sticky header/actions above the on-screen keyboard); see [web-ui-direction](../../global/web-ui-direction.md#mobile-dialogs--on-screen-keyboard).

## Backend combine semantics (`FinanceService.combineContacts`)

- Requires ≥2 caller-owned contacts. Lead = `targetContactId` if given, else the ranking above.
- Applies name/alias/descriptor/linkedUserId; inherits missing phone, bank (number+code+name), avatar from sources.
- Reassigns sources' debts (`contactId`, `counterparty`, `counterpartyAlias`) and transactions (`contactId`) to the lead, deletes sources, then if `consolidateDebts` groups the lead's top-level debts by direction + currency and calls `combineDebts` for groups of ≥2.
- NOT a single DB transaction: the steps are sequential saves; a failure midway (e.g. during debt consolidation) leaves earlier steps committed. Each `combineDebts` call is itself transactional.
