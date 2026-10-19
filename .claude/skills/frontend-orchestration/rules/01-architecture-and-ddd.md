---
trigger: model_decision
description: Architecture mode detection (Mode 1 BFF vs Mode 2 SPA), satellite plugin discovery gate, 5-level UI architecture, 4-tier DDD module layout, and DTO isolation rules.
metadata:
  agent-artifact:
    id: frontend-orchestration-rule-01
    type: rule
    explanation: .agents/system-explain/plugins/frontend-orchestration/rules/01-architecture-and-ddd.md
    depends_on:
      - .agents/rules/core.md
---

# Frontend Master Orchestration: Architecture Modes, DDD, & 5-Level UI Rules

## 1. Authority Order & Conflict Resolution

1. Explicit Developer task instructions and scope.
2. Project conventions and architectural analysis under `AGENTS.md` and `.analysis/`.
3. Observed repository configuration and bundled Next.js / Vite documentation.
4. When conflicts arise between legacy example code and declared conventions: Report the contradiction explicitly to clarify; do not create parallel conventions silently.

## 2. Architecture Mode Detection & Discovery Gate

The Frontend Orchestrator automatically detects the repository architecture mode before selecting implementation patterns:

### Mode 1: Next.js App Router (BFF / SSR Hybrid)
- **Indicators**: `next.config.*`, `src/app/` or `app/` directory, `@next/env`.
- **Proxy Gateway**: Delegate to `.agents/plugins/nextjs-proxy/` for `/api/proxy/[...path]` route handling, HttpOnly token forwarding, multipart upload, and SSE streaming.
- **HTTP Client**: `proxyHttpClient` in `src/shared/utils/request.ts` forwarding requests to Next.js API Route Handlers.
- **Auth Strategy**: NextAuth / Auth.js v5 with JWT session stored in encrypted `HttpOnly` cookie. Route protection via Edge `middleware.ts`.
- **Form Handling**: TanStack `useMutation` via `proxyHttpClient` (Recommended) OR Next.js Server Actions (`'use server'`).
- **Server State Coordination**: Delegate to `tanstack-query` plugin using `getQueryClient()` per-request memoization and `<HydrationBoundary>` SSR prefetching.

### Mode 2: React SPA & Static Export (Vite / Next.js Static CSR)
- **Indicators**: `vite.config.*`, `output: 'export'`, `index.html` in root/src, `react-router-dom`.
- **Static Export & SPA Rules**: Delegate to `.claude/skills/nextjs-static/` for build constraints, client routing, and static CDN hosting.
- **HTTP Client**: `directHttpClient` in `src/shared/utils/request.ts` connecting directly to Backend API with Bearer token interceptor.
- **Auth Strategy**: Client JWT stored in `localStorage` / in-memory. Route protection via Client `<AuthGuard>` wrapper component.
- **Form Handling**: React Hook Form + Zod ➔ TanStack Query `useMutation` ➔ `directHttpClient` (Strictly NO Server Actions).
- **Server State Coordination**: Delegate to `tanstack-query` plugin using browser singleton `QueryClient`.

### Discovery Gate: Satellite Specialist Plugins Delegation
When executing feature implementation, the Frontend Orchestrator identifies scope and activates specialist plugins:
- **BFF API Proxy Gateway, NextAuth & Server Actions**: Delegate to `.agents/plugins/nextjs-proxy/` for `/api/proxy/[...path]` route handling, NextAuth HttpOnly cookies, and proxy mutations.
- **Static Export, Client JWT & Client SPA**: Delegate to `.claude/skills/nextjs-static/` for static export, direct API calls, `<AuthGuard>`, and client-only mutations.
- **Server State / Caching / Mutations**: Delegate to `.claude/skills/tanstack-query/` for Query Key factories, optimistic updates, and cache invalidation.
- **Visual Design / Layout Polish / Anti-AI-Slop**: Delegate to `.claude/skills/enterprise-ui/` for design principles, UI craft, pre-ship audits, and web interface guidelines.
- **Shared DTO Contracts**: Delegate to `.claude/skills/backend-bridge-frontend/` when `@shared/contracts` is available.

## 3. 5-Level Portable UI Architecture Hierarchy

Application UI components strictly adhere to a 5-level reuse hierarchy:

- **Level 5: Route Layer (`src/app/`)**: pure React Server Components (RSC). Responsible exclusively for Routing, SEO Metadata, Route parameters, and Server-side Input Sanitation.
- **Level 4: Feature Views (`src/modules/<feature>/presentation/views/`)**: Screen Controllers (`'use client'`). Own local view state, form lifecycles, and handle all **4 UI States** (`Loading`, `Error`, `Empty`, `Success`).
- **Level 3: Feature Organisms (`src/modules/<feature>/presentation/components/`)**: Domain-specific UI organisms belonging exclusively to a feature (e.g., `<feature>-card.tsx`, `<feature>-filter-bar.tsx`).
- **Level 3: Shared Organisms (`src/components/organisms/`)**: Domain-agnostic generic organisms reusable across the entire application (e.g., `data-table.tsx`, `stat-card.tsx`).
- **Level 2: Molecules (`src/components/molecules/`)**: Reusable multi-atom composables (e.g., `form-field.tsx` = Label + Input + ErrorText, `search-input.tsx`).
- **Level 1: Atoms (`src/components/atoms/`)**: Generic atomic UI primitives built with **Shadcn UI / Radix** (`button.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`, `skeleton.tsx`, `dialog.tsx`).

## 4. DDD Module Structure (`src/modules/<feature>/`)

Application domain logic is partitioned into Bounded Contexts under `src/modules/<feature>/`:

- **`domain/`**: Contains Domain Entities, ViewModels (`<feature>-types.ts` defining `<Feature>ViewModel`), and Repository Contracts (`I<Feature>Repository`). Must have **ZERO dependencies** on React, Next.js, UI components, or HTTP clients.
- **`infrastructure/`**: Contains Data Access and Data Transformation logic:
  - `mappers/`: Defines Zod transformation schemas (`<feature>-mapper.ts` implementing `<feature>ViewModelSchema` with `z.object().strict().transform()`). Automatically infers `z.input` (`<Feature>BackendResponseDto`) and `z.output` (`<Feature>ViewModel`) without writing redundant interfaces when `@shared/contracts` is absent.
  - `dtos/`: Re-exports `z.input<typeof <feature>ViewModelSchema>` or defines raw API payload contracts when shared contracts are not used.
  - `repositories/`: Implements `I<Feature>Repository` via HTTP client calls, Zod `safeParse` execution, and `AbortSignal` handling.
- **`application/`**: Contains Single-purpose Use Cases and Custom Hooks (`use-<feature>-search.ts`) wrapping Repository lifecycles with `AbortController` cancellation and debouncing.
- **`presentation/`**: Screen Controller Views (`views/`) and Feature Organisms (`components/`).

## 5. Mandatory Kernel Rules (RULE-01, RULE-02, RULE-04, RULE-05, RULE-06)

- **RULE-01 (Transport DTO Isolation)**: Raw Backend Response DTOs (`<Feature>BackendResponseDto` with `snake_case` or raw decimals) MUST NEVER leak into Presentation Views/Components. Always parse & transform raw DTOs to clean `<Feature>ViewModel` instances via Zod Transformer Schemas (`infrastructure/mappers/<feature>-mapper.ts`) before reaching the UI layer.
- **RULE-02 (Domain Pureness)**: Tầng `domain/` must remain 100% pure TypeScript with ZERO external dependencies (no React, Next.js, Axios, or UI libraries).
- **RULE-04 (Organism Ownership Boundary)**: Generic shared organisms (`stat-card.tsx`, `data-table.tsx`) MUST be placed in `src/components/organisms/`. Feature-specific organisms (`<feature>-card.tsx`) MUST be placed in `src/modules/<feature>/presentation/components/`.
- **RULE-05 (Client Boundary at View Level)**: `page.tsx` (Level 5) MUST remain a pure RSC. The `'use client'` directive MUST only start at Screen Controller Views in `src/modules/<feature>/presentation/views/` (Level 4).
- **RULE-06 (Zero Hardcoded Routes & Centralized Registry)**: Hardcoding route and endpoint string literals (e.g. `'/login'`, `'/dashboard'`, `'/api/v1/...'`) in links, router navigation, server redirects, revalidations, and HTTP client calls is STRICTLY FORBIDDEN. All paths MUST be imported from `src/shared/constants/routes.ts` (`APP_ROUTES`) and `src/shared/constants/api-routes.ts` (`API_ROUTES`) or `@shared/contracts`. Dynamic routes MUST use typed builder functions.

## 6. Forbidden Directory Anti-Patterns

Do not create or use unowned junk directories such as `common`, `misc`, `helpers`, or `services` without clear ownership.

