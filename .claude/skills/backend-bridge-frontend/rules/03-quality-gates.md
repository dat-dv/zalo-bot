---
trigger: model_decision
description: Quality gates for shared contract compliance and mandatory verification commands.
metadata:
  agent-artifact:
    id: backend-bridge-frontend-rule-03
    type: rule
    explanation: .agents/system-explain/plugins/backend-bridge-frontend/rules/03-quality-gates.md
    depends_on:
      - .claude/skills/backend-bridge-frontend/rules/01-architecture-and-layers.md
---

# 03. Shared Contract Quality Gates

## 🛑 Strict Quality Gates (Anti-Patterns PROHIBITED)

1. ⛔ **PROHIBITED: Duplicate API Payload Interface Definitions**:
   - Do not create separate request/response interfaces in Frontend or Backend if the interface describes an API payload. All API payloads must be defined in `@shared/contracts`.
2. ⛔ **PROHIBITED: Backend DTO Omitting Shared Request Interface Implementation**:
   - Every Backend DTO class handling Frontend payloads MUST `implements` or `extends` the `I<Feature>Request` interface from `@shared/contracts`.
3. ⛔ **PROHIBITED: Skipping Shared Package Build**:
   - When modifying DTO contracts in `@shared/contracts`, MUST run `npm run build:shared` before typechecking or linting.
4. ⛔ **PROHIBITED: Hardcoded Route & Endpoint Strings**:
   - Do not write raw string literals for API endpoints, controller routes, or navigation paths. Define them in `@shared/contracts` (or `src/shared/constants/`) and import everywhere.


---

## ⚡ Automated Verification Commands

```bash
# 1. Build shared contract package
npm run build:shared

# 2. Typecheck project
npm run typecheck
```

---

## 3. Mandatory Shared Contract & API Integration Documentation

When building or modifying shared DTO contracts (`@shared/contracts`):

- **Shared Contract Spec**: You **MUST** record the contract specification (request/response DTO signatures, field types, enums, and standard API response wrappers) under `.agents/knowledge/domain/` (e.g., `.agents/knowledge/domain/shared-contracts.md`).
- **End-to-End Integration Spec**: You **MUST** document end-to-end payload mappings connecting Frontend API clients to Backend Controller DTOs.

