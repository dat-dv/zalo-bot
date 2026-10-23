---
metadata:
  agent-artifact:
    id: global-dashboard-session-knowledge
    type: documentation
    depends_on:
      - apps/api/src/reports/reports-token.service.ts
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/reports/dashboard-access-code.ts
      - apps/api/src/reports/access-code-rate-limiter.ts
      - apps/api/src/users/users.service.ts
      - apps/api/src/config/env.validator.ts
      - apps/api/src/reports/dto/dashboard-access-code.dto.ts
      - apps/api/src/database/entities/dashboard-exchange-token.entity.ts
      - apps/web/src/modules/auth/presentation/components/access-code-form.tsx
      - apps/api/src/zca/text/strategies/dashboard-tool.strategy.ts
      - apps/api/src/zca/text/text-tool.factory.ts
      - apps/web/src/modules/auth/client/auth-storage.ts
      - apps/web/src/shared/api/http-client.ts
      - apps/web/app/(private)
      - apps/web/src/modules/auth/api/session-user-query.ts
      - apps/web/src/modules/auth/presentation/components/session-user-card.tsx
      - apps/web/src/shared/ui/app-navigation.tsx
      - apps/web/src/shared/ui/nav-visibility.ts
---

# Dashboard Session and Pages

## Bot Entry Link

- Fast-path `DASHBOARD` matches `/dashboard`, `dashboard`, `mở dashboard`, `xem dashboard` (and these followed by more text); it never goes through the LLM.
- `DashboardToolStrategy` calls `ReportsTokenService.issueExchangeToken`: 32 random bytes (base64url); only the SHA-256 hex hash is stored in `dashboard_exchange_tokens` with a 20-minute expiry. The bot replies with `<appUrl>/api/access?token=<token>`. Base URL resolution: `APP_URL` read from the project-root `.env` (picks up a tunnel started after boot), then config `appUrl`.
- The same row also stores `code_hash`: SHA-256 of an 8-digit sign-in code (`generateDashboardAccessCode`, each digit from `crypto.randomInt(10)`; length `DASHBOARD_ACCESS_CODE_LENGTH` in `apps/api/src/reports/dashboard-access-code.ts`). The reply shows it as `1234-5678` on its own line under the link. `issueExchangeToken` returns `{ token, code }` and retries up to 3 times on a `code_hash` collision.
- If token creation fails, the bot replies with an error message instead of a link.

## Token Exchange

- `GET /api/access?token=...` consumes the token atomically (`UPDATE ... WHERE consumed_at IS NULL AND expires_at > now`); a reused/expired token returns a `401` HTML page asking for a new link from Zalo.
- On success it issues an access token (24h) and a refresh token (7d), both HMAC-SHA256 signed with `DASHBOARD_ACCESS_TOKEN_SECRET` / `DASHBOARD_REFRESH_TOKEN_SECRET`. The refresh token goes only to the HTTP-only cookie `reports_refresh` (`sameSite=lax`, `secure` in production).
- Redirect target: `${webOrigin}/dashboard#dashboard_token=<accessToken>`. `webOrigin` is `WEB_ORIGIN`, replaced by the request's `x-forwarded-host`/`host` (with forwarded proto) when that host is not localhost/`127.0.0.1`/`0.0.0.0`/`host.docker.internal`.
- `POST /api/access/code` (`API_ROUTES.accessCode`, body `{ code }`, `DashboardAccessCodeDto`) is the sign-in path for the installed app (PWA): on iOS it has its own storage, so the link opened from Zalo never signs it in. The code is normalized (spaces/dashes dropped, `normalizeDashboardAccessCode`) and must be digits only, any length up to `DASHBOARD_ACCESS_CODE_MAX_LENGTH` (32; `isDashboardAccessCode`, contracts) before hashing — there is no fixed length check; consumption uses the same atomic `UPDATE` as the link and shares `consumed_at`, so using either the link or the code spends both. Success: access + refresh issued like `/api/access`, refresh cookie set, `200 { data: { accessToken, expiresAt } }`. Wrong/expired/used code: JSON `401`.
- Code attempts are rate limited by `AccessCodeRateLimiter`: 10 per client per 15 minutes and 200 across all clients per 15 minutes, else `429`. Client key: `cf-connecting-ip`, then `x-real-ip`, then `req.ip` (Express has no `trust proxy`). Counters live in Redis (`RedisService.incrWithTtl`, key `dashboard:access-code:attempts:<scope>`) and fall back to in-process counters when Redis is down. The overall cap exists because client IP headers can be forged.

## Fixed Sign-In Code (`DASHBOARD_LOGIN_CODE`)

- Why: with the official Zalo Bot removed, the only other way in is `/dashboard` over ZCA, which needs ZCA logged in — but re-scanning the ZCA QR needs the dashboard. A fixed env code breaks that loop and also covers a fresh install (no admin yet).
- Optional env `DASHBOARD_LOGIN_CODE` (config `reports.dashboardLoginCode`), digits only (spaces, dashes ignored) and at least 6 digits (`DASHBOARD_LOGIN_CODE_MIN_LENGTH` in `env.validator.ts`, backend-only). A set value with other characters or fewer digits fails env validation at boot. Empty = feature off.
- Why a minimum: the code never expires, and the shared cap allows ~19,200 guesses/day, so 6 digits (10^6) can be brute-forced in weeks of sustained attack; prefer 10-12 digits.
- `POST /api/access/code` runs the rate limiter first (shared with one-time codes), then `ReportsTokenService.matchesStaticLoginCode` (SHA-256 of both normalized codes, `timingSafeEqual`). Match -> `UsersService.ensureDashboardOwner()` -> session for `users.id = 'dashboard-owner'` (`DASHBOARD_OWNER_USER_ID`); no match -> one-time code flow.
- `ensureDashboardOwner` creates the owner (`firstName` "Chủ hệ thống") or re-promotes it to `ADMIN` + `GRANTED` on every use, so a ban/demotion on the dashboard cannot lock the env holder out; a renamed owner keeps its name.
- The code never expires and is not consumed. Every use logs `warn` "Dashboard sign-in with DASHBOARD_LOGIN_CODE from <ip>" (never the code). Rotate = change env + restart.
- Records created on the dashboard by the owner show "Chủ hệ thống" as creator. Once the owner exists, `InitialAdminBootstrapGuard` no longer promotes the first Zalo chatter; grant access from `/zca`.

- `POST /api/refresh` rotates the refresh cookie and returns `{ data: { accessToken, expiresAt } }`. `POST /api/logout` clears the cookie (`204`).

## Web Side

- `captureDashboardToken` reads `dashboard_token` or `token` from the URL hash or query. A query token without `.` is treated as an exchange token and redirected to `/api/access`; otherwise the access token is stored in `localStorage` key `zalobot.dashboard.access-token` and removed from the URL.
- `SessionStateScreen` renders `AccessCodeForm` (see `modules/auth`), which posts the code and stores the returned access token.
- `httpClient` sends `Authorization: Bearer <token>`; on the first `401` (except from `/api/refresh` and `/api/access/code`) it calls `POST /api/refresh` once (shared in-flight promise), retries, and clears the stored token if refresh fails.
- Private pages (`apps/web/app/(private)/`): `/` and `/dashboard` (overview), `/transactions` (`/expenses`, `/income` redirect to `?type=expense|income`), `/debts`, `/analytics`, `/calendar`, `/tasks`, `/reminders`, `/contacts`, `/places`, `/zca` (Zalo & Users), `/google-storage` (Google Drive), `/activity` (activity log), `/settings`. All share the dashboard session and the `DataTable` primitive.

## Session Identity (`GET API_ROUTES.sessionMe` = `/api/me`)

- Why: an admin hitting an "admins only" page could not tell which Zalo account the session belonged to (e.g. signed in via the link of a non-admin or duplicate id). `/api/dashboard` returns only the raw id and also loads finance/calendar/tasks, so a light endpoint serves the navigation.
- `ReportsController.me` (Bearer access token) → `IDashboardSessionUser { id, name, avatarUrl, isAdmin, isDashboardOwner }` from `UsersService.getSessionProfile(id)`:
  - Name: ZCA directory entry of type `user` (`getAvailableThreads(false)`: Redis cache, never a Zalo fetch) `alias || name || displayName` → `users.firstName` → `null`.
  - `dashboard-owner`: `isDashboardOwner: true`, `name: null` unless renamed from the default "Chủ hệ thống" (the web shows the translated `session.owner`).
  - Avatar: `users.avatarUrl` → directory avatar → `null`. `isAdmin` = `UsersService.isAdmin`.
- Web: `useSessionUserQuery({ enabled: isAuthenticated })` (key `['session','me']`, `staleTime` 5 min; sign-in/out `queryClient.clear()` resets it). `SessionUserCard`: avatar or initial, name (or "Unknown name"), Admin/User badge, id as a copy button ("Copied" for 2 s). Loading → skeleton; error or signed out → nothing (never blocks the menu). Placement: desktop sidebar footer above the theme toggle; compact screens at the top of the "More" sheet (40px tap targets). Strings `session.*`.

## Admin-Only Navigation

- `NavItem.adminOnly`: `zca` (Zalo & Users), `googleStorage` (Google Drive) and `activity` (activity log), whose APIs use `requireDashboardAdmin`.
- `visibleNavSections(sections, isAdmin)` (`shared/ui/nav-visibility.ts`) shows them only when `isAdmin === true`; while loading or on error they are hidden (an admin's hard reload shows them one fetch late; in-app navigation uses the cached session). Empty sections are dropped. Applies to the sidebar and the "More" sheet; the tab bar has no admin items.
- Cosmetic only: the API still enforces admin rights; a non-admin opening the URL directly gets the page's forbidden state.
- `GET /api/contacts` derives the user from the access token and returns at most 200 of that user's `debt_contacts`.
