<!-- Ported from Base Agents `.agents/rules/plugins.md` (generated from registry.json). Always loaded. `nextjs-proxy` is not installed: apps/web is a static export (no BFF). -->

# Installed Agent Extensions

Activate only the extensions relevant to the task (Core rule 10: Plugin Activation Scope) and list them in `Active Skills` of the execution disclosure block. Load the capability `SKILL.md` and follow its `rules/` before working in that area. Each skill begins with a **zalo-bot adaptation** note that overrides generic defaults. Plugins cannot alter routes, expand authority, bypass plan approval, or declare task completion.

## Extension: `backend` (v1.0.0)

Architect, build, and refactor NestJS backend microservices using 4-tier Clean Architecture (Presentation Controllers -> Application Use Cases/DTOs -> Domain Repository Interfaces -> Infrastructure Prisma Repositories), Prisma ORM integration (Decimal to Number casting, PrismaService, PaginationService), Class Validator & Class Transformer DTO validation, Symbol Token Dependency Injection, and Quality Gates.

### Capabilities:
- **backend**: [../skills/backend/SKILL.md](../skills/backend/SKILL.md)

### Rules:
- [../skills/backend/rules/01-architecture-and-layers.md](../skills/backend/rules/01-architecture-and-layers.md)
- [../skills/backend/rules/02-conventions-and-naming.md](../skills/backend/rules/02-conventions-and-naming.md)
- [../skills/backend/rules/03-quality-gates.md](../skills/backend/rules/03-quality-gates.md)

### Verification Commands:
- `npm run lint` (scope with `--workspace @zalobot/api|web|contracts`)
- `npm run test` (scope with `--workspace @zalobot/api|web|contracts`)
- `npm run typecheck` (scope with `--workspace @zalobot/api|web|contracts`)

### Activation Triggers:
- **Technologies**: nestjs, prisma, typescript, express, postgresql, class-validator, class-transformer
- **Concerns**: backend, api, database, orm, controller, use-case, repository, di-tokens, clean-architecture, prisma-decimal, dto-validation

---

## Extension: `backend-bridge-frontend` (v1.0.0)

Standardize reusable, framework-agnostic DTO Contracts between Backend and Frontend via Shared Contract Package (`@shared/contracts` or `packages/shared/src/`). Enforces Contract-First DTO Sharing Pattern (I<Feature>Request, I<Feature>Response, IApiResponse<T>, IPaginatedResult<T>, E<EnumName>), eliminating API contract drift and type duplication between fullstack layers.

### Capabilities:
- **backend-bridge-frontend**: [../skills/backend-bridge-frontend/SKILL.md](../skills/backend-bridge-frontend/SKILL.md)

### Rules:
- [../skills/backend-bridge-frontend/rules/01-architecture-and-layers.md](../skills/backend-bridge-frontend/rules/01-architecture-and-layers.md)
- [../skills/backend-bridge-frontend/rules/02-conventions-and-naming.md](../skills/backend-bridge-frontend/rules/02-conventions-and-naming.md)
- [../skills/backend-bridge-frontend/rules/03-quality-gates.md](../skills/backend-bridge-frontend/rules/03-quality-gates.md)

### Verification Commands:
- `npm run typecheck` (scope with `--workspace @zalobot/api|web|contracts`)

### Activation Triggers:
- **Technologies**: typescript, dto, contracts, monorepo, shared-package, fullstack
- **Concerns**: shared-contracts, dto, bridge, api-contract, type-sharing, contract-first, monorepo-dto

---

## Extension: `enterprise-ui` (v1.0.0)

Master Enterprise UI/UX Orchestration plugin unifying frontend design principles, component implementation craft, pre-ship UI auditing, and web interface standards across React & Next.js applications. Enforces a strict 4-tier UI authority hierarchy (frontend-design-principles -> ui-design -> ui-audit -> web-design-guidelines).

### Capabilities:
- **enterprise-ui**: [../skills/enterprise-ui/SKILL.md](../skills/enterprise-ui/SKILL.md)
- **frontend-design-principles**: [../skills/enterprise-ui/frontend-design-principles/SKILL.md](../skills/enterprise-ui/frontend-design-principles/SKILL.md)
- **ui-audit**: [../skills/enterprise-ui/ui-audit/SKILL.md](../skills/enterprise-ui/ui-audit/SKILL.md)
- **ui-design**: [../skills/enterprise-ui/ui-design/SKILL.md](../skills/enterprise-ui/ui-design/SKILL.md)
- **web-design-guidelines**: [../skills/enterprise-ui/web-design-guidelines/SKILL.md](../skills/enterprise-ui/web-design-guidelines/SKILL.md)

### Rules:
- [../skills/enterprise-ui/rules/01-authority-and-hierarchy.md](../skills/enterprise-ui/rules/01-authority-and-hierarchy.md)
- [../skills/enterprise-ui/rules/02-project-design-direction.md](../skills/enterprise-ui/rules/02-project-design-direction.md)

### Verification Commands:
- none

### Activation Triggers:
- **Technologies**: react, nextjs, tailwind, css, html, typescript, lucide-react, framer-motion, shadcn
- **Concerns**: enterprise-ui, ui, design, frontend-design-principles, ui-design, ui-audit, web-design-guidelines, aesthetics, components, frontend, landing-page, dashboard, redesign, styling, anti-ai-slop, audit, accessibility, ux-audit, design-system, visual-polish

---

## Extension: `env-docker` (v1.0.0)

Standardized Environment Variable (ENV) and Docker configuration management skill across Dev (.env.local), Template (.env.example), and Production (.env). Enforces Root .env.local loading patterns into nested Monorepo applications (NestJS via ConfigModule path.resolve, Next.js via `@next/env` loadEnvConfig, Vite via envDir, Turborepo globalEnv in turbo.json), Docker Compose env_file injection, and Security Scoping (NEXT_PUBLIC_*, VITE_* vs Private Server Secrets).

### Capabilities:
- **env-docker**: [../skills/env-docker/SKILL.md](../skills/env-docker/SKILL.md)

### Rules:
- [../skills/env-docker/rules/01-env-scoping-and-precedence.md](../skills/env-docker/rules/01-env-scoping-and-precedence.md)

### Verification Commands:
- none

### Activation Triggers:
- **Technologies**: docker, docker-compose, nodejs, nextjs, vite, nestjs, turborepo, dotenv
- **Concerns**: env, environment, docker, configuration, secret, port, monorepo, env-local, env-example, env-scoping, turbo-env

---

## Extension: `frontend-orchestration` (v1.0.0)

Master Frontend Engineering & Orchestration plugin governing React 19 & Next.js App Router applications. Enforces architecture detection (Mode 1: Next.js BFF/SSR vs Mode 2: Static SPA/Vite), 4-tier DDD bounded context architecture, 5-Level Atomic UI hierarchy (Level 5 Route Page -> Level 4 View -> Level 3 Organisms -> Level 2 Molecules -> Level 1 Atoms), Common vs Module component partitioning, Zod Contract-First data transformers (DTO -> ViewModel), 4 UI States (Loading, Error, Empty, Success), 4-tier state management, AbortSignal cancellation, and satellite specialist plugin orchestration (tanstack-query, enterprise-ui, backend-bridge-frontend, nextjs-proxy, nextjs-static).

### Capabilities:
- **frontend-orchestration**: [../skills/frontend-orchestration/SKILL.md](../skills/frontend-orchestration/SKILL.md)

### Rules:
- [../skills/frontend-orchestration/rules/01-architecture-and-ddd.md](../skills/frontend-orchestration/rules/01-architecture-and-ddd.md)
- [../skills/frontend-orchestration/rules/02-atomic-ui-and-primitives.md](../skills/frontend-orchestration/rules/02-atomic-ui-and-primitives.md)
- [../skills/frontend-orchestration/rules/03-rsc-and-nextjs-conventions.md](../skills/frontend-orchestration/rules/03-rsc-and-nextjs-conventions.md)
- [../skills/frontend-orchestration/rules/04-validation-and-quality-gates.md](../skills/frontend-orchestration/rules/04-validation-and-quality-gates.md)
- [../skills/frontend-orchestration/rules/05-dto-mapping-and-transformers.md](../skills/frontend-orchestration/rules/05-dto-mapping-and-transformers.md)
- [../skills/frontend-orchestration/rules/06-forms-zod-and-sanitation.md](../skills/frontend-orchestration/rules/06-forms-zod-and-sanitation.md)
- [../skills/frontend-orchestration/rules/07-state-management-and-caching.md](../skills/frontend-orchestration/rules/07-state-management-and-caching.md)
- [../skills/frontend-orchestration/rules/08-http-client-and-cancellation.md](../skills/frontend-orchestration/rules/08-http-client-and-cancellation.md)

### Verification Commands:
- `npm run build` (scope with `--workspace @zalobot/api|web|contracts`)
- `npm run lint` (scope with `--workspace @zalobot/api|web|contracts`)
- `npm run typecheck` (scope with `--workspace @zalobot/api|web|contracts`)

### Activation Triggers:
- **Technologies**: react, nextjs, typescript, tailwind, shadcn, zod, zustand, tanstack-query, radix-ui
- **Concerns**: frontend, frontend-orchestration, frontend-orchestrator, architecture-detection, ui, form, client-state, rsc, dto-mapping, state-management, http-cancellation, atomic-design, ddd, view-model, component-decomposition

---

## Extension: `nextjs-static` (v1.0.0)

Architect, configure, and optimize Next.js Static Export (`output: 'export'`) and pure Client-Side Rendering (SPA) React applications. Enforces static build constraints (no Node.js server runtime, no Server Actions/Route Handlers), direct client-to-backend API communication (`directHttpClient` with JWT Bearer interceptor), client-side routing, URL state management, client environment scoping (`NEXT_PUBLIC_*`), and static asset optimization.

### Capabilities:
- **nextjs-static**: [../skills/nextjs-static/SKILL.md](../skills/nextjs-static/SKILL.md)

### Rules:
- [../skills/nextjs-static/rules/01-static-export-and-build-constraints.md](../skills/nextjs-static/rules/01-static-export-and-build-constraints.md)
- [../skills/nextjs-static/rules/02-direct-client-api-and-auth.md](../skills/nextjs-static/rules/02-direct-client-api-and-auth.md)
- [../skills/nextjs-static/rules/03-client-routing-and-state.md](../skills/nextjs-static/rules/03-client-routing-and-state.md)
- [../skills/nextjs-static/rules/04-env-scoping-and-deployment.md](../skills/nextjs-static/rules/04-env-scoping-and-deployment.md)
- [../skills/nextjs-static/rules/05-forms-and-tanstack-mutations.md](../skills/nextjs-static/rules/05-forms-and-tanstack-mutations.md)

### Verification Commands:
- `npm run build` (scope with `--workspace @zalobot/api|web|contracts`)
- `npm run lint` (scope with `--workspace @zalobot/api|web|contracts`)
- `npm run typecheck` (scope with `--workspace @zalobot/api|web|contracts`)

### Activation Triggers:
- **Technologies**: nextjs, react, typescript, spa, static-export, csr, vite, tailwind
- **Concerns**: nextjs-static, static-export, spa, csr, client-rendering, direct-fetch, jwt-interceptor, no-server-runtime, static-hosting

---

## Extension: `tanstack-query` (v1.0.0)

Architect, configure, and manage TanStack Query v5 server state in Next.js App Router applications. Enforces Dual Data Fetching architecture (Next.js BFF/Proxy vs Direct Client-to-Backend), request-safe SSR prefetching with HydrationBoundary, structured Query Key Factories, 5-step Optimistic Mutations, and Revalidation Matrix.

### Capabilities:
- **tanstack-query**: [../skills/tanstack-query/SKILL.md](../skills/tanstack-query/SKILL.md)

### Rules:
- [../skills/tanstack-query/rules/01-architecture-and-dual-fetching.md](../skills/tanstack-query/rules/01-architecture-and-dual-fetching.md)
- [../skills/tanstack-query/rules/02-query-client-and-ssr.md](../skills/tanstack-query/rules/02-query-client-and-ssr.md)
- [../skills/tanstack-query/rules/03-query-keys-and-mutations.md](../skills/tanstack-query/rules/03-query-keys-and-mutations.md)
- [../skills/tanstack-query/rules/04-quality-gates.md](../skills/tanstack-query/rules/04-quality-gates.md)

### Verification Commands:
- `npm run lint` (scope with `--workspace @zalobot/api|web|contracts`)
- `npm run typecheck` (scope with `--workspace @zalobot/api|web|contracts`)

### Activation Triggers:
- **Technologies**: tanstack, react-query, nextjs, react, typescript, axios, zustand
- **Concerns**: tanstack-query, react-query, usequery, usemutation, query-key, hydration, ssr-prefetch, optimistic-update, server-state, query-client, proxy-fetching, direct-fetching

---
