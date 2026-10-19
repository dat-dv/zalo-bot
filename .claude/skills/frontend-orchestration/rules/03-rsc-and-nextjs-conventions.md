---
trigger: model_decision
description: React 19 RSC-first component seams, thin Next.js App Router composition, Error Boundary standards, and kebab-case file naming rules.
metadata:
  agent-artifact:
    id: frontend-orchestration-rule-03
    type: rule
    explanation: .agents/system-explain/plugins/frontend-orchestration/rules/03-rsc-and-nextjs-conventions.md
    depends_on:
      - .claude/skills/frontend-orchestration/rules/01-architecture-and-ddd.md
---

# React 19, Next.js App Router, Error Boundaries, & Naming Conventions

## 1. React 19 & Next.js RSC Seams

- **Server Components (RSC)** are the default for Level 5 Route Pages (`src/app/.../page.tsx`).
- Level 5 Route Pages MUST perform route parameter extraction, SEO metadata export, and server data fetching/sanitation only. They MUST NOT contain UI state or event handlers.
- **RULE-05 (Client Boundary at View Level)**: The `'use client'` directive MUST NOT be placed at the top of Level 5 `page.tsx` files. It MUST be placed strictly at the entry of Screen Controller Views in `src/modules/<feature>/presentation/views/` (Level 4).

## 2. Next.js App Router Error Boundary & Resiliency Hierarchy

To prevent uncaught runtime errors from breaking the entire application UI:

1. **`src/app/global-error.tsx` (Root Layout Fallback)**:
   - Must be a Client Component (`'use client'`).
   - Must include `<html>` and `<body>` tags because it replaces the entire root layout when a catastrophic crash occurs at the root level.
   - Provides a minimal recovery UI with a `"Thử lại"` / `"Reload"` action button.

2. **`src/app/[segment]/error.tsx` (Route Segment Error Boundary)**:
   - Must be a Client Component (`'use client'`).
   - Accepts `{ error: Error & { digest?: string }, reset: () => void }` props.
   - Displays a localized, user-friendly error card (using Hallmark aesthetics) along with a `digest` / `traceId` for developer debugging, and a `reset()` button to retry rendering without full page reload.

3. **`src/app/[segment]/not-found.tsx` (Custom 404 UI)**:
   - Renders a clean, branded 404 Not Found page when `notFound()` is invoked inside Server Components.

4. **`src/app/[segment]/loading.tsx` (Instant Streaming Skeleton)**:
   - Renders instant layout skeleton state wrapped in React `<Suspense>` while server components prefetch data.

## 3. Naming & Export Conventions

- **Files and Directories**: Use `kebab-case` strictly across all modules and generic directories (e.g. `product-mapper.ts`, `use-product-search.ts`, `product-list-view.tsx`), except reserved Next.js route files (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`).
- **Components**: Use `PascalCase` for component declarations and JSX invocations (e.g. `ProductListView`, `ProductCard`).
- **Custom Hooks**: Always prefix with `use...` in `kebab-case` file naming (e.g. `use-product-search.ts` exporting `useProductSearch`).
- **DTOs and Mappers**: Use `<feature>-dto.ts` for DTO interfaces and `<feature>-mapper.ts` for mapper functions (e.g. `mapProductDtoToViewModel`).
- Single Responsibility: Each file primarily owns one main artifact. Avoid creating barrel files (`index.ts`) unless defining an explicit Public API for a module context.
