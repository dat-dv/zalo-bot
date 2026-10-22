# Authentication Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/auth/README.md)

## Purpose

`apps/web/src/modules/auth` owns the browser side of the dashboard session: storing the short-lived access token obtained from the Zalo one-time link and rendering the session-ended screen. Report views never read or write the token directly.

## Files

- `client/auth-storage.ts`: `getAccessToken`, `setAccessToken`, `clearAccessToken`, `captureDashboardToken`.
- `presentation/components/session-state-screen.tsx` (re-exported by `view/session-state-screen.tsx`): `SessionStateScreen`.
- `api/access-code-api.ts`: `signInWithAccessCode` (`POST API_ROUTES.accessCode`), `getAccessCodeErrorKind` (401 -> `rejected`, 429 -> `tooManyAttempts`, else `failed`).
- `api/access-code-query.ts`: `useAccessCodeSignInMutation`.
- `presentation/components/access-code-form.tsx`: `AccessCodeForm`.

## Token storage and capture

- Storage: `localStorage` key `zalobot.dashboard.access-token`. All accessors are SSR-safe and swallow storage errors.
- `captureDashboardToken` runs once in `AppProviders` (`shared/providers/app-providers.tsx`) before the app renders. It reads, in order:
  1. URL fragment `#dashboard_token=` or `#token=`;
  2. query `?dashboard_token=` or `?token=`.
- A query token without `.` is treated as a one-time exchange token: the page calls `window.location.replace('/api/access?token=<token>')` so the API consumes it. Fragment tokens are always stored as access tokens.
- After storing, the token params are removed via `history.replaceState` (path + remaining query; fragment dropped).

## Session flow (with API)

1. User sends `/dashboard` (or "dashboard" / "mở dashboard") in Zalo; `DashboardToolStrategy` replies with `<appUrl>/api/access?token=<exchange>` (one-time, 20 min).
2. `GET /api/access` (`ReportsController`) consumes the exchange token, issues a 24h access token and a 7-day `reports_refresh` httpOnly cookie, and redirects to `<webOrigin>/dashboard#dashboard_token=<access>`. Invalid/expired/used links get an HTML page with HTTP 401.
3. `shared/api/http-client.ts` adds `Authorization: Bearer <token>`. On a 401 (not from `/api/refresh`, only if a token exists, once per request) it calls `POST /api/refresh` (single shared in-flight promise), stores the new token and retries; if refresh fails it clears the token.
4. Logout (`WorkspaceHeader`): `POST /api/logout` (clears the cookie), then always `clearAccessToken()`, `queryClient.clear()`, `window.location.assign('/?status=logged_out')`.

## `SessionStateScreen`

- Props: `reason?: 'logged_out' | 'expired' | 'error'` (default `expired`), `onRetry?`. `logged_out` uses the logged-out copy; `expired` and `error` share the session-expired copy. No caller currently passes `error`.
- Callers: `DashboardHomeScreen` (`logged_out` when `?status=logged_out`, `expired` on query error), `TransactionsScreen` and `AnalyticsScreen` (`expired` on dashboard query error).
- Actions:
  - Open Zalo Bot: shared helper `shared/zalo/zalo-app-link.ts` (`handleZaloLinkClick`, constants `ZALO_LINKS`). It only opens Zalo, never a specific chat with the bot. A plain click navigates to `zalo://` (Zalo app home); if the page is still visible after 1.5 s (no `blur` / `pagehide` / `visibilitychange` → hidden), it opens `https://chat.zalo.me` in a new tab, or in the same tab when the popup is blocked. The `<a href>` is `https://chat.zalo.me`, so middle/modified clicks and no-JS open Zalo Web directly. `zalo.me` is never used: on desktop and in the installed PWA it only shows the zalo.me web page. No env configures these links (old `NEXT_PUBLIC_ZALO_BOT_URL` / `_USERNAME` are no longer read).
  - Close mini app: rendered only when `window.zalo.WebApp.close` exists (leftover from an earlier mini-app integration; Zalo does not inject this global today, so the button normally never shows).
  - Clear session & retry: `clearAccessToken()`, `queryClient.clear()`, `sessionStorage.clear()`, then `onRetry()` if provided, else `window.location.assign('/')`.
  - Link to `APP_ROUTES.about`.

## Sign-in code (installed app / PWA)

- Why: on iOS the installed app has its own storage, so the one-time link opened from Zalo signs in Safari, never the app. The bot reply carries an 8-character code (Crockford base32, shown `XXXX-XXXX`) issued from the same `dashboard_exchange_tokens` row as the link; using either spends both (20-minute TTL).
- `SessionStateScreen` always renders `AccessCodeForm` below its actions. The form normalizes with `normalizeDashboardAccessCode`, validates with `isDashboardAccessCode` (contracts) before calling the API, then `setAccessToken(accessToken)` and does a full load of `APP_ROUTES.dashboard`. The API also sets the `reports_refresh` cookie.
- `httpClient` never runs refresh-and-retry for a 401 from `API_ROUTES.accessCode` (a wrong code is not an expired session).
- API side: `POST /api/access/code`, rate limited per client IP and overall (see `global/dashboard-session.md`). The same form also accepts the fixed `DASHBOARD_LOGIN_CODE` (signs in as the `dashboard-owner` admin); the web side needs no special handling since the format is identical.

## Invariants

- Only this module touches the token key; HTTP client and header import its functions.
- Access token value contains `.` (payload.signature); exchange tokens do not. `captureDashboardToken` relies on this distinction.

## Corner radius

- Buttons, inputs, cards/panels and dialog panels in this module use `rounded-[3px]` (max `rounded`, 4px); no `rounded-lg/xl/2xl`. `rounded-full` only for avatars, status dots, switches, spinners and progress fills. See [web-ui-direction](../../global/web-ui-direction.md).
