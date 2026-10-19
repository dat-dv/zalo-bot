---
name: backend-bridge-frontend
description: Standardize reusable DTO Contracts between Backend and Frontend via Shared Contract Package (@shared/contracts).
metadata:
  agent-artifact:
    id: backend-bridge-frontend-skill
    type: skill
    explanation: .agents/system-explain/plugins/backend-bridge-frontend/skills/README.md
    depends_on:
      - .claude/skills/backend-bridge-frontend/rules/01-architecture-and-layers.md
      - .claude/skills/backend-bridge-frontend/rules/02-conventions-and-naming.md
      - .claude/skills/backend-bridge-frontend/rules/03-quality-gates.md
---

> **zalo-bot adaptation** (vendored from Base Agents plugin `backend-bridge-frontend`; project conventions override generic defaults below)
>
> - The shared package is `@zalobot/contracts` (`packages/contracts/src/index.ts`), not `@shared/contracts`. It already holds `API_ROUTES`, `APP_ROUTES`, i18n catalog (`translate`, `localeTag`) and `IApiErrorResponse`.
> - Rebuild it (`npm run build --workspace @zalobot/contracts`) before typechecking apps.

# Shared DTO Contracts Orchestrator

Standardize framework-agnostic **Contract-First DTO Sharing** between Backend and Frontend using a shared `@shared/contracts` package.

---

## 1. Shared Contract Workflow

When creating a new API or synchronizing DTO payloads across boundaries:

1. **Define Request Interface (`I<Feature>Request`)**:
   - Declare payload interfaces in `@shared/contracts` (e.g. `ICreateUserRequest`, `IUpdateProductRequest`).
   - **Backend DTO**: Backend DTO class `implements` or `extends` `I<Feature>Request` to guarantee contract compliance and attach validation rules.
   - **Frontend Payload**: Frontend API clients use `I<Feature>Request` directly as payload type for API calls.

2. **Define Response Interface (`I<Feature>Response`)**:
   - Declare return payload interfaces in `@shared/contracts` (e.g. `IUserResponse`, `IProductResponse`).
   - **Backend Response**: Backend DTO / Service returns objects matching `I<Feature>Response`.
   - **Frontend Response**: Frontend API clients receive data typed as `Promise<IApiResponse<I<Feature>Response>>`.

---

## 2. Verification

Run automated contract verification:

```bash
npm run build:shared
npm run typecheck
```

### ✅ Verification Criteria Checklist
- [ ] Request and response interfaces defined 100% in `@shared/contracts`.
- [ ] Backend DTO class `implements` / `extends` `I<Feature>Request`.
- [ ] Frontend API Client uses `I<Feature>Request` & `I<Feature>Response` directly from `@shared/contracts`.
- [ ] Shared package build and typecheck pass cleanly without errors.
