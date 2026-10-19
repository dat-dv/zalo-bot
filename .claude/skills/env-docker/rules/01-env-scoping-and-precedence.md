---
trigger: model_decision
description: "Standardized Environment Variable (ENV) scoping across .env.local, .env.example, .env, Monorepo root env loading, and Docker Compose injection."
metadata:
  agent-artifact:
    id: env-docker-rule-01
    type: rule
    explanation: .agents/system-explain/plugins/env-docker/rules/01-env-scoping-and-precedence.md
    depends_on:
      - .agents/rules/core.md
---

# Environment Variables, Security Scoping, & Docker Precedence Rules

## 1. Standard 3-File ENV Classification

Applications MUST follow the standard 3-tier ENV file convention:

| File Name | Target Environment | Git Tracking | Purpose |
| :--- | :--- | :--- | :--- |
| **`.env.local`** | **Development (Dev)** | ❌ **NEVER commit** | Local development machine secrets and local service ports. |
| **`.env.example`** | **Template / Placeholder** | ✅ **MUST commit** | Complete list of all required environment keys with dummy/placeholder values. |
| **`.env`** | **Production (Prod)** | ❌ **NEVER commit** | Live production environment variables injected securely via CI/CD. |

## 2. Root Monorepo Loading Patterns

In nested monorepos (`apps/api`, `apps/web`), maintain a single centralized `.env.local` at the monorepo root:

- **NestJS (`apps/api`)**: Configure `@nestjs/config` with `envFilePath: [path.resolve(process.cwd(), '../../.env.local'), path.resolve(process.cwd(), '.env.local')]`.
- **Next.js (`apps/web`)**: In `next.config.js`, load root envs via `loadEnvConfig(path.resolve(__dirname, '../../'))`.
- **Vite / SPA (`apps/web-admin`)**: Set `envDir: path.resolve(__dirname, '../../')` in `vite.config.ts`.
- **Turborepo (`turbo.json`)**: Declare all shared environment variables inside `globalEnv`.

## 3. Security Scoping Boundary

- **Client Bundle Scope**: Only variables prefixed with `NEXT_PUBLIC_*` or `VITE_*` may be exposed in client code.
- **Server Private Scope**: Database passwords, signing secrets (`AUTH_SECRET`, `JWT_SECRET`), and internal API keys MUST NEVER use public prefixes.
- **Docker Compose Injection**: Inject environment files using `env_file: [ ${ENV_FILE:-.env.local} ]` at the root compose service definition.
