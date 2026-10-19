---
trigger: model_decision
description: Standardized DTO naming conventions for shared contract interfaces and wrappers.
metadata:
  agent-artifact:
    id: backend-bridge-frontend-rule-02
    type: rule
    explanation: .agents/system-explain/plugins/backend-bridge-frontend/rules/02-conventions-and-naming.md
    depends_on:
      - .claude/skills/backend-bridge-frontend/rules/01-architecture-and-layers.md
---

# 02. Shared Contract Naming Conventions

## 🏷️ Standardized DTO Naming Conventions

All types/interfaces in `@shared/contracts` must adhere to consistent framework-agnostic naming conventions:

1. **Request Interfaces**: Prefix `I`, suffix `Request` or `Params`.
   - Examples: `ICreateUserRequest`, `IUpdateProductRequest`, `IGetProductsParams`.
   - Usage: Frontend payload parameter type; Backend DTO class `implements` / `extends` this interface.

2. **Response Interfaces**: Prefix `I`, suffix `Response`.
   - Examples: `IUserResponse`, `IProductResponse`, `IAuthMeResponse`.
   - Usage: Returned by Backend handlers; consumed directly by Frontend clients.

3. **Shared Enums**: Prefix `E`.
   - Examples: `EUserRole`, `EProductStatus`, `EOrderState`.
   - Usage: Shared across boundaries for state, status, and permissions checks.

4. **API Wrappers**:
   - `IApiResponse<T>`: Standard format `{ status: string; data: T; message: string | null; timestamp: string }`.
   - `IPaginatedResult<T>`: Standard paginated format `{ items: T[]; meta: { total: number; page: number; limit: number; totalPages: number } }`.

5. **Route & Endpoint Constants**:
   - `APP_ROUTES` / `ROUTES`: Frontend UI navigation routes (e.g., `APP_ROUTES.AUTH.LOGIN`, `APP_ROUTES.USERS.DETAIL(id)`).
   - `API_ROUTES` / `API_ENDPOINTS`: API endpoint URLs (e.g., `API_ROUTES.AUTH.LOGIN`, `API_ROUTES.USERS.LIST`).
   - `PROXY_ROUTES`: Next.js BFF proxy paths (`PROXY_ROUTES.BASE = '/api/proxy'`).

