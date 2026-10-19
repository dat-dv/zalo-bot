---
trigger: model_decision
description: Dual Data Fetching architecture in Next.js (BFF/Proxy vs Direct Client-to-Backend) and Client routing decision matrix.
metadata:
  agent-artifact:
    id: tanstack-query-rule-01
    type: rule
    explanation: .agents/system-explain/plugins/tanstack-query/rules/01-architecture-and-dual-fetching.md
    depends_on:
      - .agents/rules/core.md
---

# Dual Data Fetching Architecture & Routing Rules

## 1. Dual Data Fetching Models

Next.js App Router applications MUST clearly distinguish between two independent communication flows:

```text
Flow 1: BFF / Proxy Flow
Browser Client ---> Next.js Server (/api/proxy/...) ---> Backend API (NestJS/VPC)
                      (Injects Server Secrets / HttpOnly Cookies)

Flow 2: Direct Client-to-Backend Flow
Browser Client -----------------------------------------> Backend API / Cloud
                      (Direct REST / S3 Upload / Socket.io)
```

### Flow 1: Next.js BFF / Proxy Pattern
- **Target URL**: Local Next.js endpoints (`/api/proxy/...` or Server Actions).
- **Mandatory Use Cases**:
  1. **Secret Isolation**: Calling private endpoints requiring backend secrets (`INTERNAL_SERVICE_TOKEN`, `STRIPE_SECRET_KEY`) that MUST NOT be exposed to the browser.
  2. **HttpOnly Cookie Exchange**: Client sends session cookies; Next.js server validates and injects upstream `Authorization: Bearer <token>`.
  3. **Backend Aggregation**: Next.js combines responses from multiple internal microservices into a single consolidated payload for the UI.
  4. **CORS & VPC Boundary**: Accessing internal services located within a private network/cluster without exposing public ingress.

### Flow 2: Direct Client-to-Backend Pattern
- **Target URL**: Public Backend API Base URL (`NEXT_PUBLIC_API_URL`).
- **Mandatory Use Cases**:
  1. **Server Offloading**: High-frequency polling, telemetry data, or real-time metric streams that would overload Next.js Node.js server memory and bandwidth.
  2. **Direct Large File Uploads**: Direct multipart upload to AWS S3, Cloudflare R2, or Google Cloud Storage via Presigned URLs.
  3. **Real-time Connections**: Direct WebSocket or SSE connections to backend event gateways.
  4. **Latency Optimization**: Direct 1-hop REST queries for non-secret public or user-scoped APIs.

---

## 2. HTTP Client Conventions

Features MUST define and configure two isolated HTTP client instances:
1. `proxyHttpClient`: Configured with `baseURL: PROXY_ROUTES.BASE` (`/api/proxy`) for BFF/Proxy communication.
2. `directHttpClient`: Configured with `baseURL: process.env.NEXT_PUBLIC_API_URL` for Direct communication.

Repositories MUST explicitly declare which client is utilized based on the routing decision matrix above, and MUST pass endpoints from `API_ROUTES` constants (never hardcoded strings).

