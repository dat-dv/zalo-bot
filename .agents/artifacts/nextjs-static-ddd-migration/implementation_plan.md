# Kế hoạch chuyển dashboard sang Next.js Static Export + DDD

RequestFeedback: true

## Mục tiêu

Thay `apps/web` (Vite React SPA) bằng Next.js App Router với `output: 'export'`, đồng thời tổ chức lại dashboard theo các bounded context DDD. Frontend vẫn gọi Nest API trực tiếp và giữ nguyên contract, token, refresh cookie và luồng mở dashboard từ zalo.

## Kiến trúc đích

```text
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                         # redirect tới /reports
│   └── reports/
│       ├── page.tsx                     # dashboard overview
│       ├── statistics/page.tsx
│       └── contacts/page.tsx
├── src/
│   ├── modules/
│   │   ├── auth/                        # capture token, storage, refresh/logout
│   │   ├── dashboard/                   # API DTO mapping, query, overview view
│   │   └── contacts/                    # API/query/view danh bạ
│   └── shared/
│       ├── api/                         # HTTP client và query provider
│       └── ui/                          # primitives tái sử dụng (DataTable, DataPanel, Button)
```

## Các bước

1. Thay dependencies/scripts Vite bằng Next.js, React và các công cụ lint/typecheck tương thích; cấu hình `output: 'export'` cùng `distDir` phù hợp artifact static.
2. Chuyển entry React, HTML và stylesheet global sang App Router; tạo route tĩnh `/reports`, `/reports/statistics`, `/reports/contacts` để deep-link từ Nest `/api/access` hoạt động không cần server fallback.
3. Di chuyển frontend theo DDD:
   - `auth`: nhận `dashboard_token` từ URL fragment, local storage, refresh token và logout.
   - `dashboard`: DTO/API/query và views overview/statistics.
   - `contacts`: DTO/API/query và view contacts.
   - `shared/api`: Axios client và TanStack Query provider.
   - `shared/ui`: `DataTable`, `DataPanel`, button và primitives trình bày dùng lại giữa nhiều module; không đặt UI components trong `packages/contracts`.
   - Module giữ các view/organism có ý nghĩa nghiệp vụ riêng, ví dụ dashboard metric grid và contacts table view; `shared/ui` không biết domain DTO hoặc API endpoint.
4. Giữ direct browser-to-Nest API: chỉ dùng `NEXT_PUBLIC_API_URL`; không thêm Next API routes, Server Actions hoặc server-only secrets. Cấu hình CORS/API URL cho static host.
5. Điều chỉnh Docker/deploy để phục vụ output static bằng hosting phù hợp, tách frontend static khỏi API Nest; cập nhật `.env` template cho `NEXT_PUBLIC_API_URL`.
6. Cập nhật `packages/contracts` chỉ nếu cần type route mới; giữ nguyên API routes hiện hữu. Cập nhật knowledge và developer docs phản ánh architecture/runtime mới.
7. Kiểm thử build static, typecheck, lint, và browser flow: `/api/access` redirect tới `/reports`, capture hash token, load dashboard, refresh khi 401, deep-link statistics/contacts và logout.

## Rủi ro và giảm thiểu

- `output: 'export'` không hỗ trợ API route/server runtime: loại trừ các feature này, giữ Nest là backend duy nhất.
- Cookie refresh là same-site: static web origin cần cùng site hoặc CORS/API configuration tương thích; xác minh trên deployment URL trước phát hành.
- Thay đổi package/build lớn: thực hiện theo migration có kiểm thử build và giữ API contract nguyên vẹn.
- Các thay đổi hiện có trong worktree rất nhiều: chỉ chạm `apps/web` và file cấu hình/tài liệu cần thiết, không ghi đè thay đổi không liên quan.

## Tiêu chí hoàn thành

- `apps/web` build được thành static files bằng Next.js.
- Các URL `/reports`, `/reports/statistics`, `/reports/contacts` tồn tại trong static output và hoạt động khi mở trực tiếp.
- Dashboard vẫn xác thực, tải dữ liệu, refresh session, logout và gọi Nest API đúng contract.
- DDD boundaries được phản ánh bằng module ownership rõ ràng; typecheck, lint và build đạt.

## Kết quả triển khai

- `apps/web` dùng Next.js 16 với `output: 'export'`, tạo static routes cho dashboard.
- UI được phân vùng theo `modules/auth`, `modules/dashboard`, `modules/contacts`, `shared/api`, `shared/providers`, `shared/ui`.
- Đã thêm web Docker image/Nginx, `NEXT_PUBLIC_API_URL`, `WEB_ORIGIN`, CORS dành cho Next local dev và tài liệu vận hành.
