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

- Non-empty: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DASHBOARD_ACCESS_TOKEN_SECRET`, `DASHBOARD_REFRESH_TOKEN_SECRET`, `ZALO_BOT_TOKEN` (or legacy `BOT_TOKEN`).
- `BE_PORT` (or `PORT`): positive integer. `NGINX_PORT` / `GATEWAY_PORT`: positive integer when set.
- `APP_URL`, `WEB_ORIGIN`: HTTP(S) URL. `DATABASE_URL`: `postgres://` or `postgresql://` URL.
- `CORS_ALLOW_ALL`: `true` or `false`. `DATA_ENCRYPTION_KEY`: 64 hex chars. `DEFAULT_TIMEZONE`: valid IANA zone.

Enforcement: `main.ts` calls `validateEnvironment()` right after `loadEnvironment()` and before `NestFactory.create`; on any error it prints `printEnvValidationBanner(errors)` (key, reason, guide; never values) and exits with code 1. So the `configuration.ts` fallbacks (`port` 3005, `CORS_ALLOW_ALL` → `false`, `DATA_ENCRYPTION_KEY` → 64 zeros, `DEFAULT_TIMEZONE` → `Asia/Ho_Chi_Minh`, `WEB_ORIGIN` → `APP_URL`) are only reachable from scripts/tests that read `configuration.ts` without booting `main.ts`. The `CORS_ALLOW_ALL` fallback is `false` as defense in depth.

## Optional Values (`configuration.ts`)

- Database/cache: `DATABASE_SSL`, `TYPEORM_SYNCHRONIZE`, `REDIS_URL`.
- Deploy notify: `DEPLOY_NOTIFY_TOKEN` (`deploy.notifyToken`). Unset → deploy-notify routes return 403 (see `backend-runtime-services.md`).
- Zalo bot: `BOT_NAME` / `ZALO_BOT_NAME`, `ZALO_WEBHOOK_URL` / `WEBHOOK_URL`, `ZALO_WEBHOOK_SECRET_TOKEN`.
- ZCA: `DATA_DIR` / `ZCA_DATA_DIR`, `ZCA_PROXY_URL`, `ZCA_IMEI`, `ZCA_COOKIE`, `ZCA_USER_AGENT`, `ZCA_LANGUAGE`, `ZCA_SELF_LISTEN` (default false), `ZCA_CHECK_UPDATE` (true), `ZCA_LOGGING` (false), `ZCA_AUTO_LOGIN` (false), `ZCA_ENABLE_WELCOME` (false), `ZCA_WELCOME_IMAGE_PATH`.
- LLM: `LLM_PROVIDER` (`gemini` default; `openai`; `qwen`/`ollama`; `router`/`9router`), `LLM_FALLBACK_PROVIDERS` (comma-separated chain after `LLM_PROVIDER`, default empty), `LLM_TIMEOUT_MS` (`30000`), `ROUTER_BASE_URL`, `ROUTER_MODEL`, `ROUTER_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `QWEN_BASE_URL` / `OLLAMA_BASE_URL`, `QWEN_MODEL` / `OLLAMA_MODEL`, `QWEN_API_KEY` / `OLLAMA_API_KEY`.
- Chat memory: `CHAT_MEMORY_ENABLED` (`false`), `CHAT_MEMORY_CONTEXT_WINDOW` (`10`), `CHAT_MEMORY_SEARCH_LIMIT` (`15`).
- Read directly from `process.env` (not via `configuration.ts`): `NOTIFY_ON_STARTUP`, `APP_VERSION`, commit/branch vars (`COMMIT_SHA`, `GIT_COMMIT`, `COOLIFY_COMMIT_SHA`, `BRANCH`, `GIT_BRANCH`, `COOLIFY_BRANCH`) in `health/deploy-notify.service.ts`; some ZCA/bot-name reads in `zca/`.
- Compose-only: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, `REDIS_PORT`, `WEB_PORT`, `NGINX_PORT`, `FE_PORT`.

## Web Values

- Only `NEXT_PUBLIC_*` reaches the browser. `next.config.ts` loads the monorepo root env via `@next/env`.
- `NEXT_PUBLIC_API_URL`: public API origin without `/api`. Optional: `httpClient` uses relative URLs when it is unset or the page host is localhost/127.0.0.1/a tunnel; dev rewrites fall back to `http://localhost:${NGINX_PORT|GATEWAY_PORT|3000}`.
- `NEXT_PUBLIC_ZALO_BOT_URL`, else `NEXT_PUBLIC_ZALO_BOT_USERNAME` → `https://zalo.me/<username>`, else `https://zalo.me` (Open Zalo Bot link).
- `NEXT_PUBLIC_APP_URL`: metadata base and sitemap origin (fallback `https://bot.datintech.site`).

## Inventory Notes

- Root `.env.example` is the key inventory but omits `ZCA_LANGUAGE`, `ZCA_ENABLE_WELCOME`, `ZCA_WELCOME_IMAGE_PATH`, `OLLAMA_*` aliases, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_ZALO_BOT_URL` / `_USERNAME`.
- `ZALO_ALLOWED_USER_IDS` in `apps/api/.env.example` is not read by any code; bot access is governed by `users.grantAccess`.
