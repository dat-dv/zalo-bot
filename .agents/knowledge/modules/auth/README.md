# Authentication Module

> Developer guide (Vietnamese): [`README.md`](../../../docs/modules/auth/README.md)

## Purpose

`apps/web/src/modules/auth` stores the short-lived dashboard access token after the zalo exchange flow. It keeps the browser session usable without exposing token handling to report views.

## UI and state

On load, `captureDashboardToken` reads `dashboard_token` from the URL fragment, persists it in local storage, and removes the fragment from the address bar. Logout or an unrecoverable authentication failure clears the token.

`SessionStateScreen` (`apps/web/src/modules/auth/presentation/components/session-state-screen.tsx`, re-exported via `view/session-state-screen.tsx`) renders the post-logout (`reason="logged_out"`) or session-expired (`reason="expired"`) states. It provides:

- Primary CTA: Open zalo Bot (`NEXT_PUBLIC_zalo_BOT_URL` or `https://t.me/${NEXT_PUBLIC_zalo_BOT_USERNAME}`) or close mini app when inside zalo WebApp (`window.zalo.WebApp.close()`).
- Secondary Action: Clear session & retry (`clearAccessToken()`, `queryClient.clear()`, and reload).
- Tertiary Link: Link to About page (`APP_ROUTES.about`).

## Integration seams

`shared/api/http-client` reads this module's token for the Authorization header, refreshes once after a 401 response, and clears it if refresh fails. The token lifecycle must remain compatible with the dashboard session API. `WorkspaceHeader` calls `POST /api/logout`, clears tokens and query cache, and navigates to `/?status=logged_out`.
