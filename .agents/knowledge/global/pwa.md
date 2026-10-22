---
metadata:
  agent-artifact:
    id: global-pwa-knowledge
    type: documentation
    depends_on:
      - apps/web/app/manifest.ts
      - apps/web/public/icon.svg
      - apps/web/public/icon-maskable.svg
      - apps/web/public/favicon.svg
      - apps/web/public/og-image.svg
      - apps/web/app/layout.tsx
      - apps/web/public/sw.js
      - apps/web/public/offline.html
      - apps/web/next.config.ts
      - apps/web/nginx.conf
      - apps/web/src/shared/pwa
      - apps/web/src/shared/ui/pwa-status-stack.tsx
      - apps/web/src/shared/providers/app-providers.tsx
      - apps/web/src/modules/settings/presentation/components/install-app-row.tsx
---

# Installable Web App (PWA)

Human guide: [PWA](../../docs/global/pwa.md).

Owner: Core Engineering Team
Status: active

## Purpose

The dashboard can be installed on the phone home screen and opened full screen like an app, keeps working as a shell offline, and picks up new deploys without users clearing caches. No push notifications (reminders already go through Zalo).

## Manifest (`app/manifest.ts`)

- Next metadata route, `dynamic = 'force-static'`, exported as `/manifest.webmanifest`; Next injects `<link rel="manifest">` (no `manifest` field in `layout.tsx`). Replaces the old `public/site.webmanifest`.
- `id`/`start_url`/`scope` = `APP_ROUTES.home`. Never change `id`: browsers would treat it as a different app.
- `display: standalone`, `orientation: portrait-primary`, `lang: vi`, colors match `layout.tsx` (`#0f172a` theme, `#090d16` background).
- Icons: `icon-192.png`/`icon-512.png` (`any`), `icon-maskable-192.png`/`icon-maskable-512.png` (`maskable`: full-bleed background, mark scaled to 80% inside the safe zone), `icon.svg`.
- Brand mark = monogram **Z** (one outline path, 80px strokes on a 512 grid, gradient `#38bdf8 → #2563eb → #4f46e5`, accent node top-right, dark gradient tile; replaced the leftover Telegram-era T on 2026-10-22). Hand-written SVG sources in `public/`: `icon.svg` (rounded tile → `icon-192/512.png`), `icon-maskable.svg` (full-bleed, mark at 80%; not in the manifest → `icon-maskable-192/512.png`, `apple-touch-icon.png` 180), `favicon.svg` (32px, same outline scaled → `favicon.ico` 16+32), `og-image.svg` (white Z monogram → `og-image.png` 1200×630). PNG/ICO are exported from these sources (sharp + ImageMagick, no build step); edit the SVG, re-export, never hand-edit the PNGs. Installed apps keep the old home-screen icon until re-added.
- Shortcuts (names from i18n `nav.*`, default locale): Transactions, Debts, Reminders.
- iOS meta stays in `layout.tsx` (`appleWebApp`, `apple-touch-icon`, `viewportFit: 'cover'`).

## Service worker (`public/sw.js`)

- Hand-written plain JS, no build step or library. Registered as `/sw.js?v=<NEXT_PUBLIC_APP_VERSION>`; `NEXT_PUBLIC_APP_VERSION` is `apps/web/package.json` `version`, injected by `next.config.ts` (`env`), bumped on every commit. A new version installs a new worker; caches are named `zalobot-{shell|pages|assets}-<version>` and old `zalobot-*` caches are deleted on `activate`.
- Install precaches `/offline.html`, the manifest and icons.
- Not intercepted (always network): non-GET, other origins, `/api/`, `/oauth2callback`. Finance data is never cached; the sign-in link and OAuth redirects reach the server untouched.
- Navigations: network first; a successful response is stored per URL; offline falls back to that URL's copy (also ignoring the query string), then `/offline.html`.
- `/_next/static/*`: cache first (hashed, immutable). Same-origin images/icons/fonts: stale-while-revalidate.
- The worker never calls `skipWaiting` on its own; it waits for a `{ type: 'SKIP_WAITING' }` message from the page.
- `offline.html`: self-contained (inline CSS, vi/en, light/dark), Retry button, reloads itself on `online`.

## Client side (`src/shared/pwa`)

- `pwa-environment.ts` (pure, with spec): `isIosUserAgent` (iPadOS desktop UA counts when touch points > 1), `isZaloInAppUserAgent`, `shouldRegisterServiceWorker` (production build + secure context + `serviceWorker` support; never in `next dev`).
- `pwa-store.ts` (Zustand): `waitingWorker`, `installPrompt` (`BeforeInstallPromptEvent`, checked by `isBeforeInstallPromptEvent`), `installed`.
- `pwa-registrar.tsx` (`PwaRegistrar`, mounted once in `AppProviders`, renders nothing):
  - Marks `installed` when running standalone; captures `beforeinstallprompt` (prevents Chrome's mini-infobar) and `appinstalled`.
  - Registers the worker; a worker that reaches `installed` while the page is controlled becomes `waitingWorker`.
  - Calls `registration.update()` whenever the page becomes visible again (installed apps stay open for days).
  - On `controllerchange` reloads once, only if a `waitingWorker` was set (first install does not reload).
- `use-online-status.ts`: `useSyncExternalStore` on `online`/`offline`; server snapshot `true`.
- `shared/ui/pwa-status-stack.tsx` (`PwaStatusStack`, inside `LocaleProvider`): fixed top-center stack below the safe area, `z-[70]`. Desktop `top-3`; phone (<= 960px) just under the workspace header (`4.5rem` + safe area) so the menu button stays reachable. Offline pill (`pwa.offline.banner`) and an update card (`pwa.update.title` + Reload button that posts `SKIP_WAITING` + ✕ `common.close` that hides the card for that waiting worker until the next load, since it covers the top of the page). Top, not bottom, because the phone shell stacks the tab bar and action bars at the bottom. On compact screens (<= 960px) the update card is hidden here; `PwaUpdateBar` (same file, mounted in the private layout right after `WorkspaceHeader`) shows it as a 40px row in the page flow so it pushes content down instead of covering the period toolbar/tabs (own ✕ state).
- Auto-apply: `useApplyUpdateOnNavigation` (in `PwaStatusStack`) posts `SKIP_WAITING` to a waiting worker on the next in-app pathname change, so a deploy lands on navigation without a click; the reload keeps the new URL (`location.reload()`). Forms live inside one route, so no typed input is lost.

## Install entry point

- Only in Settings → Preferences (`InstallAppRow`, see `modules/settings`); no install banner elsewhere.

## Sign-in inside the installed app

- iOS standalone apps do not share storage with Safari, so the link login never reaches them. The bot sends a sign-in code with the link; see `global/dashboard-session.md` and `modules/auth`.

## nginx (`apps/web/nginx.conf`)

- `location /` (HTML): `Cache-Control: no-cache`.
- `location = /sw.js` and `location = /manifest.webmanifest` (`application/manifest+json`): `no-cache`. Exact matches win over the asset regex; a cached worker could never update.
- `location ^~ /_next/static/`: `public, max-age=31536000, immutable` (content-hashed build output; `^~` keeps the regex below from matching first).
- Other assets by extension (`css|js|json|svg|png|jpg|jpeg|gif|ico|webp`, i.e. `public/` files whose names never change: favicon, PWA icons, og-image): `public, max-age=86400`, so a replaced icon shows within a day.
- Prod sits behind Cloudflare. Its Browser Cache TTL rewrites `/sw.js` to `max-age=14400` (seen 2026-10-22); browsers still revalidate the worker script on update checks, but a Cloudflare Cache Rule bypassing `/sw.js` (or "Respect existing headers") keeps the origin header. That is a Cloudflare dashboard setting, not repo config.
- Local `docker/nginx/nginx.local.conf.template` proxies to `next dev`, where no worker is registered.

## Known limits

- PWA needs HTTPS (production domain) or localhost.
- iOS may evict data of an app unused for a long time; the user signs in again with a code.
- Google OAuth started inside an iOS standalone app can open Safari and not come back; connect Google from the browser.
- Emergency rollback: ship a `sw.js` that unregisters itself and deletes `zalobot-*` caches.
