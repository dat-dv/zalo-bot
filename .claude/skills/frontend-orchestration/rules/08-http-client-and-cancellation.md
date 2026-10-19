---
trigger: model_decision
description: Dual HTTP Client isolation (proxyHttpClient vs directHttpClient), mandatory AbortSignal cancellation in Repositories/Hooks, and DomainError normalization.
metadata:
  agent-artifact:
    id: frontend-orchestration-rule-08
    type: rule
    explanation: .agents/system-explain/plugins/frontend-orchestration/rules/08-http-client-and-cancellation.md
    depends_on:
      - .claude/skills/frontend-orchestration/rules/01-architecture-and-ddd.md
---

# HTTP Client Factory Pattern, AbortSignal Cancellation, & Error Handling Rules

## 1. Unified HTTP Client Factory Pattern (`createHttpClient`)

All external API communication MUST go through the centralized HTTP client factory in `src/shared/utils/http/http-factory.ts`. Individual components or features MUST NOT invoke raw `fetch()` or instantiate ad-hoc `axios` instances directly inside views or components.

### A. Pure Core Factory & Contract (`src/shared/utils/http/http-factory.ts`)
The factory is a pure TypeScript function that standardizes timeout handling, token injection, FormData / JSON payload serialization, error normalization, and produces a unified `IApiResponse<T>` return shape:

```typescript
import type { IApiResponse } from '@/shared/contracts/api-response';

export interface HttpClientConfig {
  baseUrl: string;
  timeout?: number;
  getToken?: () => Promise<string | undefined> | string | undefined;
  headers?: Record<string, string>;
}

export interface IHttpClient {
  get<T>(url: string, init?: RequestInit): Promise<IApiResponse<T>>;
  post<T>(url: string, body?: unknown, init?: RequestInit): Promise<IApiResponse<T>>;
  put<T>(url: string, body?: unknown, init?: RequestInit): Promise<IApiResponse<T>>;
  patch<T>(url: string, body?: unknown, init?: RequestInit): Promise<IApiResponse<T>>;
  delete<T>(url: string, init?: RequestInit): Promise<IApiResponse<T>>;
}

export function createHttpClient(config: HttpClientConfig): IHttpClient {
  const { baseUrl, timeout = 30000, getToken, headers: defaultHeaders } = config;

  async function request<T>(endpoint: string, options: RequestInit = {}): Promise<IApiResponse<T>> {
    const targetUrl = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    const headers = new Headers(options.headers || defaultHeaders);

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    if (getToken) {
      const token = await getToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(targetUrl, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
      clearTimeout(timer);

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        return {
          success: false,
          statusCode: res.status,
          error: json?.message || json?.error || `HTTP Error ${res.status}`,
        };
      }

      return {
        success: true,
        statusCode: res.status,
        data: json?.data ?? json,
        message: json?.message,
      };
    } catch (error: unknown) {
      clearTimeout(timer);
      const isAbort = error instanceof Error && error.name === 'AbortError';
      const errorMessage = error instanceof Error ? error.message : 'Không thể kết nối đến máy chủ';
      return {
        success: false,
        statusCode: isAbort ? 408 : 502,
        error: isAbort ? 'Request Timeout' : errorMessage,
      };
    }
  }

  return {
    get: <T>(url: string, init?: RequestInit) => request<T>(url, { ...init, method: 'GET' }),
    post: <T>(url: string, body?: unknown, init?: RequestInit) =>
      request<T>(url, { ...init, method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
    put: <T>(url: string, body?: unknown, init?: RequestInit) =>
      request<T>(url, { ...init, method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body) }),
    patch: <T>(url: string, body?: unknown, init?: RequestInit) =>
      request<T>(url, { ...init, method: 'PATCH', body: body instanceof FormData ? body : JSON.stringify(body) }),
    delete: <T>(url: string, init?: RequestInit) => request<T>(url, { ...init, method: 'DELETE' }),
  };
}
```

### B. Client Instance: `proxyHttpClient` (`src/shared/utils/http/client.ts`)
Used exclusively in browser Client Components & TanStack Query hooks, targeting same-origin `PROXY_ROUTES.BASE` (`/api/proxy`) where the browser automatically attaches HttpOnly session cookies:

```typescript
import { PROXY_ROUTES } from '@/shared/constants/api-routes';
import { createHttpClient } from './http-factory';

export const proxyHttpClient = createHttpClient({
  baseUrl: PROXY_ROUTES.BASE,
});
```

### C. Server Instance: `serverHttpClient` (`src/shared/utils/http/server.ts`)
Used in Server Actions (`'use server'`) and Server Components (RSC) with `import 'server-only'`, targeting private `process.env.API_URL` and auto-injecting server session tokens:

```typescript
import 'server-only';
import { auth } from '@/auth';
import { createHttpClient } from './http-factory';

export const serverHttpClient = createHttpClient({
  baseUrl: process.env.API_URL || 'http://localhost:8000',
  getToken: async () => {
    const session = await auth();
    return (session?.user as { accessToken?: string } | undefined)?.accessToken;
  },
});
```

---

## 2. Mandatory `AbortSignal` Request Cancellation

To prevent race conditions, memory leaks, and obsolete state updates during rapid user input (e.g. search debouncing) or page unmounting:

- **Repository Contract**: Repository methods accepting query parameters MUST accept an optional `signal?: AbortSignal` parameter.
- **Repository Implementation**: Pass `signal` to `httpClient.get(url, { signal })`.
- **Application Custom Hooks**: Custom hooks (`use<Feature>Search`) MUST instantiate `new AbortController()`, pass `controller.signal` to repository calls, and return a cleanup function `() => controller.abort()` in `useEffect`.
- **TanStack Query Coordination**: TanStack Query automatically injects `{ signal }` into query functions. Always pass this signal through to repository calls.
- **Canceled Error Suppression**: Ignore `CanceledError` / `AbortError` in catch blocks so aborting stale requests does not trigger user-facing error UI states.

---

## 3. Normalized Error Handling & Response Contract

- Repositories MUST return the normalized `IApiResponse<T>` contract (`{ success, data, error, statusCode }`) or map data to ViewModels cleanly before returning to Application or Presentation layers.
- 401 Unauthorized errors trigger authentication redirects or token refresh routines (via Edge Middleware in `nextjs-proxy` or Axios response interceptors in `nextjs-static`).

