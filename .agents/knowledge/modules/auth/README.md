# Authentication Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/auth/README.md)

## Purpose

`apps/web/src/modules/auth` owns the browser side of the dashboard session: storing the short-lived access token obtained from the Zalo one-time link and rendering the session-ended screen. Report views never read or write the token directly.

## Files

- `client/auth-storage.ts`: `getAccessToken`, `setAccessToken`, `clearAccessToken`, `captureDashboardToken`.
- `presentation/components/session-state-screen.tsx` (re-exported by `view/session-state-screen.tsx`): `SessionStateScreen`.

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
  - Open Zalo bot link (new tab): `NEXT_PUBLIC_ZALO_BOT_URL`, else `https://zalo.me/<NEXT_PUBLIC_ZALO_BOT_USERNAME>`, else `https://zalo.me`. Lowercase legacy names `NEXT_PUBLIC_zalo_BOT_URL` / `NEXT_PUBLIC_zalo_BOT_USERNAME` are still read as fallbacks.
  - Close mini app: rendered only when `window.zalo.WebApp.close` exists (leftover from an earlier mini-app integration; Zalo does not inject this global today, so the button normally never shows).
  - Clear session & retry: `clearAccessToken()`, `queryClient.clear()`, `sessionStorage.clear()`, then `onRetry()` if provided, else `window.location.assign('/')`.
  - Link to `APP_ROUTES.about`.

## Invariants

- Only this module touches the token key; HTTP client and header import its functions.
- Access token value contains `.` (payload.signature); exchange tokens do not. `captureDashboardToken` relies on this distinction.
