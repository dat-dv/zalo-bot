---
metadata:
  agent-artifact:
    id: global-monorepo-architecture-knowledge
    type: documentation
    depends_on:
      - package.json
      - apps/api/src/main.ts
      - apps/api/src/app.module.ts
      - apps/api/src/reports/reports-token.service.ts
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/config/configuration.ts
      - apps/api/src/database/database.module.ts
      - apps/web/next.config.ts
      - apps/web/nginx.conf
      - apps/web/Dockerfile
      - apps/api/Dockerfile
      - apps/web/src/shared/api/http-client.ts
      - docker-compose.yml
      - docker-compose.local.yml
      - packages/contracts/src/index.ts
---

# Monorepo Architecture

## Layout

- `apps/api`: NestJS 10 backend — Zalo webhook bot, ZCA personal client, Google OAuth/Workspace, LLM tool calling, REST API. Owns all private env vars, PostgreSQL (TypeORM), and Redis. Top-level areas: `audit`, `common`, `config`, `dashboard-auth`, `database`, `finance`, `google`, `health`, `llm`, `ocr`, `receipt-storage`, `redis`, `reminders`, `reports`, `users`, `zalo`, `zca`.
- `apps/web`: Next.js 16 App Router, React 19, TanStack Query v5. `output: 'export'` (static) when `NODE_ENV=production`; no Route Handlers or Server Actions. Consumes only `NEXT_PUBLIC_*`.
  - Modules (`apps/web/src/modules/`): `auth`, `calendar`, `contacts`, `dashboard`, `debts`, `expenses`, `reminders`, `settings`, `tasks`, `users`, `zca`. Shared code: `shared/api` (axios `httpClient`), `shared/ui`, `shared/providers`, `shared/hooks`.
  - Private routes (`app/(private)/`): `/`, `/dashboard`, `/transactions`, `/expenses`→`/transactions?type=expense`, `/income`→`/transactions?type=income`, `/debts`, `/analytics`, `/calendar`, `/tasks`, `/reminders`, `/contacts`, `/places`, `/zca`, `/settings`. Public: `/about`, `/privacy`, `/terms`.
- `packages/contracts` (`@zalobot/contracts`): `API_ROUTES`, `APP_ROUTES`, DTO types, i18n catalog, shared constants.
- PostgreSQL 16 and Redis 7 are provisioned by Compose.

## Runtime Rules

- npm workspaces are the only package boundary. `npm run build` builds contracts, then API, then web.
- API resolves `.env.local`, `.env`, and `data/` from the monorepo root whether it runs from `apps/api` or the repo root.
- Never expose Zalo, LLM (`GEMINI_*`, `OPENAI_*`, `QWEN_*`), Google, encryption, dashboard-token, or database secrets to the web package.
- Nest is the only API, OAuth, token, database, and bot runtime. Bot input arrives only via webhook (`/webhook`, `/zalo/webhook`, `/api/webhook`, `/api/zalo/webhook`) and the ZCA WebSocket client; there is no long polling.
- Global prefix `/api`, excluding webhook, `health`, `health/deploy`, `deploy/*`. Swagger at `/api/docs`.
- Contract changes go into `@zalobot/contracts` before an API or web consumer is added.

## Dashboard Session

- Bot `/dashboard` issues a random one-time exchange token (SHA-256 hash stored, 20-minute TTL) and links `APP_URL/api/access?token=...`.
- `GET /api/access` consumes it, sets the refresh cookie, and redirects to `${webOrigin}/dashboard#dashboard_token=...`.
- Access token 24h (stored in `localStorage`), refresh token 7d (rotated, HTTP-only cookie `reports_refresh`), both HMAC-signed with `DASHBOARD_ACCESS_TOKEN_SECRET` / `DASHBOARD_REFRESH_TOKEN_SECRET`. Axios refreshes once after a `401`.
- The API derives the user only from the Bearer token; it never accepts a frontend `userId`.

## URLs, CORS, Proxy

- `APP_URL` and `WEB_ORIGIN` are explicit URLs (`WEB_ORIGIN` defaults to `APP_URL`). `NEXT_PUBLIC_API_URL` is the public origin without `/api` (route constants include the prefix); when unset or on localhost/tunnel hosts the web uses relative URLs. Avoid `SERVICE_URL_*` (reserved by Coolify).
- CORS: `CORS_ALLOW_ALL=true` reflects any origin with credentials (explicit security exception); otherwise `WEB_ORIGIN` plus `http://localhost:5173` outside production.
- Production web container (`apps/web/nginx.conf`, Nginx 1.27) serves the static export and proxies `/api/`, `/webhook`, `/zalo/`, `/oauth2callback` to `http://api:${BE_PORT}`.
- Next dev (`FE_PORT`, default 5173) rewrites `/api/:path*` to `NEXT_PUBLIC_API_URL` or `http://localhost:${NGINX_PORT|GATEWAY_PORT|3000}`.

## Docker

- `docker-compose.yml`: `postgres` (16-alpine), `redis` (7-alpine, AOF), `api` (`BE_PORT`, default 3005; mounts `./data:/app/data`; healthcheck `/health`), `web` (Nginx, host port `NGINX_PORT` or `WEB_PORT`, default 3009; build arg `NEXT_PUBLIC_API_URL`).
- `docker-compose.local.yml` (`npm run docker:local`): postgres, redis, and an Nginx gateway (`NGINX_PORT`/`GATEWAY_PORT`, default 3000) proxying to API/web dev servers on the host.
- Dockerfiles are two-stage (`builder` → `runner`) using BuildKit npm cache mounts; root `.dockerignore` excludes `node_modules`, build outputs, `.git`, and `.env*`.

## Database Migrations

- Schema managed by TypeORM migrations in `apps/api/src/database/migrations/`, explicitly imported in both `database.module.ts` (`migrationsRun: true`, table `typeorm_migrations`) and the CLI DataSource `apps/api/src/database/data-source.ts`; a new migration must be added to both lists. Never rewrite an applied migration.
- `npm run migration:run|migration:revert|migration:generate|migration:create --workspace @zalobot/api`.
