---
trigger: model_decision
description: Pre-edit consumer survey, mandatory quality gates (lint, typecheck, build), test creation decision gate, and generic 6-step feature build pipeline checklist.
metadata:
  agent-artifact:
    id: frontend-orchestration-rule-04
    type: rule
    explanation: .agents/system-explain/plugins/frontend-orchestration/rules/04-validation-and-quality-gates.md
    depends_on:
      - .claude/skills/frontend-orchestration/rules/01-architecture-and-ddd.md
---

# Validation, Quality Gates, & Generic Feature Build Pipeline

## 1. Consumer Impact Survey

Before modifying existing code, survey module locations and inspect all surrounding consumers using `rg`.

## 2. Quality Gates

- After editing TS/TSX files: **MANDATORY** run `npm run lint` and `npm run typecheck`.
- If modifying route handlers, App Router routes, or Next.js configurations: Run `npm run build`.
- **Zero Hardcoded Route Gate**: Ensure NO inline string literals are used for URLs, navigation paths, redirects, or API endpoints. All paths MUST be imported from `src/shared/constants/routes.ts` (`APP_ROUTES`) and `src/shared/constants/api-routes.ts` (`API_ROUTES`) or `@shared/contracts`.

## 3. Testing Decision Gate

When creating Unit, Component, or E2E tests, apply the **Decision Gate**: stop and request explicit Developer approval before initializing test files.

## 4. Generic 6-Step Feature Build Pipeline Checklist for AI Agents

Whenever implementing or refactoring a feature module (`src/modules/<feature>/`), AI Agents MUST execute and verify the following 6-step pipeline in order:

- [ ] **Step 1: Route Constants & DTO Contract**: Define/import `APP_ROUTES` and `API_ROUTES` in `src/shared/constants/` (or `@shared/contracts`). Define raw response interfaces `<Feature>BackendResponseDto` in `infrastructure/dtos/<feature>-dto.ts` and clean UI model `<Feature>ViewModel` in `domain/<feature>-types.ts`.
- [ ] **Step 2: DTO Mapper (RULE-01)**: Write mapper function `map<Feature>DtoToViewModel` in `infrastructure/mappers/<feature>-mapper.ts` to convert `snake_case` / raw string decimals to clean TS types.
- [ ] **Step 3: Repository Implementation (RULE-06)**: Implement `I<Feature>Repository` in `infrastructure/repositories/<feature>-repository.ts` calling HTTP client with `API_ROUTES` constants, applying mapper, and handling `AbortSignal`.
- [ ] **Step 4: Application Hook**: Write custom hook `use<Feature>Search` (or `use<Feature>...`) in `application/` wrapping Repository lifecycle with `AbortController` cancellation and debouncing.
- [ ] **Step 5: Feature View (RULE-05 & 4 UI States)**: Write Screen Controller View in `presentation/views/<feature>-list-view.tsx` with `'use client'` directive, handling all **4 UI States** (`Loading`, `Error`, `Empty`, `Success`), referencing `APP_ROUTES` for links/navigation.
- [ ] **Step 6: Route Page (Level 5 RSC)**: Declare route entry point `src/app/(dashboard)/<feature>/page.tsx` as pure RSC, extract query parameters, configure SEO metadata, and render the Feature View.

## 5. Mandatory Business UI & Integration Documentation

When building or modifying UI components (such as Header, Navigation, Modals, Forms, or Page Layouts):

- **Business UI Documentation**: Record the business UI specification under `.agents/knowledge/domain/` (e.g. `.agents/knowledge/domain/navigation-header.md`).
- **Integration Documentation**: Document integration seams: API endpoints, state management, event handlers, RSC vs Client Component boundaries.
