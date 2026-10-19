<!-- Ported verbatim from Base Agents `.agents/rules/strict-routes-and-paths.md` (Gemini/Antigravity). Tool names mapped per CLAUDE.md. Always loaded. -->

# Strict Route & Path Safety: Zero Hardcoded Routes Rule

## 1. Nguyên Tắc Cốt Lõi: Zero Hardcoding Policy cho Routes & Endpoints

Tuyệt đối KHÔNG viết trực tiếp chuỗi ký tự (hardcoded string literals) cho đường dẫn điều hướng giao diện (Application Navigation Paths) hoặc địa chỉ endpoint API (API Endpoints/Routes) trong toàn bộ mã nguồn TypeScript (`.ts`, `.tsx`).

Mọi đường dẫn và endpoint BẮT BUỘC phải được định nghĩa tập trung trong các đối tượng hằng số (`const ... as const`) và được import để sử dụng tại mọi vị trí:
- **Application Paths (UI Navigation & Routing)**: Quản lý qua `APP_ROUTES` hoặc `ROUTES` (ví dụ: `src/shared/constants/routes.ts` hoặc `@shared/contracts`).
- **API Endpoints (Backend & Proxy Gateway)**: Quản lý qua `API_ROUTES` hoặc `API_ENDPOINTS` (ví dụ: `src/shared/constants/api-routes.ts` hoặc `@shared/contracts`).
- **Proxy Gateway Base**: Quản lý qua `PROXY_ROUTES.BASE = '/api/proxy'`.

---

## 2. Bảng Đối Chiếu Hành Vi Cấm vs Hành Vi Chuẩn

| STT | Vị trí / Thao tác | ❌ SAI (Cấm tuyệt đối hardcode) | ✅ ĐÚNG (Import từ Route Constants) |
| :--- | :--- | :--- | :--- |
| 1 | **Thẻ liên kết UI (`<Link>`)** | `<Link href="/dashboard/users">` | `<Link href={APP_ROUTES.DASHBOARD.USERS}>` |
| 2 | **Client Navigation (`router.push`)** | `router.push('/login')` | `router.push(APP_ROUTES.AUTH.LOGIN)` |
| 3 | **Client Navigation (`router.replace`)** | `router.replace('/settings')` | `router.replace(APP_ROUTES.SETTINGS.HOME)` |
| 4 | **Server Redirect (`redirect`)** | `redirect('/login?redirect=/dashboard')` | `redirect(`${APP_ROUTES.AUTH.LOGIN}?redirect=${encodeURIComponent(APP_ROUTES.DASHBOARD.HOME)}`)` |
| 5 | **Next.js Revalidation (`revalidatePath`)**| `revalidatePath('/dashboard/products')` | `revalidatePath(APP_ROUTES.DASHBOARD.PRODUCTS)` |
| 6 | **HTTP Client Request (`httpClient.get`)**| `proxyHttpClient.get('/api/proxy/v1/users')` | `proxyHttpClient.get(API_ROUTES.USERS.LIST)` |
| 7 | **Direct API Request (`directHttpClient`)**| `directHttpClient.post('/api/v1/auth/login')` | `directHttpClient.post(API_ROUTES.AUTH.LOGIN)` |
| 8 | **Route Param động (Dynamic Segment)** | `router.push(`/users/${id}`)` | `router.push(APP_ROUTES.USERS.DETAIL(id))` |
| 9 | **API Endpoint động (Dynamic Parameter)** | `httpClient.delete(`/api/v1/items/${id}`)` | `httpClient.delete(API_ROUTES.ITEMS.DELETE(id))` |
| 10 | **Next.js Middleware Path Matchers** | `const PROTECTED = ['/dashboard', '/admin']` | `const PROTECTED = [APP_ROUTES.DASHBOARD.HOME, APP_ROUTES.ADMIN.HOME]` |

---

## 3. Cấu Trúc Khai Báo Route & Endpoint Constants Chuẩn

### 3.1. Application Navigation Routes (`APP_ROUTES`)
Được lưu trữ tại `src/shared/constants/routes.ts` (hoặc `@shared/contracts` trong Monorepo):

```typescript
export const APP_ROUTES = {
  HOME: '/',
  AUTH: {
    LOGIN: '/login',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
  },
  DASHBOARD: {
    HOME: '/dashboard',
    ANALYTICS: '/dashboard/analytics',
    USERS: '/dashboard/users',
    SETTINGS: '/dashboard/settings',
  },
  USERS: {
    LIST: '/users',
    CREATE: '/users/new',
    DETAIL: (id: string | number) => `/users/${id}`,
    EDIT: (id: string | number) => `/users/${id}/edit`,
  },
} as const;

export type AppRoutePaths = typeof APP_ROUTES;
```

### 3.2. API Endpoints / Routes (`API_ROUTES` / `API_ENDPOINTS`)
Được lưu trữ tại `src/shared/constants/api-routes.ts` (hoặc `@shared/contracts` trong Monorepo):

```typescript
export const API_ROUTES = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH: '/api/v1/auth/refresh',
    ME: '/api/v1/auth/me',
  },
  USERS: {
    LIST: '/api/v1/users',
    CREATE: '/api/v1/users',
    DETAIL: (id: string | number) => `/api/v1/users/${id}`,
    UPDATE: (id: string | number) => `/api/v1/users/${id}`,
    DELETE: (id: string | number) => `/api/v1/users/${id}`,
  },
  PRODUCTS: {
    LIST: '/api/v1/products',
    DETAIL: (id: string | number) => `/api/v1/products/${id}`,
  },
} as const;

export const PROXY_ROUTES = {
  BASE: '/api/proxy',
  BUILD: (endpoint: string) => `/api/proxy/${endpoint.replace(/^\//, '')}`,
} as const;
```

---

## 4. Quy Chuẩn Dành Riêng Cho Rules & Skills của Agent

1. **Tuyệt đối không hardcode trong code ví dụ**: Toàn bộ các file tài liệu, rules, skills, examples của hệ thống Agent System PHẢI sử dụng `APP_ROUTES`, `API_ROUTES`, `API_ENDPOINTS` trong các đoạn code mẫu TypeScript/TSX thay vì viết string literals.
2. **Quality Gate Kiểm Soát**: Khi AI Agent thực hiện refactor hoặc code tính năng mới, bắt buộc phải kiểm tra và chuyển đổi toàn bộ string route/endpoint sang constant imports trước khi hoàn thành task.
