---
trigger: model_decision
description: NestJS file structure, naming conventions, and DI Symbol Token rules.
metadata:
  agent-artifact:
    id: backend-rule-02
    type: rule
    explanation: .agents/system-explain/plugins/backend/rules/02-conventions-and-naming.md
    depends_on:
      - .claude/skills/backend/rules/01-architecture-and-layers.md
---

# 02. Conventions & Naming Rules (Backend NestJS)

## 📁 Standard NestJS Feature Module Directory Layout

Backend API features follow this symmetrical directory structure:

```text
<app-root>/src/modules/<feature>/
├── domain/
│   └── <feature>.repository.interface.ts     # Repository Interface & Symbol Token
├── application/
│   ├── dto/
│   │   ├── create-<feature>.dto.ts
│   │   └── update-<feature>.dto.ts
│   └── use-cases/
│       ├── get-<feature>-detail.use-case.ts
│       └── update-<feature>.use-case.ts
├── infrastructure/
│   └── repositories/
│       └── <feature>.repository.ts           # Prisma Repository Implementation
├── presentation/
│   └── controllers/
│       └── <feature>.controller.ts           # NestJS Controller
└── <feature>.module.ts
```

---

## 🏷️ Dependency Injection Symbol Tokens

1. **Repository Symbol Token**:
   - MUST be declared alongside the interface in `domain/<feature>.repository.interface.ts`:
     `export const I<Feature>Repository = Symbol('I<Feature>Repository');`
2. **Injecting in Use Cases**:
   - `@Inject(I<Feature>Repository) private readonly repository: I<Feature>Repository`
3. **Module Registration**:
   - Register in `<feature>.module.ts`:
     `{ provide: I<Feature>Repository, useClass: <Feature>Repository }`

---

## 🛣️ Controller Route & Path Constants

1. **Route Matching with Shared Contracts**:
   - Controllers MUST map routes corresponding to `API_ROUTES` / `API_ENDPOINTS` defined in `@shared/contracts` (e.g. `@Controller('api/v1/users')`).
   - Dynamic parameters MUST use standard `@Param('id')` decorators without inconsistent path shapes.

