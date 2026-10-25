---
metadata:
  agent-artifact:
    id: global-environment-guard-knowledge
    type: documentation
    depends_on:
      - apps/api/src/config/env.validator.ts
      - apps/api/src/config/configuration.ts
      - apps/api/src/config/project-root.ts
      - apps/api/src/main.ts
      - apps/api/src/app.module.ts
      - apps/web/next.config.ts
      - apps/web/src/shared/api/http-client.ts
      - apps/web/src/shared/ui/workspace-header.tsx
      - apps/web/src/shared/zalo/zalo-app-link.ts
      - .env.example
      - docker-compose.yml
      - docker-compose.local.yml
      - scripts/tunnel.sh
---

# Environment Guard

Human guide: [Environment Guard](../../docs/global/environment-guard.md).

## Purpose

Runtime configuration is an explicit deployment contract. Secrets never appear in errors, logs, source, or documentation.

## Load Order (API)

1. `main.ts` calls `loadEnvironment()`: dotenv loads project-root `.env.local`, then project-root `.env`, both with `override: false`. Precedence: process env > `.env.local` > `.env`.
2. `ConfigModule.forRoot` (`app.module.ts`) also reads `envFilePath` in order `apps/api/.env.local`, `apps/api/.env`, root `.env.local`, root `.env` and loads `config/configuration.ts`.
3. Project root resolves to `../..` when cwd is `apps/api`, else cwd (`config/project-root.ts`).

## Required Values (`env.validator.ts`)

`validateEnvironment()` declares the required contract:

- Required: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DASHBOARD_ACCESS_TOKEN_SECRET`, `DASHBOARD_REFRESH_TOKEN_SECRET` non-empty; `APP_URL` HTTP(S) URL; `DATABASE_URL` `postgres://`/`postgresql://` URL; `DATA_ENCRYPTION_KEY` 64 hex chars (the 64-zero `configuration.ts` fallback is never reachable at boot).
- Validated only when set (otherwise the `configuration.ts` default applies): `BE_PORT`, `NGINX_PORT` positive integers; `WEB_ORIGIN` HTTP(S) URL; `CORS_ALLOW_ALL` `true`/`false`; `DEFAULT_TIMEZONE` IANA zone; `DASHBOARD_LOGIN_CODE` digits only and at least 6 digits after dropping spaces/dashes (see `dashboard-session.md`).

Enforcement: `main.ts` calls `validateEnvironment()` right after `loadEnvironment()` and before `NestFactory.create`; on any error it prints `printEnvValidationBanner(errors)` (key, reason, guide; never values) and exits with code 1.

## Env File Policy

An env file lists only keys whose value is a deployment decision (secrets, domain, non-default port/switch). Keys equal to a code default or derivable from another key stay out of `.env*`; code still reads them as overrides. Coolify lists every `${VAR}` interpolated in `docker-compose.yml` as an env it refuses to delete, so the compose file interpolates only real deployment choices: `POSTGRES_PASSWORD`, `BE_PORT`, `DEFAULT_TIMEZONE`, `NGINX_PORT`, `POSTGRES_PORT`, `REDIS_PORT`. `BE_PORT` and `DEFAULT_TIMEZONE` therefore stay in `.env*` with their default values. Values fixed for the compose stack are hardcoded in the services' `environment:` blocks (they override `env_file`; Coolify still lists each key as a locked env it refuses to delete, so the `api` keys are also listed in `.env*` to match it: `DATABASE_SSL`/`TYPEORM_SYNCHRONIZE` `false` everywhere, `DATA_DIR` `./data` in `.env`/`.env.example` and `/app/data` in `.env.production`, and `.env.production` also carries the compose `DATABASE_URL` (built from `POSTGRES_PASSWORD`), `REDIS_URL` and `TZ` (= `DEFAULT_TIMEZONE`; dev files omit `TZ` because Node would switch the local process zone). `POSTGRES_DB`/`POSTGRES_USER` (`zalobot`), `POSTGRES_PORT` (5432) and `REDIS_PORT` (6379) are listed in every env file. Net rule: every key Coolify shows for `docker-compose.yml` has a line in `.env.production`): `POSTGRES_DB`/`POSTGRES_USER` `zalobot` (changing them after the volume exists breaks the connection), `DATABASE_URL` (`postgres:5432/zalobot`), `REDIS_URL` (`redis:6379`), `DATABASE_SSL` `false`, `TYPEORM_SYNCHRONIZE` `false` (migrations only), `DATA_DIR` `/app/data` (matches the `./data:/app/data` mount); no `NEXT_PUBLIC_API_URL` build arg. No legacy alias names are read (removed: `ZALO_BOT_TOKEN`, `ZALO_WEBHOOK_URL`, `ZALO_WEBHOOK_SECRET_TOKEN` with the official-bot webhook, `BOT_TOKEN`, `WEBHOOK_URL`, `ZALO_BOT_NAME`, `ZCA_DATA_DIR`, `OLLAMA_*`, `PORT`, `GATEWAY_PORT`, `WEB_PORT`, `ZCA_AUTO_LOGIN`; `GOOGLE_OAUTH_CREDENTIALS`, `GOOGLE_CALENDAR_MCP_TOKEN_PATH` with the `npm run auth` script `apps/api/scripts/auth.ts`, whose token file nothing read — Google sign-in is OAuth only, tokens in PostgreSQL). Production env leaves the dev switches `CORS_ALLOW_ALL` and `ZCA_SELF_LISTEN` unset (`false`; web and API share the domain; `.env.example` shows them commented out, like other optional keys).

## Optional Values (`configuration.ts`)

Defaults in parentheses.

- Network: `BE_PORT` (3005), `WEB_ORIGIN` (`APP_URL`), `CORS_ALLOW_ALL` (false), `DEFAULT_TIMEZONE` (`Asia/Ho_Chi_Minh`).
- Database/cache: `DATABASE_SSL` (false), `TYPEORM_SYNCHRONIZE` (false), `REDIS_URL`. Only effective outside `docker-compose.yml` (dev), which hardcodes them.
- Bot: `BOT_NAME` (`Bot`, config `zalo.botName`).
- Dashboard: `DASHBOARD_LOGIN_CODE` (unset = off; config `reports.dashboardLoginCode`).
- ZCA: `DATA_DIR` (`./data`, resolved from cwd; `docker-compose.yml` hardcodes `/app/data`), `ZCA_PROXY_URL`, `ZCA_IMEI`, `ZCA_COOKIE`, `ZCA_USER_AGENT`, `ZCA_LANGUAGE`, `ZCA_SELF_LISTEN` (false), `ZCA_CHECK_UPDATE` (false), `ZCA_LOGGING` (false), `ZCA_ENABLE_WELCOME` (false), `ZCA_WELCOME_IMAGE_PATH`. Bootstrap auto-login has no flag (see `modules/zca/README.md`).
- LLM: `LLM_PROVIDER` (`gemini`; also `openai`, `qwen`/`ollama`, `router`/`9router` — provider names, not env aliases), `LLM_FALLBACK_PROVIDERS` (comma-separated chain after `LLM_PROVIDER`, default empty), `LLM_TIMEOUT_MS` (`30000`), `ROUTER_BASE_URL`, `ROUTER_MODEL`, `ROUTER_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` (`gemini-3.5-flash-lite`), `OPENAI_API_KEY`, `OPENAI_MODEL` (`gpt-4o-mini`), `OPENAI_BASE_URL` (`https://api.openai.com/v1`), `QWEN_BASE_URL` (`http://localhost:11434`), `QWEN_MODEL` (`qwen2.5:14b`), `QWEN_API_KEY`.
- Chat memory (Cognee): API reads `COGNEE_URL` (compose fixes `http://cognee:8000` in the `api` `environment:`; empty = Cognee off; validated as HTTP(S) URL), `COGNEE_USER_EMAIL` (`zalobot@example.com`), `COGNEE_USER_PASSWORD` (empty = Cognee off), `COGNEE_TIMEOUT_MS` (`600000`). The `cognee` service gets its env only through compose interpolation (not `env_file`, whose `LLM_PROVIDER` would clash with Cognee's own `LLM_PROVIDER`): `COGNEE_LLM_PROVIDER` (`custom`), `COGNEE_LLM_ENDPOINT`, `COGNEE_LLM_MODEL`, `COGNEE_LLM_API_KEY`, `COGNEE_JWT_SECRET`, `COGNEE_USER_PASSWORD`; these deployment choices therefore join the interpolated list and need lines in `.env.production`.
- Remote Cognee access: `COGNEE_UI_HOST` (switch: empty = `/cognee/` returns 404 and no UI; bare host of the Cognee UI, prod `cognee-zalobot.datintech.site`; interpolated into `web`, `cognee-ui` `COGNEE_BACKEND_URL` and `cognee` `UI_APP_URL`; empty = no UI) and `COGNEE_UI_PORT` (`3006`, host port of the UI listener on `web`). Listed in `.env.example` and `.env.production`.
- Read directly from `process.env` (not via `configuration.ts`): `ZCA_IMEI`/`ZCA_COOKIE`/`ZCA_USER_AGENT`/`ZCA_LANGUAGE`/`DATA_DIR` fallbacks in `zca/`.
- Compose-only: `POSTGRES_PASSWORD` (required), `POSTGRES_PORT` (5432), `REDIS_PORT` (6379), `NGINX_PORT` (3000 in `docker-compose.local.yml`, 3009 in `docker-compose.yml`), `FE_PORT` (5173, Next dev and local gateway).

## Web Values

- Only `NEXT_PUBLIC_*` reaches the browser. `next.config.ts` loads the monorepo root env via `@next/env`.
- `NEXT_PUBLIC_API_URL`: public API origin without `/api`, only needed when the API lives on another domain. Unset (default; `docker-compose.yml` passes no build arg) → `httpClient` uses same-origin relative URLs (web Nginx proxies `/api`); localhost/tunnel hosts always use relative URLs; dev rewrites fall back to `http://localhost:${NGINX_PORT|3000}`.
- `NEXT_PUBLIC_APP_URL`: metadata base and sitemap origin (fallback `https://bot.datintech.site`).

## Inventory Notes

- Root `.env.example` lists only keys an operator must decide; every optional key with its default is listed above.
- `scripts/tunnel.sh` rewrites `APP_URL` in gateway mode (upsert) and `WEB_ORIGIN`/`NEXT_PUBLIC_API_URL` only when declared; direct backend mode leaves `.env` untouched. It probes `/api/docs` and no longer registers any webhook.
- Root `.env.example` is the only env template; app-level templates (`apps/api/.env.example`, `apps/web/.env.example`, `apps/web/.env.local.example`) were removed since both apps load env from the project root. Bot access is governed by `users.grantAccess`, not env.
