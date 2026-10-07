# Monorepo Architecture

## Layout

- `apps/api`: NestJS zalo and OAuth backend. It owns all private environment variables and the PostgreSQL runtime.
- `apps/web`: Next.js App Router static export. It may consume only `NEXT_PUBLIC_*` environment variables and contains no server runtime.
- `packages/contracts`: framework-neutral routes and API TypeScript contracts.
- PostgreSQL: the persistent system of record for the API, provisioned by Compose in container deployments.

## Runtime Rules

- npm workspaces are the only package boundary. Build contracts before applications.
- API resolves `.env.local`, `.env`, and `data/` from the monorepo root, regardless of whether it runs from `apps/api` or a root Docker working directory.
- Never expose zalo, Gemini, Google, encryption, or database secrets to the web package.
- The web app owns static UI routes while Nest remains the only API, OAuth, token, database, and zalo runtime. The static dashboard calls Nest directly through `NEXT_PUBLIC_API_URL`.
- `zalo_LONG_POLLING_ENABLED` is required. Exactly one runtime may enable long polling for a given bot token; API-only runtimes set it to `false` and retain outbound zalo API access.
- Contract changes belong in `@zalobot/contracts` before an API or web consumer is added.

## zalo Dashboard

- The bot creates a five-minute browser entry URL from a user-specific HMAC signature and expiry.
- `GET /api/access` validates the zalo exchange token, writes the refresh cookie, then redirects to `/` with `#dashboard_token=...`.
- The React dashboard requests `GET /api/dashboard` with its short-lived Bearer token. The API derives the user exclusively from that signed token; it never accepts a frontend `userId`.
- `APP_URL`, `WEB_ORIGIN`, and `NEXT_PUBLIC_API_URL` are required explicit URLs. `NEXT_PUBLIC_API_URL` is the public origin without `/api`, because contract route constants already include that prefix. Avoid `SERVICE_URL_*`: Coolify reserves that prefix for managed URLs. In single-origin deployments, Web Nginx proxies `/api/*` (including Swagger docs at `/api/docs` and OAuth callback at `/api/oauth2callback`) directly to the backend API container (`http://api:3000`) while serving static web files for other paths.
- `CORS_ALLOW_ALL` is required and must be explicitly set to `true` or `false`. Setting it to `true` reflects every request origin and permits credentials for temporary cross-origin local testing; it must be treated as an explicit security exception.
- Dashboard access and refresh tokens are signed with the two private dashboard token secrets. During local tunnel development, Vite proxies dashboard API routes to the exposed API Docker port at `localhost:3000`.
- The frontend stores only the 15-minute dashboard access token. A rotated seven-day refresh token remains in an `HttpOnly` cookie and Axios uses it after a 401.
- The browser routes `/`, `/transactions`, `/debts`, `/analytics`, `/calendar`, `/tasks`, `/reminders`, and `/contacts` are exported as static files inside route group `app/(private)/`. UI ownership is split into `modules/auth`, `modules/dashboard`, `modules/debts`, `modules/contacts`, and reusable `shared/api` and `shared/ui` components.

## Database Migrations

- PostgreSQL database schema is managed via TypeORM Migrations (`apps/api/src/database/migrations/`).
- `migrationsRun: true` is enabled in `database.module.ts` to automatically execute pending migrations on API startup with zero data loss.
- CLI DataSource is configured in `apps/api/src/database/data-source.ts`.
- Manage migrations with:
  - `npm run migration:run --workspace @zalobot/api`: Run pending migrations.
  - `npm run migration:revert --workspace @zalobot/api`: Rollback latest migration.
  - `npm run migration:generate --workspace @zalobot/api`: Auto-generate migration from entity diffs.
  - `npm run migration:create --workspace @zalobot/api`: Create empty migration file.
