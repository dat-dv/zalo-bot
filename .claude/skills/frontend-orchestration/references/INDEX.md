# Master Frontend Engineering & Orchestration References Index

This directory contains master reference guides governing architecture, UI hierarchy, data transformation pipelines, and satellite plugin orchestration for Frontend applications.

## Master Reference Blueprints

1. **[Architecture & 4-Tier DDD Module Lifecycle](architecture/ddd-module-lifecycle.md)**
   - Domain, Application, Infrastructure, and Presentation bounded contexts.
   - Common Shared Kernel (`src/shared/`, `src/components/`) vs Feature Modules (`src/modules/<feature>/`).
   - Boundary enforcement rules: `RULE-01` (DTO Isolation), `RULE-02` (Domain Pureness).

2. **[5-Level Atomic UI Hierarchy & 4 UI States](ui-hierarchy/5-level-atomic-ui.md)**
   - Strict 5-level component hierarchy: Level 1 Atoms -> Level 2 Molecules -> Level 3 Organisms -> Level 4 Views -> Level 5 Route Pages.
   - Common UI vs Module UI partitioning matrix.
   - Mandatory handling of **4 UI States** (`Loading`, `Error`, `Empty`, `Success`).
   - Component decomposition limits (<80-100 lines/file, no inline SVG dumping) and WCAG accessibility.

3. **[Zod Contract-First Data Transformation Pipeline](data-flow/zod-contract-transformers.md)**
   - Case 1: Integrating with `@shared/contracts` (via `backend-bridge-frontend`).
   - Case 2: Single Source of Truth Zod Transformer Schema (`z.input` for raw Backend DTO, `z.output` for clean UI ViewModel).
   - Mandatory `safeParse` and `logApiDiffError` failure isolation.
   - Number/Decimal string parsing, snake_case to camelCase conversion, ISO date formatting.

4. **[Architecture Mode Decision Matrix & Satellite Symphony](orchestration/mode-decision-matrix.md)**
   - Automatic Mode Detection: Mode 1 (Next.js BFF / SSR Hybrid) vs Mode 2 (Static SPA / React CSR).
   - State Triangle: URL state (`nuqs`), Server Query Cache (`tanstack-query`), Local UI state (`useState`), and Global Client UI state (`zustand`).
   - Delegation matrix to specialist plugins (`nextjs-proxy`, `nextjs-static`, `tanstack-query`, `auth`, `enterprise-ui`, `backend-bridge-frontend`).
