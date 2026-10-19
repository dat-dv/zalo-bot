---
trigger: model_decision
description: Framework-agnostic single source of truth contract architecture for backend and frontend DTO payloads.
metadata:
  agent-artifact:
    id: backend-bridge-frontend-rule-01
    type: rule
    explanation: .agents/system-explain/plugins/backend-bridge-frontend/rules/01-architecture-and-layers.md
    depends_on:
      - .agents/rules/core.md
---

# 01. Framework-Agnostic Contract Architecture

## 🌉 Contract-First DTO Sharing Pattern

The data contract bridge between Backend and Frontend follows the **Single Source of Truth** principle in the Shared Contract Package (`@shared/contracts` or `packages/shared/src/`).

```mermaid
flowchart TD
    subgraph SharedPackage ["Shared Contract Package (@shared/contracts)"]
        RequestInterface["Request Interface\n(I<Feature>Request)"]
        ResponseInterface["Response Interface\n(I<Feature>Response)"]
        ApiResponseWrapper["API Response Wrapper\n(IApiResponse<T> & IPaginatedResult<T>)"]
        SharedEnums["Shared Enums\n(E<EnumName>)"]
    end

    subgraph BackendLayer ["Backend Layer"]
        BackendDTO["Backend DTO Class\n(implements / extends RequestInterface)"]
        BackendController["Backend API Handler / Controller\n(returns IApiResponse<ResponseInterface>)"]
    end

    subgraph FrontendLayer ["Frontend Layer"]
        FrontendPayload["Frontend Request Payload\n(typed as RequestInterface)"]
        FrontendResponse["Frontend API Response\n(typed as ResponseInterface)"]
    end

    RequestInterface --> BackendDTO
    RequestInterface --> FrontendPayload
    ResponseInterface --> BackendController
    ResponseInterface --> FrontendResponse
    ApiResponseWrapper --> BackendController
    ApiResponseWrapper --> FrontendResponse
```

---

## 🏛️ Core Contract Rules

1. **Request DTO Boundary**:
   - Every struct/interface describing API parameters MUST be defined in `@shared/contracts` under the name `I<Feature>Request`.
   - Backend DTO classes `implements` or `extends` this interface.
   - Frontend forms / payload types use this interface directly.

2. **Response DTO Boundary**:
   - Every struct/interface describing return API payloads MUST be defined in `@shared/contracts` under the name `I<Feature>Response`.
   - Frontend receives API data directly typed as `I<Feature>Response` without duplicating interfaces.

3. **Centralized Route & Endpoint Constants Boundary**:
   - All API endpoints (`API_ENDPOINTS` / `API_ROUTES`) and App navigation paths (`APP_ROUTES` / `ROUTES`) MUST be defined in `@shared/contracts` (or `src/shared/constants/`).
   - Backend Controllers and Frontend Repositories/Pages MUST import and use these constants. Hardcoded string paths are STRICTLY PROHIBITED.

