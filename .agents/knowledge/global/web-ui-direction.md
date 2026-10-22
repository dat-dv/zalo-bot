---
metadata:
  agent-artifact:
    id: global-web-ui-direction-knowledge
    type: documentation
    depends_on:
      - apps/web/src/styles.css
      - apps/web/src/shared/ui/data-table.tsx
      - apps/web/src/shared/ui/data-table-mobile.ts
      - apps/web/src/shared/ui/data-table-mobile-list.tsx
      - apps/web/src/shared/hooks/use-media-query.ts
      - apps/web/src/shared/ui/period-filter-toolbar.tsx
      - apps/web/src/shared/ui/workspace-header.tsx
      - apps/web/src/shared/ui/app-navigation.tsx
      - apps/web/src/shared/store/money-visibility-store.ts
      - apps/web/src/shared/store/theme-store.ts
      - apps/web/src/shared/providers/app-providers.tsx
      - apps/web/app/(private)/layout.tsx
      - apps/web/src/shared/ui/modal.tsx
      - apps/web/src/shared/ui/ios-viewport-fix.tsx
      - apps/web/src/shared/hooks/use-body-scroll-lock.ts
      - apps/web/src/shared/hooks/use-visual-viewport.ts
      - apps/web/app/layout.tsx
      - apps/web/src/shared/ui/breakpoints.ts
      - apps/web/src/shared/ui/touch.ts
      - apps/web/src/shared/ui/mobile-action-bar.tsx
      - apps/web/src/shared/hooks/use-swipe-dismiss.ts
      - apps/web/src/shared/hooks/swipe-dismiss.ts
      - apps/web/src/shared/ui/pull-to-refresh.tsx
---

# Web UI Direction

> Developer guide (Vietnamese): [`web-ui-direction.md`](../../docs/global/web-ui-direction.md)

The web app is an operational, data-dense personal dashboard. Prefer one flat workspace, subtle borders, compact controls, and semantic table markup over decorative cards or heavy shadows. Tailwind CSS v4 is the exclusive styling foundation across 100% of web components and screens: all layout, panels, tables, dialogs, forms, KPI metrics, charts, and buttons use readable utility groups with responsive modifiers and `dark:` theme variants. `apps/web/src/styles.css` holds only `@import 'tailwindcss'`, the `@custom-variant dark` declaration, and a small base layer (`:root` text/background/font, `html[data-theme='dark']` colors, dark-mode `:focus-visible` outline color `#93c5fd`, `box-sizing`, `body` defaults); it has no BEM or component classes.

Shared UI primitives in `apps/web/src/shared/ui/` own reusable panel/table behavior. Tables fill their containing data panel on desktop, keep semantic headers, right-align numeric data, provide loading, empty, and populated states, and, unless the table opts into the mobile list (below), support smooth horizontal scrolling within their own wrapper on narrow mobile screens (`min-width: max-content` with column-level `minWidth` definitions to prevent data squashing). Action columns (`id: 'actions'`) must enforce adequate `minWidth` (120px–150px), use `flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap` on button containers, and apply `shrink-0 whitespace-nowrap` to each button (`Edit`, `Delete`, `Save`, `Cancel`, `Repay`, `Snooze`) and categorical badge to prevent unwanted line wrapping or broken button layouts.

Domain-specific tables must use unified Common Table components (`TransactionsTable`, `DebtsTable`, `TasksTable`, `RemindersTable`, `CalendarTable`) rather than duplicating `DataTableColumn` definitions across different views (Dashboard, Transactions, Debts, Tasks, Reminders, Calendar, Analytics). Common tables define standard columns, formatters, progress visualizers, category autocompletes, inline-editing inputs, and action buttons once, ensuring consistent row and column presentations, column-setting capabilities, and search filtering across all application screens.

DataTable includes a built-in Column Visibility Settings popover (`TableColumnSettings`) allowing users to toggle column display, reset defaults, and persist their custom column preferences in `localStorage` (`zalobot:table-columns:<id>`). Every row must provide a string `id`: DataTable prepends mandatory `STT` (the current displayed-row ordinal) and `ID` columns before domain columns. They cannot be hidden, and ID values use a compact monospace interactive button. Clicking an ID cell opens the Record Identifier Explainer modal (`IdExplainerDialog`), displaying database table metadata, full ID with a 1-click copy button, and preformatted AI Agent prompt templates (Update, Delete, Inspect) for seamless Zalo Bot interaction. DataTable sorts rows after filtering by their business occurrence time: historical records use newest first (`occurredAt`, then `paymentDate`, then `createdAt`), while scheduled records use nearest first (`remindAt`, `startAt`, or `dueAt`); missing scheduled times appear last. Tables with an `id` also expose header-edge drag resizing and persist valid column widths separately in `localStorage` (`zalobot:table-widths:<id>`); consumers can opt out with `allowColumnResize={false}`. Views own domain columns, fetching, errors, and actions.

## Compact Shell: Breakpoints, Tab Bar, Safe Areas

Goal: on phones the dashboard should behave like a native app (thumb navigation, no sideways tables, nothing under the notch), not a shrunken desktop page.

- **Breakpoints** (`breakpoints.ts`, single source): `PHONE_MAX_WIDTH = 640` (list rows, bottom sheets, 40px targets; Tailwind `max-sm:` / `max-[640px]:`) and `COMPACT_MAX_WIDTH = 960` (top bar + bottom tab bar + DataTable mobile list; Tailwind `max-[960px]:`). Hooks `useIsPhone()` / `useIsCompact()` in `use-media-query.ts` (desktop assumed until hydrated). Do not hardcode other widths.
- **Bottom tab bar** (`AppNavigation`, <= 960px): fixed, 56px + `env(safe-area-inset-bottom)`, five equal items: Overview, Transactions, Debts (short label `nav.tab.debts`), Calendar, and **More** (`nav.more`, opens the existing drawer; active when the drawer is open or the current route is not one of the four). Tabs reuse `navSections` items and icons (20px), `aria-current="page"` on the active tab, `aria-label` `nav.tabBar`. Desktop has no tab bar.
- **Safe areas**: root viewport sets `viewportFit: 'cover'`. The private layout pads `env(safe-area-inset-top|left|right)` and reserves `56px + 1.25rem + env(safe-area-inset-bottom)` at the bottom for the tab bar. The sticky topbar sticks at `env(safe-area-inset-top)`; an opaque page-colored strip covers the status-bar area. The drawer pads top/bottom/left insets and scrolls on its own.
- **Drawer**: `inert` while closed on compact screens (links leave tab order/accessibility tree); desktop sidebar never inert.
- **Touch CSS** (`styles.css`): `-webkit-tap-highlight-color: transparent`; `touch-action: manipulation` on interactive elements (no double-tap zoom delay; pinch zoom kept).
- **Shared sizing classes** (`touch.ts`): `TAP_CONTROL`, `TAP_INPUT` (40px at phone width), `MOBILE_TOOLBAR_ROW` (one sideways-scrolling chip row), `TOAST_POSITION` (bottom-right on desktop; full width above the tab bar on compact). New mobile work uses these instead of re-spelling classes.
- **Toasts**: all screens move to `TOAST_POSITION` (done: Dashboard home, Transactions, Places, Tasks, Reminders, Calendar; other modules move when their screens get mobile work).
- **Primary action bar** (`MobileActionBar`, `MOBILE_ACTION_BUTTON`): on compact screens a screen's existing primary action moves from the top toolbar to a bar fixed above the tab bar (40px buttons, `rounded-[3px]`, in-flow spacer so content is not hidden); the toolbar button gets `max-[960px]:hidden`. Used by Transactions (Adjust balance) and Places (+ Create, hidden while the inline create form is open). Never used to add features a screen does not already have; no round FABs.

## Mobile List Mode (DataTable, compact <= 960px)

Wide tables are unreadable on phones (STT + ID alone fill a 375px screen), so DataTable can render a phone-width list instead (`data-table-mobile-list.tsx`).

- **Opt-in**: active only when the viewport matches `COMPACT_MEDIA_QUERY` (`(max-width: 960px)`, `useIsCompact`, desktop assumed until hydrated; tablets/landscape phones get the list too because they also get the tab bar), at least one column declares `mobileSlot`, and `mobileList` is not `false`. Tables without slots keep the scrolling table; on compact screens that table drops its inner `max-h-[520px]` box (the page scrolls) and keeps only sideways scrolling. `TransactionsTable` enables it by default (`mobileList` defaults to `true`).
- **Column contract** (`DataTableColumn`): `mobileSlot: 'primary' | 'secondary' | 'trailing'`, `mobileCell` (plain, non-interactive row content; defaults to `cell`), `mobileHeader` (show the header, e.g. its column filter, in the list's filter strip). Slot partitioning is the pure helper `partitionMobileColumns` (`data-table-mobile.ts`, unit-tested).
- **Row**: one flat `<button>` per record, min 52px, `border-b`, no card/shadow. Line 1: primary (truncate) + trailing (amount, `tabular-nums`). Line 2: secondary cells joined by ` · `, blank values skipped.
- **Hidden on mobile list**: STT and ID columns, column settings bar, resize handles, the inner `max-h-[520px]` scroll box (the page scrolls).
- **Detail sheet**: tapping a row opens a `Modal` (bottom sheet) listing every domain column as label/value using `column.cell`, so inline editing (inputs when `editingId` matches) works inside the sheet; the sheet auto-sizes text inputs, selects, textareas and buttons inside values, and every footer action button, to 40px (desktop-sized 22–28px controls need no per-table classes); touch editing goes through the footer Edit button, never double-click; an ID row opens `IdExplainerDialog`; `renderExpandedRow` always renders below; the `actions` column renders in the sticky footer. The sheet closes when its row leaves `rows` (deleted/filtered).
- **Loading/empty**: 4 skeleton rows of the same 52px height inside the same container; empty shows `emptyMessage`.
- **Transactions mapping**: primary `note`, trailing signed amount (no ratio bar), secondary `category` · date (dd/MM) · creator · place; `type`, `receipt`, `runningBalance` appear only in the sheet. Filterable columns set `mobileHeader` when server-side column filters are enabled.

## Mobile Touch Targets & Corner Radius

- At phone width every control the user taps is >= 40px tall: mobile topbar and drawer controls (<= 960px), list rows, sheet buttons, Transactions toolbar chips/search/load-more, `PeriodFilterToolbar` grains and arrows, column-filter triggers, and inline-edit inputs in the Transactions sheet. Desktop keeps the compact 22–30px controls.
- Phone toolbars use one horizontally scrolling chip row (`flex-nowrap overflow-x-auto`) instead of stacking one chip per row; `PeriodFilterToolbar` on phones swaps the grain button group for a native 40px `<select>` (`period.grain`) so grain + prev/label/next fit one 40px row (label truncates); desktop keeps the button group.
- Corner radius stays small and unchanged (`rounded-[2px]`, `rounded-[3px]`, `rounded`). Do not introduce pill/`rounded-full` chips, rounded FABs, or radius "unification" in mobile work.

Interactive controls need visible keyboard focus, sufficient contrast, and clear error/retry affordances. Secondary actions should not dominate primary operational work.

Private workspace headers are rendered once in the common private layout (`apps/web/app/(private)/layout.tsx`) via `<WorkspaceHeader />` with no props — the component auto-resolves title and subtitle from `usePathname()` using `ROUTE_HEADER_MAP`. It distinguishes two auth states: **Authenticated** (`hasToken && !isLoggedOut`, where `isLoggedOut` comes from the `?status=logged_out` query): renders route title/subtitle, Money Visibility toggle (`useMoneyVisibility`), Refresh button (`queryClient.invalidateQueries()`), and Logout button; **Unauthenticated/LoggedOut**: renders route title/subtitle and an "Open Zalo Bot" link (`auth.openzaloBot`; tries the Zalo app via `zalo://`, falls back to `https://chat.zalo.me`; see `modules/auth/README.md`). All module screen files must NOT render their own `<WorkspaceHeader>` — the layout provides it universally. Route title, auth state, refresh, and logout come from the shared hook `useWorkspaceHeader()` (same file). At <= 960px `WorkspaceHeader` is hidden (`max-[960px]:hidden`) and the mobile topbar in `AppNavigation` takes over: `[hamburger] [route title] [money visibility icon] [refresh icon]` (all icon buttons 40px), or the "Open Zalo Bot" link when unauthenticated; the subtitle is not shown on mobile and Logout moves to the drawer footer (above the theme toggle). Masking replaces financial amounts across KPI metric blocks, data tables, and chart tooltips with `common.maskedAmount` (`'••••••'`). Amounts are hidden by default; the choice lives only in the in-memory Zustand store `useMoneyVisibilityStore` (`apps/web/src/shared/store/money-visibility-store.ts`, no `persist` middleware, never `localStorage`), surviving in-app navigation but resetting to hidden on every page load/F5. Amount ratio bars under table amounts (Transactions, Expenses) and in `DebtStructureChart` render only while amounts are revealed, since bar length leaks relative size; the debt paid-% progress bar stays. Inline editing inputs remain unmasked for immediate correction.

The shared navigation (`apps/web/src/shared/ui/app-navigation.tsx`) is an admin-style sidebar on desktop: product mark, five sections (`nav.section.overview`, `finance`, `planning`, `data`, `system`), icon-and-text links, a locale selector, and a semantic active state. Desktop private routes use a viewport-bound shell: only the main content pane scrolls, while the sidebar remains fixed beside it. It must retain visible text plus `aria-current` for the active route. On narrow screens (<= 960px), the shell returns to normal document scrolling, a bottom tab bar appears (see Compact Shell), and navigation transitions to a sticky mobile topbar (hamburger, route title, money/refresh icon buttons; see the header paragraph) whose 40px hamburger opens a smooth slide-out navigation drawer with backdrop overlay. Drawer links, Logout, theme toggle, and language select are 40px tall at this width; the brand mark appears only inside the drawer.

Dark mode is activated by `html[data-theme='dark']`; the inline script in `app/layout.tsx` sets it before hydration, and `useThemeStore` (`apps/web/src/shared/store/theme-store.ts`) starts as `light`, syncs from `document.documentElement.dataset.theme` in the `AppProviders` mount effect, and persists toggles to `localStorage['zalobot-theme']`; Tailwind dark utilities target this same data attribute via `@custom-variant dark`. All surfaces (desktop/mobile navigation, workspace headers, period controls, data panels, forms, dialogs, charts, and public/legal pages) use Tailwind dark utilities (`dark:bg-*`, `dark:border-*`, `dark:text-*`, `dark:hover:*`, `dark:focus:*`). Keep the selected navigation/action state high contrast and retain a visible light-blue keyboard focus outline.

## Skeleton & Loading State Full Fidelity

Skeleton loading states must achieve strict 1:1 structural, spatial, and visual boundary parity with real rendered components:

1. **Cell-Level Border & Column Width Parity**: `DataTable` skeleton rows (`loading === true`) must render explicit vertical and bottom cell borders (`border-r border-b border-r-slate-50 border-b-slate-100 last:border-r-0 dark:border-r-slate-900/60 dark:border-b-slate-800`) and apply `style={{ minWidth: column.minWidth, width: getColumnWidth(column) }}` on every `td`. Right-aligned numeric and action columns (`align === 'right'`) must align their pulse bars to the right (`ml-auto`) to match loaded layout metrics.
2. **Container Preservation**: Skeletons must never collapse or omit outer wrapper containers. `DataPanel` containers with outer borders (`border border-slate-200`), headers (`border-b`), search inputs, `PeriodFilterToolbar` blocks, and Quick Links bars must remain fully rendered during loading.
3. **No Raw Text Loading**: Replacing full page structures with bare text banners (e.g. `<div className="p-4">Loading...</div>`) is strictly forbidden. Screens must preserve their layout shells and forward `loading={true}` to nested tables and charts.
4. **No Duplicate or Shifting Headers**: Because `WorkspaceHeader` is universally mounted in `PrivateLayout`, view-level skeletons must never inject an extra `<header>` tag.

## Touch Feedback, Motion & Gestures

- **Pressed state** (`styles.css`, `@media (hover: none)` only): the tap highlight is transparent, so enabled buttons, links, `[role=button]`, `[role=tab]` dim to `opacity: 0.6` while pressed (120ms); mobile list rows also darken their background (`active:`). The same selectors get `user-select: none` and `-webkit-touch-callout: none` (nav too) so long-press never selects chrome text or opens the system menu; inputs and detail text stay selectable.
- **Installed app** (`@media (display-mode: standalone)`): `overscroll-behavior-y: none` on `html`/`body`, no rubber-band revealing the background.
- **Reduced motion**: `prefers-reduced-motion: reduce` cuts every transition/animation to ~0ms.
- **Modal motion**: `Modal` keeps the dialog mounted 200ms after `open` turns false (`rendered` vs `open`). Enter uses Tailwind `starting:` (`@starting-style`): phone sheets slide up from `translate-y-full`, larger screens fade/scale from `.98`; exit reverses; the backdrop fades. Browsers without `@starting-style` just skip the motion. A Modal unmounted by its caller (`{x && <Modal open />}`) has no exit motion.
- **Swipe to dismiss** (`use-swipe-dismiss.ts`, touch events because iOS cancels pointer events once the page pans; pure math in `swipe-dismiss.ts` with spec): the surface follows the finger, movement the wrong way is resisted (1/4), release past 25% of its size or faster than 0.5px/ms slides it out and dismisses, otherwise it springs back (220ms). Phone sheets: drag from the top 64px (grab bar + header), only when the Modal has `onDismiss` and is not `phoneLayout="fullscreen"`. Navigation drawer: swipe left while open on compact screens.
- **Pull to refresh** (`pull-to-refresh.tsx`, mounted in the private layout): only in the installed app on compact screens (browsers have their own). At the top of the page, pulling shows a status chip under the topbar (`pullToRefresh.pull|release|refreshing`); release past 64px (half-speed resistance, max 96px) runs `queryClient.invalidateQueries()` like the topbar ↻ and keeps spinning until queries settle. Ignored while a dialog/drawer holds the scroll lock (`isDocumentScrollLocked`).
- **Tab bar**: a tapped tab highlights immediately (`pendingTab`, cleared on route change) and shows a 2px pulsing bar while `useLinkStatus().pending`. Visible tab links are prefetched by `next/link` already.

## Mobile Dialogs & On-Screen Keyboard

Every modal/dialog renders through the shared `Modal` shell (`apps/web/src/shared/ui/modal.tsx`), built on native `<dialog>` + `showModal()`; hand-rolled `fixed inset-0` overlays are forbidden (the mobile navigation drawer backdrop is the only exception). Requires Safari >= 15.4; no polyfill.

1. **Layout**: desktop (>= 640px) centers the panel; mobile (< 640px) renders a bottom sheet — full width, pinned to the bottom edge, top corners rounded, `env(safe-area-inset-bottom)` padding, and a decorative 36×4px grab bar at the top (no drag gesture yet). `phoneLayout="fullscreen"` instead fills the screen on phones (no gap, no grab bar, `env(safe-area-inset-top)` padding) for long forms. Callers pass only visual styling via `panelClassName` (width cap, border, radius, background). Append `MODAL_CLOSE_TAP` to close (✕) buttons and `MODAL_FOOTER_TAP` to footer action buttons for 40px phone targets.
2. **Keyboard-safe sizing**: the `<dialog>` element (UA margin/max-size/border/padding/colors reset; `::backdrop` transparent, the visible backdrop is an inner `div` styled by `backdropClassName`) is sized to the visual viewport (`--app-vvh` / `--app-vv-top`, written by `useVisualViewportVars` while a dialog is open; fallback `100dvh`). The panel is the scroll container (`max-h-full overflow-y-auto overscroll-contain`). Headers use `MODAL_STICKY_HEADER`, action rows use `MODAL_STICKY_FOOTER`, both with an opaque background, so title and submit/cancel stay visible above the keyboard. A focused field inside the panel is scrolled into view after ~300ms.
3. **Behavior**: React owns `open`. Escape arrives as the native `cancel` event (top-most dialog only), which is always `preventDefault`ed and forwarded to `onDismiss`; with `dismissOnBackdrop`, backdrop clicks also call it. Pass `undefined` while a mutation is pending. If the browser force-closes anyway, `close` dismisses or reopens to stay in sync. `showModal()` makes the rest of the page inert (Tab cannot leave the dialog). The panel carries `autofocus` so opening focuses the panel, never an input (avoids popping the keyboard). Focus returns to the opener on close; `Modal` restores it manually because React detaches the `<dialog>` before effect cleanup when `open` flips on a mounted `Modal`. Page scroll is locked via ref-counted `useBodyScrollLock`, shared with the navigation drawer.
4. **Layers**: dialogs live in the browser top layer, above every z-index; a later dialog stacks above an earlier one (DataTable ID explainer over another dialog), so there is no z-index/`layer` prop. Anything portaled to `document.body` renders *under* an open dialog: floating UI used inside dialogs must portal into `element.closest('dialog') ?? document.body` (as `CategoryAutocomplete` does, menu `z-[100]`). Screen toasts render outside any dialog, so they are hidden while a dialog is open.
5. **Viewport & zoom**: root `viewport` sets `interactiveWidget: 'resizes-content'` (Android Chrome shrinks the layout viewport for the keyboard) and keeps `maximumScale: 5`. Compact control font sizes (< 16px) are intentional and must not be bumped for mobile; instead `IosViewportFix` (mounted in `AppProviders`) adds `maximum-scale=1` on iOS/iPadOS only, which stops Safari's focus auto-zoom while manual pinch-zoom still works.
6. **Viewport units**: use `dvh` (`h-dvh`, `min-h-dvh`) instead of `100vh`/`h-screen` for full-height shells. Fixed bottom toasts offset by `env(safe-area-inset-bottom)` and stretch to `left-4` on mobile.

## Global Client UI State

App-wide client-only UI state (theme, money visibility) lives in Zustand stores under `apps/web/src/shared/store/` (rule 07, Tier 4). The web app is a static export with no server runtime, so module-level `create()` singletons are safe (no per-request store factory). Stores keep only sync UI state; derived values (e.g. `money()` formatter combining visibility + locale) are computed in hooks, never stored. Public hooks: `useTheme()`, `useMoneyVisibility()`, `useMoneyFormatter()`. `AppProviders` keeps only `ErrorBoundary`, `ReactScanProvider`, `QueryClientProvider`, and `LocaleProvider` (locale stays React Context).
