---
trigger: model_decision
description: "Direct client HTTP client (directHttpClient), LocalStorage JWT token management, Axios Bearer token interceptor, and direct Backend CORS handling."
metadata:
  agent-artifact:
    id: nextjs-static-rule-02
    type: rule
    explanation: .agents/system-explain/plugins/nextjs-static/rules/02-direct-client-api-and-auth.md
    depends_on:
      - .claude/skills/nextjs-static/rules/01-static-export-and-build-constraints.md
---

# Direct Client API Communication, LocalStorage JWT, & Interceptor Rules

In Next.js Static Export applications (Pure Client SPA mode), there is NO server runtime to manage HttpOnly cookies. Authentication is handled entirely on the client:

## 1. Client-Side JWT Storage Strategy

- **Storage Location**: Store the JWT `access_token` and `refresh_token` in browser `localStorage` (or an in-memory client auth store like Zustand with `persist` middleware).
- **Login Mutation**: The login view calls `API_ROUTES.AUTH.LOGIN` directly via `directHttpClient`, receives `{ accessToken, refreshToken, user }`, and saves tokens to `localStorage`.
- **Logout Action**: Clears `localStorage.removeItem('access_token')` and redirects the user to `APP_ROUTES.AUTH.LOGIN`.

## 2. Direct HTTP Client Setup (`src/shared/utils/request.ts`)

All API communication connects directly from the browser to the remote Backend API via `directHttpClient`:

```typescript
import axios from 'axios';
import { APP_ROUTES } from '@/shared/constants/routes';

export const directHttpClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer Token
directHttpClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response Interceptor: Handle 401 Unauthorized & Session Expiry
directHttpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = `${APP_ROUTES.AUTH.LOGIN}?expired=true`;
    }
    return Promise.reject(error);
  }
);
```

## 3. Direct CORS Configuration on Backend

Because the browser directly calls the remote backend domain (e.g. `https://api.example.com` from `https://app.example.com`):

- **Backend CORS Policy**: The upstream Backend API (NestJS/Express) MUST enable CORS (`enableCors({ origin: ['https://app.example.com'], credentials: true })`).
- **Allowed Headers & Methods**: Must explicitly permit `Authorization`, `Content-Type`, `Accept`, and methods `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
