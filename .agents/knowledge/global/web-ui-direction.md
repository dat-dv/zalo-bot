---
metadata:
  agent-artifact:
    id: global-web-ui-direction-knowledge
    type: documentation
    depends_on:
      - apps/web/src/styles.css
      - apps/web/src/shared/ui/data-table.tsx
      - apps/web/src/shared/ui/workspace-header.tsx
      - apps/web/src/shared/ui/app-navigation.tsx
      - apps/web/src/shared/providers/money-visibility-provider.tsx
      - apps/web/app/(private)/layout.tsx
      - apps/web/src/shared/ui/modal.tsx
      - apps/web/src/shared/ui/ios-viewport-fix.tsx
      - apps/web/src/shared/hooks/use-body-scroll-lock.ts
      - apps/web/src/shared/hooks/use-visual-viewport.ts
      - apps/web/app/layout.tsx
---

# Web UI Direction

> Developer guide (Vietnamese): [`web-ui-direction.md`](../../docs/global/web-ui-direction.md)

The web app is an operational, data-dense personal dashboard. Prefer one flat workspace, subtle borders, compact controls, and semantic table markup over decorative cards or heavy shadows. Tailwind CSS v4 is the exclusive styling foundation across 100% of web components and screens: all layout, panels, tables, dialogs, forms, KPI metrics, charts, and buttons use readable utility groups with responsive modifiers and `dark:` theme variants. `apps/web/src/styles.css` holds only `@import 'tailwindcss'`, the `@custom-variant dark` declaration, and a small base layer (`:root` text/background/font, `html[data-theme='dark']` colors, dark-mode `:focus-visible` outline color `#93c5fd`, `box-sizing`, `body` defaults); it has no BEM or component classes.

Shared UI primitives in `apps/web/src/shared/ui/` own reusable panel/table behavior. Tables fill their containing data panel on desktop, keep semantic headers, right-align numeric data, provide loading, empty, and populated states, and support smooth horizontal scrolling within their own wrapper on narrow mobile screens (`min-width: max-content` with column-level `minWidth` definitions to prevent data squashing). Action columns (`id: 'actions'`) must enforce adequate `minWidth` (120px–150px), use `flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap` on button containers, and apply `shrink-0 whitespace-nowrap` to each button (`Edit`, `Delete`, `Save`, `Cancel`, `Repay`, `Snooze`) and categorical badge to prevent unwanted line wrapping or broken button layouts.

Domain-specific tables must use unified Common Table components (`TransactionsTable`, `DebtsTable`, `TasksTable`, `RemindersTable`, `CalendarTable`) rather than duplicating `DataTableColumn` definitions across different views (Dashboard, Transactions, Debts, Tasks, Reminders, Calendar, Analytics). Common tables define standard columns, formatters, progress visualizers, category autocompletes, inline-editing inputs, and action buttons once, ensuring consistent row and column presentations, column-setting capabilities, and search filtering across all application screens.

DataTable includes a built-in Column Visibility Settings popover (`TableColumnSettings`) allowing users to toggle column display, reset defaults, and persist their custom column preferences in `localStorage` (`zalobot:table-columns:<id>`). Every row must provide a string `id`: DataTable prepends mandatory `STT` (the current displayed-row ordinal) and `ID` columns before domain columns. They cannot be hidden, and ID values use a compact monospace interactive button. Clicking an ID cell opens the Record Identifier Explainer modal (`IdExplainerDialog`), displaying database table metadata, full ID with a 1-click copy button, and preformatted AI Agent prompt templates (Update, Delete, Inspect) for seamless Zalo Bot interaction. DataTable sorts rows after filtering by their business occurrence time: historical records use newest first (`occurredAt`, then `paymentDate`, then `createdAt`), while scheduled records use nearest first (`remindAt`, `startAt`, or `dueAt`); missing scheduled times appear last. Tables with an `id` also expose header-edge drag resizing and persist valid column widths separately in `localStorage` (`zalobot:table-widths:<id>`); consumers can opt out with `allowColumnResize={false}`. Views own domain columns, fetching, errors, and actions.

Interactive controls need visible keyboard focus, sufficient contrast, and clear error/retry affordances. Secondary actions should not dominate primary operational work.

Private workspace headers are rendered once in the common private layout (`apps/web/app/(private)/layout.tsx`) via `<WorkspaceHeader />` with no props — the component auto-resolves title and subtitle from `usePathname()` using `ROUTE_HEADER_MAP`. It distinguishes two auth states: **Authenticated** (`hasToken && !isLoggedOut`, where `isLoggedOut` comes from the `?status=logged_out` query): renders route title/subtitle, Money Visibility toggle (`useMoneyVisibility`), Refresh button (`queryClient.invalidateQueries()`), and Logout button; **Unauthenticated/LoggedOut**: renders route title/subtitle and an "Open Zalo Bot" external link (`auth.openzaloBot`, URL from `NEXT_PUBLIC_ZALO_BOT_URL` / `NEXT_PUBLIC_ZALO_BOT_USERNAME`, default `https://zalo.me`). All module screen files must NOT render their own `<WorkspaceHeader>` — the layout provides it universally. Masking replaces financial amounts across KPI metric blocks, data tables, and chart tooltips with `common.maskedAmount` (`'••••••'`). Amounts are hidden by default; the choice persists in `localStorage` key `zalobot-money-visibility`. Inline editing inputs remain unmasked for immediate correction.

The shared navigation (`apps/web/src/shared/ui/app-navigation.tsx`) is an admin-style sidebar on desktop: product mark, five sections (`nav.section.overview`, `finance`, `planning`, `data`, `system`), icon-and-text links, a locale selector, and a semantic active state. Desktop private routes use a viewport-bound shell: only the main content pane scrolls, while the sidebar remains fixed beside it. It must retain visible text plus `aria-current` for the active route. On narrow screens (<= 960px), the shell returns to normal document scrolling and navigation transitions to a sticky mobile topbar with a brand mark and an accessible hamburger button that opens a smooth slide-out navigation drawer with backdrop overlay.

Dark mode is activated by `html[data-theme='dark']`; Tailwind dark utilities target this same data attribute via `@custom-variant dark`. All surfaces (desktop/mobile navigation, workspace headers, period controls, data panels, forms, dialogs, charts, and public/legal pages) use Tailwind dark utilities (`dark:bg-*`, `dark:border-*`, `dark:text-*`, `dark:hover:*`, `dark:focus:*`). Keep the selected navigation/action state high contrast and retain a visible light-blue keyboard focus outline.

## Skeleton & Loading State Full Fidelity

Skeleton loading states must achieve strict 1:1 structural, spatial, and visual boundary parity with real rendered components:

1. **Cell-Level Border & Column Width Parity**: `DataTable` skeleton rows (`loading === true`) must render explicit vertical and bottom cell borders (`border-r border-b border-r-slate-50 border-b-slate-100 last:border-r-0 dark:border-r-slate-900/60 dark:border-b-slate-800`) and apply `style={{ minWidth: column.minWidth, width: getColumnWidth(column) }}` on every `td`. Right-aligned numeric and action columns (`align === 'right'`) must align their pulse bars to the right (`ml-auto`) to match loaded layout metrics.
2. **Container Preservation**: Skeletons must never collapse or omit outer wrapper containers. `DataPanel` containers with outer borders (`border border-slate-200`), headers (`border-b`), search inputs, `PeriodFilterToolbar` blocks, and Quick Links bars must remain fully rendered during loading.
3. **No Raw Text Loading**: Replacing full page structures with bare text banners (e.g. `<div className="p-4">Loading...</div>`) is strictly forbidden. Screens must preserve their layout shells and forward `loading={true}` to nested tables and charts.
4. **No Duplicate or Shifting Headers**: Because `WorkspaceHeader` is universally mounted in `PrivateLayout`, view-level skeletons must never inject an extra `<header>` tag.

## Mobile Dialogs & On-Screen Keyboard

Every modal/dialog renders through the shared `Modal` shell (`apps/web/src/shared/ui/modal.tsx`); hand-rolled `fixed inset-0` overlays are forbidden (the mobile navigation drawer backdrop is the only exception).

1. **Layout**: desktop (>= 640px) centers the panel; mobile (< 640px) renders a bottom sheet — full width, pinned to the bottom edge, top corners rounded, `env(safe-area-inset-bottom)` padding. Callers pass only visual styling via `panelClassName` (width cap, border, radius, background).
2. **Keyboard-safe sizing**: the overlay is sized to the visual viewport (`--app-vvh` / `--app-vv-top`, written by `useVisualViewportVars` while a dialog is open; fallback `100dvh`). The panel is the scroll container (`max-h-full overflow-y-auto overscroll-contain`). Headers use `MODAL_STICKY_HEADER`, action rows use `MODAL_STICKY_FOOTER`, both with an opaque background, so title and submit/cancel stay visible above the keyboard. A focused field inside the panel is scrolled into view after ~300ms.
3. **Behavior**: `onDismiss` handles Escape (top-most dialog only) and, with `dismissOnBackdrop`, backdrop clicks; pass `undefined` while a mutation is pending. Opening focuses the panel (never an input, to avoid popping the keyboard), traps Tab, and restores focus on close. Page scroll is locked via ref-counted `useBodyScrollLock`, shared with the navigation drawer.
4. **Layers**: dialogs use `z-[900]`; `layer="top"` (`z-[950]`) is for dialogs stacked over another (DataTable ID explainer). `CategoryAutocomplete` portal menus use `z-[1000]` so they float above dialogs.
5. **Viewport & zoom**: root `viewport` sets `interactiveWidget: 'resizes-content'` (Android Chrome shrinks the layout viewport for the keyboard) and keeps `maximumScale: 5`. Compact control font sizes (< 16px) are intentional and must not be bumped for mobile; instead `IosViewportFix` (mounted in `AppProviders`) adds `maximum-scale=1` on iOS/iPadOS only, which stops Safari's focus auto-zoom while manual pinch-zoom still works.
6. **Viewport units**: use `dvh` (`h-dvh`, `min-h-dvh`) instead of `100vh`/`h-screen` for full-height shells. Fixed bottom toasts offset by `env(safe-area-inset-bottom)` and stretch to `left-4` on mobile.
