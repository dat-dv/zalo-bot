# Kế Hoạch Triển Khai Global Exception Filter Cho Backend

## Bối Cảnh & Mục Tiêu

Hiện tại backend (`apps/api`) chưa có **Global Exception Filter**. Khi có lỗi xảy ra (lỗi logic 500, lỗi truy vấn TypeORM SQLite, hoặc các ngoại lệ HTTP), NestJS đang sử dụng built-in exception handler mặc định. Điều này dẫn đến:

1. Format response lỗi chưa được chuẩn hóa theo hợp đồng chung (`@zalobot/contracts`).
2. Các lỗi cơ sở dữ liệu (ví dụ TypeORM `QueryFailedError` do trùng unique key hoặc constraint) có thể trả về mã lỗi 500 kèm nội dung thô thay vì mã 400/409 rõ ràng.
3. Thiếu cơ chế ghi log lỗi tập trung kèm ngữ cảnh (Request URL, Method, Client IP, Trace ID) và rủi ro để lộ thông tin nhạy cảm ở production.

**Mục tiêu**: Xây dựng một **Global Exception Filter** chuẩn NestJS, tích hợp với `@zalobot/contracts`, xử lý toàn diện các dạng ngoại lệ và bảo vệ an toàn dữ liệu.

---

## User Review Required

> [!IMPORTANT]
> **Quy chuẩn định dạng Response Lỗi (`IApiErrorResponse`)**:
> Định dạng lỗi trả về thống nhất cho toàn bộ HTTP API sẽ có cấu trúc:
>
> ```json
> {
>   "statusCode": 400,
>   "message": "Chi tiết lỗi hoặc danh sách lỗi validation",
>   "error": "Bad Request",
>   "timestamp": "2026-08-23T16:48:00.000Z",
>   "path": "/api/transactions"
> }
> ```
>
> Mọi endpoint khi gặp lỗi sẽ luôn trả về schema này, giúp frontend (`@zalobot/web`) dễ dàng bắt và hiển thị thông báo.

---

## Proposed Changes

Grouped by component:

### 1. Shared Contracts (`packages/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung interface `IApiErrorResponse` và `IApiErrorDetail`.

---

### 2. Backend API (`apps/api`)

#### [NEW] [global-exceptions.filter.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/common/filters/global-exceptions.filter.ts)

- Tạo class `GlobalExceptionsFilter` implement `ExceptionFilter` với decorator `@Catch()`.
- Xử lý phân loại ngoại lệ:
  - `HttpException` (NestJS built-in): Trích xuất `statusCode`, `message`, `error`.
  - `TypeORM` Errors (`QueryFailedError`, `EntityNotFoundError`...): Map sang HTTP Status tương ứng (`409 Conflict`, `404 Not Found`, `400 Bad Request`).
  - Unhandled / System `Error`: Trả về `500 Internal Server Error` với thông báo chung (ở production ẩn internal error details).
- Ghi log máy chủ qua NestJS `Logger` (Method, Path, StatusCode, Stack trace, Error message).

#### [MODIFY] [app.module.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/app.module.ts)

- Đăng ký `GlobalExceptionsFilter` thông qua NestJS `APP_FILTER` provider để hỗ trợ Dependency Injection.

---

### 3. Agent System Knowledge & Documentation

#### [NEW] [.agents/knowledge/global/backend-exception-filter.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/backend-exception-filter.md)

- Tài liệu canonical kiến trúc bằng tiếng Anh cho AI Agent.

#### [NEW] [.agents/docs/global/backend-exception-filter.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/backend-exception-filter.md)

- Hướng dẫn vận hành và quy chuẩn xử lý lỗi bằng tiếng Việt cho Developer.

#### [MODIFY] [.agents/docs/README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/README.md)

- Cập nhật mục lục tài liệu.

---

## Verification Plan

### Automated Tests & Quality Gates

- Chạy kiểm tra kiểu: `npm run typecheck`
- Chạy kiểm tra lint: `npm run lint:check`
- Chạy kiểm tra Agent System: `npm run agent-system:validate`
- Viết unit test cho `GlobalExceptionsFilter` (`apps/api/src/common/filters/global-exceptions.filter.spec.ts`) kiểm tra các case:
  - Bắt `HttpException` (404, 400).
  - Bắt TypeORM `QueryFailedError` (sqlite unique constraint violation -> 409/400).
  - Bắt generic `Error` (500) và kiểm tra output ẩn stack ở production.
