---
metadata:
  agent-artifact:
    id: global-dashboard-session-knowledge
    type: documentation
    depends_on:
      - apps/api/src/reports/reports-token.service.ts
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/zalo/text/strategies/dashboard-tool.strategy.ts
      - apps/api/src/zalo/text/text-tool.factory.ts
      - apps/web/src/modules/auth/client/auth-storage.ts
      - apps/web/src/shared/api/http-client.ts
      - apps/web/app/(private)
---

# Dashboard Session and Pages

## Bot Entry Link

- Fast-path `DASHBOARD` matches `/dashboard`, `dashboard`, `mở dashboard`, `xem dashboard` (and these followed by more text); it never goes through the LLM.
- `DashboardToolStrategy` calls `ReportsTokenService.issueExchangeToken`: 32 random bytes (base64url); only the SHA-256 hex hash is stored in `dashboard_exchange_tokens` with a 20-minute expiry. The bot replies with `<appUrl>/api/access?token=<token>`. Base URL resolution: a tunnel `ZALO_WEBHOOK_URL` (trycloudflare/ngrok/loca.lt) or `APP_URL` read from the project-root `.env`, then a tunnel `zalo.webhookUrl` from config, then config `appUrl`.
- If token creation fails, the bot replies with an error message instead of a link.

## Token Exchange

- `GET /api/access?token=...` consumes the token atomically (`UPDATE ... WHERE consumed_at IS NULL AND expires_at > now`); a reused/expired token returns a `401` HTML page asking for a new link from Zalo.
- On success it issues an access token (24h) and a refresh token (7d), both HMAC-SHA256 signed with `DASHBOARD_ACCESS_TOKEN_SECRET` / `DASHBOARD_REFRESH_TOKEN_SECRET`. The refresh token goes only to the HTTP-only cookie `reports_refresh` (`sameSite=lax`, `secure` in production).
- Redirect target: `${webOrigin}/dashboard#dashboard_token=<accessToken>`. `webOrigin` is `WEB_ORIGIN`, replaced by the request's `x-forwarded-host`/`host` (with forwarded proto) when that host is not localhost/`127.0.0.1`/`0.0.0.0`/`host.docker.internal`.
- `POST /api/refresh` rotates the refresh cookie and returns `{ data: { accessToken, expiresAt } }`. `POST /api/logout` clears the cookie (`204`).

## Web Side

- `captureDashboardToken` reads `dashboard_token` or `token` from the URL hash or query. A query token without `.` is treated as an exchange token and redirected to `/api/access`; otherwise the access token is stored in `localStorage` key `zalobot.dashboard.access-token` and removed from the URL.
- `httpClient` sends `Authorization: Bearer <token>`; on the first `401` it calls `POST /api/refresh` once (shared in-flight promise), retries, and clears the stored token if refresh fails.
- Private pages (`apps/web/app/(private)/`): `/` and `/dashboard` (overview), `/transactions` (`/expenses`, `/income` redirect to `?type=expense|income`), `/debts`, `/analytics`, `/calendar`, `/tasks`, `/reminders`, `/contacts`, `/places`, `/zca` (Zalo & Users), `/settings`. All share the dashboard session and the `DataTable` primitive.
- `GET /api/contacts` derives the user from the access token and returns at most 200 of that user's `debt_contacts`.
