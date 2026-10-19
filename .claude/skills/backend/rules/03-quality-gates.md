---
trigger: model_decision
description: Quality gates for NestJS Clean Architecture, Prisma decimal casting, and verification commands.
metadata:
  agent-artifact:
    id: backend-rule-03
    type: rule
    explanation: .agents/system-explain/plugins/backend/rules/03-quality-gates.md
    depends_on:
      - .claude/skills/backend/rules/01-architecture-and-layers.md
---

# 03. Quality Gates & Verification Rules (Backend NestJS)

## 🛑 Strict Quality Gates (Anti-Patterns PROHIBITED)

1. ⛔ **PROHIBITED: Direct Prisma Client Access in Controllers or Use Cases**:
   - Controllers and Use Cases MUST NOT inject `PrismaService` directly. Database queries must pass through Repository implementations.
2. ⛔ **PROHIBITED: Raw Unconverted Decimal Fields**:
   - All Prisma `Decimal` fields returned from database queries MUST be converted using `Number(decimal)` before being passed to DTOs.
3. ⛔ **PROHIBITED: Skipping Class-Validator Decorators**:
   - Every field in Request DTOs MUST include `class-validator` decorators (`@IsString()`, `@IsNumber()`, `@IsOptional()`).
4. ⛔ **PROHIBITED: Unwrapped Raw Controller Responses**:
   - Every Controller endpoint MUST wrap return values with API Response Helpers (`createSuccessResponse(result)`).

---

## ⚡ Automated Verification Commands

Before completing backend tasks, MUST execute:

```bash
# 1. Typecheck project
npm run typecheck

# 2. Fix linting
npm run lint
```

---

## 3. Mandatory Business API & Domain Logic Documentation

When building or modifying Backend endpoints, Use Cases, or Domain Logic:

- **Business API & Domain Spec**: You **MUST** record the business logic specification (use case workflows, validation rules, business error codes, and permission constraints) under `.agents/knowledge/domain/` (e.g., `.agents/knowledge/domain/user-authentication.md`).
- **Database & Data Flow Spec**: You **MUST** document database schema changes, repository query relations, Decimal casting, and transactional boundaries.

