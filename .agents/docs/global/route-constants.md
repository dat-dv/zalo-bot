---
metadata:
  agent-artifact:
    id: docs-global-route-constants
    type: documentation
    depends_on:
      - .agents/knowledge/global/route-constants.md
      - .claude/rules/strict-routes-and-paths.md
      - packages/contracts/src/index.ts
---

# Hướng Dẫn Quy Chuẩn Quản Lý Route & API Constants

Tài liệu này giải thích quy chuẩn cấm hardcode đường dẫn trang và endpoint API, ánh xạ với tri thức canonical [`route-constants.md`](../../knowledge/global/route-constants.md) và rule [`strict-routes-and-paths.md`](../../../.claude/rules/strict-routes-and-paths.md).

---

## 1. Vì Sao Bắt Buộc Dùng Route Constants?

1. **Chống gãy link**: đổi URL trang hoặc endpoint chỉ cần sửa một chỗ.
2. **Type safety**: gõ `APP_ROUTES.` / `API_ROUTES.` được IDE gợi ý, gõ sai key thì lỗi typecheck.
3. **Đồng bộ fullstack**: web và API cùng đọc một file trong `@zalobot/contracts`, nên đường dẫn backend và frontend không lệch nhau.

---

## 2. Vị Trí Duy Nhất

Cả hai hằng số nằm trong `packages/contracts/src/index.ts` (package `@zalobot/contracts`):

- `API_ROUTES`: endpoint backend, **đã gồm tiền tố `/api`** (không có `/api/v1`).
- `APP_ROUTES`: đường dẫn trang của web dashboard.

Dự án **không** có `PROXY_ROUTES`, thư mục `src/shared/constants/` hay lớp BFF proxy: web là static export, `httpClient` gọi thẳng NestJS (qua `NEXT_PUBLIC_API_URL` hoặc cùng domain qua Nginx).

---

## 3. Cách Khai Báo Thực Tế

Key dạng camelCase phẳng; segment động là hàm có kiểu:

```typescript
// packages/contracts/src/index.ts (trích)
export const API_ROUTES = {
  transactions: '/api/transactions',
  debts: '/api/debts',
  debtsCombine: '/api/debts/combine',
  usersMerge: (id: string) => `/api/users/${id}/merge`,
  transactionAllocations: (id: string) => `/api/transactions/${id}/allocations`,
  zcaThreadConfig: (threadId: string) => `/api/zca/thread-configs/${threadId}`,
  googleAuthCallback: '/api/oauth2callback',
} as const;

export const APP_ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  transactions: '/transactions',
  debts: '/debts',
  zca: '/zca',
  settings: '/settings',
} as const;
```

Lưu ý: `APP_ROUTES.analyticsSpending`, `analyticsCashflow`, `analyticsDebts` đã khai báo nhưng chưa có trang tương ứng trong `apps/web/app/`.

---

## 4. Cách Dùng Trong Code

### 4.1. Link điều hướng

```tsx
import Link from 'next/link';
import { APP_ROUTES } from '@zalobot/contracts';

<Link href={APP_ROUTES.home}>{t('nav.home')}</Link>;
```

### 4.2. Chuyển hướng trang (static export)

```tsx
import { redirect } from 'next/navigation';
import { APP_ROUTES } from '@zalobot/contracts';

export default function ExpensesRedirectPage() {
  redirect(`${APP_ROUTES.transactions}?type=expense`);
}
```

### 4.3. Gọi API trong module `api/`

```tsx
import { API_ROUTES } from '@zalobot/contracts';
import { httpClient } from '@/shared/api/http-client';

export async function allocateTransaction(transactionId: string, allocations: unknown[]) {
  return httpClient.post(API_ROUTES.transactionAllocations(transactionId), { allocations });
}
```

Code hiện có còn ghép chuỗi kiểu `${API_ROUTES.debts}/${id}`. Endpoint mới nên khai báo hàm builder trong contract thay vì ghép tay.

### 4.4. Backend

Decorator controller NestJS (`@Get('transactions')`) khai báo đường dẫn tương đối với tiền tố toàn cục `/api`. Khi đổi đường dẫn backend phải sửa `API_ROUTES` trong cùng thay đổi. Backend cũng dùng hằng số khi cần URL đầy đủ, ví dụ `API_ROUTES.googleAuthCallback` để dựng redirect URI OAuth.

---

## 5. Chỗ còn hardcode cần dọn

- `apps/web/src/modules/auth/client/auth-storage.ts`: chuyển hướng tới chuỗi `/api/access?token=`.
- `apps/web/app/sitemap.ts`: liệt kê `/about`, `/privacy`, `/terms` bằng chuỗi.
