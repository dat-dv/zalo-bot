# Walkthrough: Triển Khai Global Exception Filter Cho Backend

Chúng ta đã triển khai thành công **Global Exception Filter** cho NestJS backend (`apps/api`), chuẩn hóa toàn bộ phản hồi lỗi HTTP theo hợp đồng `@zalobot/contracts`, xử lý an toàn lỗi cơ sở dữ liệu và ghi log tập trung.

---

## 1. Các Thay Đổi Đã Thực Hiện

### 1. Shared Contracts (`packages/contracts`)

- **[MODIFY] [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)**:
  - Bổ sung interface `IApiErrorResponse`:
    ```typescript
    export interface IApiErrorResponse {
      statusCode: number;
      message: string | string[];
      error: string;
      timestamp: string;
      path: string;
    }
    ```

### 2. Backend API (`apps/api`)

- **[NEW] [`apps/api/src/common/filters/global-exceptions.filter.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/common/filters/global-exceptions.filter.ts)**:
  - Bắt toàn bộ lỗi `@Catch()`.
  - Phân loại và chuyển đổi `HttpException`, TypeORM `EntityNotFoundError` (404), TypeORM `QueryFailedError` (409 Conflict / 400 Bad Request cho constraint SQLite).
  - Ẩn chi tiết lỗi nội bộ/stack trace ở môi trường `production` cho các lỗi 500.
  - Xử lý an toàn khi context không phải HTTP (zalo bot, cron job).
  - Ghi log máy chủ qua NestJS `Logger` kèm context (method, URL, status code, stack trace).
- **[NEW] [`apps/api/src/common/filters/global-exceptions.filter.spec.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/common/filters/global-exceptions.filter.spec.ts)**:
  - Bộ 6 test cases kiểm thử các kịch bản ngoại lệ: NotFound, BadRequest với danh sách lỗi, EntityNotFoundError, QueryFailedError constraint violation, Unhandled 500 error, và Non-HTTP context.
- **[MODIFY] [`apps/api/src/app.module.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/app.module.ts)**:
  - Đăng ký `GlobalExceptionsFilter` qua `APP_FILTER` provider để tự động kích hoạt toàn cục.

### 3. Tri thức & Tài liệu Hệ thống (`.agents/`)

- **[NEW] [`.agents/knowledge/global/backend-exception-filter.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/backend-exception-filter.md)**: Kiến trúc Canonical tiếng Anh.
- **[NEW] [`.agents/docs/global/backend-exception-filter.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/backend-exception-filter.md)**: Hướng dẫn vận hành tiếng Việt.
- **[MODIFY] [`.agents/knowledge/global/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/README.md)** & **[`.agents/docs/global/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/README.md)**: Cập nhật mục lục tài liệu.

---

## 2. Kết Quả Kiểm Tra & Quality Gates

| Kiểm tra         | Lệnh                            | Kết quả                                                  |
| :--------------- | :------------------------------ | :------------------------------------------------------- |
| **Unit Tests**   | `npx tsx --test ...spec.ts`     | ✅ **6/6 tests passed**                                  |
| **Type Check**   | `npm run typecheck`             | ✅ **Passed across all packages (0 errors)**             |
| **Linter**       | `npm run lint`                  | ✅ **Passed across all packages (0 errors, 0 warnings)** |
| **Build**        | `npm run build`                 | ✅ **Contracts, API & Web build succeeded**              |
| **Agent System** | `npm run agent-system:validate` | ✅ **82 artifacts validated (0 errors)**                 |
