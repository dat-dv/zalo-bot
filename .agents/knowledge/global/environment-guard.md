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
      - apps/api/src/health/deploy-notify.service.ts
      - apps/api/src/health/deploy-notify.guard.ts
      - apps/web/next.config.ts
      - apps/web/src/shared/api/http-client.ts
      - apps/web/src/shared/ui/workspace-header.tsx
      - .env.example
      - docker-compose.yml
      - docker-compose.local.yml
      - scripts/tunnel.sh
      - apps/api/scripts/zalo-webhook.ts
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

- Required: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DASHBOARD_ACCESS_TOKEN_SECRET`, `DASHBOARD_REFRESH_TOKEN_SECRET`, `ZALO_BOT_TOKEN` non-empty; `APP_URL` HTTP(S) URL; `DATABASE_URL` `postgres://`/`postgresql://` URL; `DATA_ENCRYPTION_KEY` 64 hex chars (the 64-zero `configuration.ts` fallback is never reachable at boot).
- Validated only when set (otherwise the `configuration.ts` default applies): `BE_PORT`, `NGINX_PORT` positive integers; `WEB_ORIGIN`, `ZALO_WEBHOOK_URL` HTTP(S) URLs; `CORS_ALLOW_ALL` `true`/`false`; `DEFAULT_TIMEZONE` IANA zone.

Enforcement: `main.ts` calls `validateEnvironment()` right after `loadEnvironment()` and before `NestFactory.create`; on any error it prints `printEnvValidationBanner(errors)` (key, reason, guide; never values) and exits with code 1.

## Env File Policy

An env file lists only keys whose value is a deployment decision (secrets, domain, non-default port/switch). Keys equal to a code default or derivable from another key stay out of `.env*`; code still reads them as overrides. No legacy alias names are read (removed: `BOT_TOKEN`, `WEBHOOK_URL`, `ZALO_BOT_NAME`, `ZCA_DATA_DIR`, `OLLAMA_*`, `PORT`, `GATEWAY_PORT`, `WEB_PORT`, `ZCA_AUTO_LOGIN`).

## Optional Values (`configuration.ts`)

Defaults in parentheses.

- Network: `BE_PORT` (3005), `WEB_ORIGIN` (`APP_URL`), `CORS_ALLOW_ALL` (false), `DEFAULT_TIMEZONE` (`Asia/Ho_Chi_Minh`).
- Database/cache: `DATABASE_SSL` (false), `TYPEORM_SYNCHRONIZE` (false), `REDIS_URL`.
- Deploy notify: `DEPLOY_NOTIFY_TOKEN` (`deploy.notifyToken`). Unset → deploy-notify routes return 403 (see `backend-runtime-services.md`).
- Zalo bot: `BOT_NAME` (`Bot`), `ZALO_WEBHOOK_URL` (`${APP_URL}/webhook`), `ZALO_WEBHOOK_SECRET_TOKEN`.
- ZCA: `DATA_DIR` (`./data`, resolved from cwd; compose sets `/app/data`), `ZCA_PROXY_URL`, `ZCA_IMEI`, `ZCA_COOKIE`, `ZCA_USER_AGENT`, `ZCA_LANGUAGE`, `ZCA_SELF_LISTEN` (false), `ZCA_CHECK_UPDATE` (false), `ZCA_LOGGING` (false), `ZCA_ENABLE_WELCOME` (false), `ZCA_WELCOME_IMAGE_PATH`. Bootstrap auto-login has no flag (see `modules/zca/README.md`).
- LLM: `LLM_PROVIDER` (`gemini`; also `openai`, `qwen`/`ollama`, `router`/`9router` — provider names, not env aliases), `LLM_FALLBACK_PROVIDERS` (comma-separated chain after `LLM_PROVIDER`, default empty), `LLM_TIMEOUT_MS` (`30000`), `ROUTER_BASE_URL`, `ROUTER_MODEL`, `ROUTER_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL` (`gemini-3.5-flash-lite`), `OPENAI_API_KEY`, `OPENAI_MODEL` (`gpt-4o-mini`), `OPENAI_BASE_URL` (`https://api.openai.com/v1`), `QWEN_BASE_URL` (`http://localhost:11434`), `QWEN_MODEL` (`qwen2.5:14b`), `QWEN_API_KEY`.
- Read directly from `process.env` (not via `configuration.ts`): `NOTIFY_ON_STARTUP`, `APP_VERSION`, commit/branch vars (`COMMIT_SHA`, `GIT_COMMIT`, `COOLIFY_COMMIT_SHA`, `BRANCH`, `GIT_BRANCH`, `COOLIFY_BRANCH`) in `health/deploy-notify.service.ts`; `ZCA_IMEI`/`ZCA_COOKIE`/`ZCA_USER_AGENT`/`ZCA_LANGUAGE`/`DATA_DIR` fallbacks in `zca/`.
- Compose-only: `POSTGRES_DB` (`zalobot`), `POSTGRES_USER` (`zalobot`), `POSTGRES_PASSWORD` (required), `POSTGRES_PORT` (5432), `REDIS_PORT` (6379), `NGINX_PORT` (3000 in `docker-compose.local.yml`, 3009 in `docker-compose.yml`), `FE_PORT` (5173, Next dev and local gateway).

## Web Values

- Only `NEXT_PUBLIC_*` reaches the browser. `next.config.ts` loads the monorepo root env via `@next/env`.
- `NEXT_PUBLIC_API_URL`: public API origin without `/api`, only needed when the API lives on another domain. Unset (default, including the `docker-compose.yml` build arg) → `httpClient` uses same-origin relative URLs (web Nginx proxies `/api`); localhost/tunnel hosts always use relative URLs; dev rewrites fall back to `http://localhost:${NGINX_PORT|3000}`.
- `NEXT_PUBLIC_ZALO_BOT_URL`, else `NEXT_PUBLIC_ZALO_BOT_USERNAME` → `https://zalo.me/<username>`, else `https://zalo.me` (Open Zalo Bot link).
- `NEXT_PUBLIC_APP_URL`: metadata base and sitemap origin (fallback `https://bot.datintech.site`).

## Inventory Notes

- Root `.env.example` lists only keys an operator must decide; every optional key with its default is listed above.
- `scripts/tunnel.sh` rewrites `APP_URL` (gateway mode, upsert) or `ZALO_WEBHOOK_URL` (direct backend mode, upsert); it rewrites `WEB_ORIGIN`/`NEXT_PUBLIC_API_URL`/`ZALO_WEBHOOK_URL` in gateway mode only when those keys are declared. `apps/api/scripts/zalo-webhook.ts` uses `ZALO_WEBHOOK_URL` or `${APP_URL}/webhook`.
- Root `.env.example` is the only env template; app-level templates (`apps/api/.env.example`, `apps/web/.env.example`, `apps/web/.env.local.example`) were removed since both apps load env from the project root. Bot access is governed by `users.grantAccess`, not env.
