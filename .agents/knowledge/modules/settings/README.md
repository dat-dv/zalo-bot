# Settings Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/settings/README.md)

## Purpose

`apps/web/src/modules/settings` manages the user's income/expense transaction categories, shows workspace preferences, and lets admins pick webhook recipients.

## Code layout

- `api/categories-api.ts`: `getCategories(type?)` (`API_ROUTES.categories`, optional `?type=income|expense`), `createCategory`, `updateCategory`, `deleteCategory` (`/api/categories/:id`).
- `api/categories-query.ts`: `categoriesQueryKeys.all` (`['categories']`), `list(type)`; hooks `useCategoriesQuery`, `useCreateCategoryMutation`, `useUpdateCategoryMutation`, `useDeleteCategoryMutation`. Mutations invalidate `categoriesQueryKeys.all`.
- `presentation/components/settings-screen.tsx` (`SettingsScreen`), re-exported by `view/settings-screen.tsx`.
- `presentation/components/install-app-row.tsx` (`InstallAppRow`): the Preferences "Mobile app" row.
- `api/webhook-recipients-api.ts` / `api/webhook-recipients-query.ts`: `GET`/`PUT` `API_ROUTES.webhookRecipients`; `useWebhookRecipientsQuery`, `useUpdateWebhookRecipientsMutation` (writes the saved list into the query cache).
- `model/webhook-recipients.ts`: pure helpers `buildWebhookRecipientRows`, `filterWebhookRecipientRows`, `toggleWebhookRecipient`, `isSameRecipientSet`.
- `presentation/components/webhook-recipients-panel.tsx` (`WebhookRecipientsPanel`): the Webhook tab.
- Backend endpoints live in `apps/api/src/finance/finance.controller.ts` (`GET/POST /categories`, `PATCH/DELETE /categories/:id`); webhook recipients in `apps/api/src/zca/webhook/webhook-recipients.controller.ts`.

## UI (`SettingsScreen`)

- Page header (title, subtitle, Refresh, Logout) comes from the private layout `WorkspaceHeader`; the screen renders none.
- Three tabs: `categories` (default), `preferences`, `webhook`.
- **Webhook tab** (`WebhookRecipientsPanel`, admin APIs; non-admins see the load error): chats from `useZcaThreadsQuery` (`GET /api/zca/threads`, directory cache, `missingFromZalo` placeholders dropped) merged with saved recipients; picked rows first, then groups, then name. Saved recipients Zalo no longer returns stay as rows marked `settings.webhook.missing`. Rows show avatar (or initial), name, type, id. Checkbox toggles a local draft (null until edited); Save sends the whole draft via `PUT`, Undo drops it; both disabled while unchanged. Filter chips All / Selected / Groups / People, accent-insensitive search by name or id. The ID cell copies the `targetId`. Header shows `GET /api/webhooks/targets`, `POST /api/webhooks/send` and the recipient rule. Backend rules: `modules/zca/webhook.md`.
- **Categories tab**: two `DataPanel`s (expense, income). Each has client search by name, inline add (`settings.categories.addExpense` / `addIncome`; Enter saves, Escape cancels), inline rename (double-click or Edit; Enter/Escape), delete with `window.confirm`. Action buttons use `flex-nowrap whitespace-nowrap` / `shrink-0`. Loading and empty (`settings.categories.empty`) states come from the table; error state shows an alert with Retry.
- **Preferences tab** (static info + tools):
  - Language and Theme: informational rows with a "Supported" badge (no switcher here).
  - Mobile app (`InstallAppRow`, after Theme): the only install entry point of the PWA (see `global/pwa.md`). Reads `usePwaStore`: `installed` -> "Installed" badge; a captured `installPrompt` (Chromium) -> "Install app" button calling `prompt()` (a dismissed prompt is dropped, it can be used once); otherwise a hint chosen by user agent: Zalo in-app browser -> open in Safari/Chrome, iOS -> Share -> Add to Home Screen, else unsupported. User agent is read with `useSyncExternalStore` (empty on the server).
  - Wallet & Balance: button opens `AdjustBalanceModal` (`@/modules/dashboard/presentation/components/adjust-balance-modal`) to reconcile the ledger balance with a real wallet balance; `currentBalance` = `dashboard.finance.ledgerBalance` (all-time income − expense).
  - React Scan: toggle bound to `useReactScan()`.
- **Compact / phone** (desktop unchanged): both category `DataTable`s use the mobile list (<= 960px): primary `name`, secondary type label; no trailing (categories carry no count/usage). Rename goes through the sheet footer Edit (input 40px), Save/✕ and Delete sit in the sheet footer. At <= 640px the tabs are one sideways-scrolling row of 32px chips (`MOBILE_TOOLBAR_ROW`, `PHONE_CHIP`); panel toolbars stack a full-width 36px search (`PHONE_TOOLBAR_INPUT`) over a full-width 32px Add chip (`PHONE_CHIP`); the inline add row's input and ✓/✕ are 40px (`TAP_CONTROL`); Preferences buttons are 40px and the panel padding shrinks. Category panels stack at 640px (`grid-cols-1`). Toast uses `TOAST_POSITION`; Retry 40px.

## React Scan (known gap)

- `ReactScanProvider` (`apps/web/src/shared/providers/react-scan-provider.tsx`) only stores a boolean in `localStorage` key `zalobot-react-scan-enabled` (default off) and exposes it via context.
- Nothing imports `react-scan` (the package is declared in `apps/web/package.json`), so toggling it currently has **no effect** on rendering or profiling.

## Buttons

- Colours come from `BUTTON_TONE`; cursor, disabled dimming, focus outline and transitions come from the base layer, so buttons here never re-spell them. `+ Add category` (income and expense) is `primary`; Adjust balance and Install app are `secondary`; the React Scan switch is `chip`/`chipSelected`; row 🗑 delete is `dangerSoft`; Retry is `danger`. The toast uses the dark toast tone. See [web-ui-direction](../../global/web-ui-direction.md#button-interaction-states).
