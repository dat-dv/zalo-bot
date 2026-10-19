---
name: backend
description: NestJS Backend plugin, 4-tier Clean Architecture (DTO -> Controller -> Use Case -> Repository), Prisma ORM integration, Class Validator, DI Tokens, and Quality Gates.
metadata:
  agent-artifact:
    id: backend-skill
    type: skill
    explanation: .agents/system-explain/plugins/backend/skills/README.md
    depends_on:
      - .claude/skills/backend/rules/01-architecture-and-layers.md
      - .claude/skills/backend/rules/02-conventions-and-naming.md
      - .claude/skills/backend/rules/03-quality-gates.md
---

> **zalo-bot adaptation** (vendored from Base Agents plugin `backend`; project conventions override generic defaults below)
>
> - Project uses **TypeORM + PostgreSQL**, not Prisma: map "Prisma repository/PrismaService/Decimal casting" guidance to TypeORM entities, repositories and `numeric` → number conversion; schema changes = new TypeORM migration.
> - Modules are feature folders `apps/api/src/<module>/` (module + controller + service + specs). Keep that shape; apply 4-tier Clean Architecture only to new modules or when an approved plan says so.
> - Errors go through the global `GlobalExceptionsFilter` (`IApiErrorResponse`); config only via validated Nest config.
> - Verification: `npm run typecheck|lint:check|test --workspace @zalobot/api`.

# Backend NestJS Plugin Orchestrator

Use this skill when creating, modifying, or refactoring NestJS API features, Prisma Repositories, DTO Validations, Use Cases, and Backend services.

## 1. Inspect Before Designing

Refer to architectural documentation and references drawn from real codebase patterns:

### Architectural References
- [Architecture & Layer Setup](references/architecture/INDEX.md)
- [API Contracts & DTO Validation](references/api-and-contracts/INDEX.md)
- [Data Modeling & Prisma Repositories](references/data-and-db/INDEX.md)
- [Operations & Quality Gates](references/operations/INDEX.md)

### Standalone Code Examples
- [Use Case & Repository Pattern with Prisma & Pagination](examples/repository-mapper-use-case.ts)
- [Class-Validator DTO Schema with Shared Contracts](examples/validated-dto-schema.ts)
- [Global Response Interceptor & Exception Filter](examples/http-client-interceptor.ts)
- [Atomic Transaction & Decimal Conversion Boundary](examples/transaction-boundary.ts)

---

## 2. Choose the Smallest Fitting Path

1. **Inspect Shared Contract Package / Module**: Check if request/response DTO interfaces exist in `@shared/` or `src/shared/`.
2. **Implement DTO**: Create `<feature>/application/dto/<verb>-<noun>.dto.ts` implementing the shared contract interface with `class-validator`.
3. **Implement Repository**: Declare Symbol Token `I<Feature>Repository` in `domain/<feature>.repository.interface.ts` and concrete class in `infrastructure/repositories/<feature>.repository.ts` injecting `PrismaService` + `PaginationService`.
4. **Implement Use Case**: Create a single-action `@Injectable()` class in `application/use-cases/` with `execute()` method.
5. **Implement Controller**: Create `presentation/controllers/<feature>.controller.ts` using project guards/decorators (`AuthGuard`, `@Language()`) and wrap output with API response helpers (`createSuccessResponse(result)`).

---

## 3. Complete Against Executable Contracts

Run automated verification checks before completing tasks:

```bash
# 1. Typecheck project
npm run typecheck

# 2. Fix linting
npm run lint
```

### ✅ Verification Criteria Checklist
- [ ] Feature files are located symmetrically under `<app-root>/src/modules/<feature>/`.
- [ ] DTO implements interface from project Shared Contract package/module.
- [ ] Controller wraps output with API Response Helper and uses Auth Guards on protected routes.
- [ ] Repository is injected into Use Case via `@Inject(I<Feature>Repository)`.
- [ ] All `Decimal` fields from Prisma are cast to `Number()`.
- [ ] `npm run typecheck` and `npm run lint` pass cleanly with 0 errors.
