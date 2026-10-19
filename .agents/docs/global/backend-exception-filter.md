---
metadata:
  agent-artifact:
    id: docs-global-backend-exception-filter
    type: documentation
    depends_on:
      - .agents/knowledge/global/backend-exception-filter.md
      - apps/api/src/common/common.module.ts
      - apps/api/src/common/filters/global-exceptions.filter.ts
---

# Global Exception Filter Backend

Tài liệu canonical tương ứng: [`backend-exception-filter.md`](../../knowledge/global/backend-exception-filter.md).

## 1. Mục Đích & Kiến Trúc

- Mọi ngoại lệ trong lúc xử lý HTTP request tại `apps/api` được bắt bởi `GlobalExceptionsFilter`, đăng ký qua `APP_FILTER` trong `CommonModule` (`apps/api/src/common/common.module.ts`). `AppModule` import `CommonModule`, nên filter áp dụng cho toàn bộ controller.
- Cùng module này còn đăng ký pipe validation toàn cục, các interceptor timeout/logging/transform và middleware gắn request id + log HTTP.
- Lý do: web dashboard chỉ cần xử lý **một** dạng lỗi duy nhất, đồng thời không bao giờ lộ chi tiết SQL hay stack trace ra trình duyệt.
- Format lỗi luôn theo `IApiErrorResponse` từ `@zalobot/contracts`:
  ```json
  {
    "statusCode": 400,
    "message": "Nội dung lỗi hoặc mảng lỗi validation",
    "error": "Bad Request",
    "timestamp": "2026-10-19T09:00:00.000Z",
    "path": "/api/transactions",
    "requestId": "..."
  }
  ```
  `requestId` do `RequestIdMiddleware` gán: dùng lại `x-request-id`/`x-correlation-id` client gửi lên, nếu không có thì sinh UUID mới. Giá trị này cũng được trả ở header `x-request-id` để đối chiếu log khi người dùng báo lỗi.

## 2. Quy Tắc Xử Lý Lỗi

1. **HttpException chuẩn của NestJS**: giữ nguyên status code và thông điệp (kể cả mảng lỗi validation từ DTO).
2. **Lỗi TypeORM / PostgreSQL**:
   - `EntityNotFoundError` → `404 Not Found` (`Resource not found`).
   - `QueryFailedError` do trùng khóa/unique (`23505`) → `409 Conflict` (`Database constraint violation`).
   - `QueryFailedError` khác → `500` (`Database query failed`); chi tiết SQL chỉ nằm trong log server.
3. **Lỗi từ dịch vụ bên ngoài** (axios, Google API… có `response.status`):
   - Upstream trả `4xx` → giữ nguyên status và thông điệp của upstream (ví dụ token Google hết hạn trả `401`) để web hiển thị đúng nguyên nhân.
   - Upstream lỗi `5xx` hoặc không rõ → `502 Bad Gateway` với thông điệp "Dịch vụ liên kết tạm thời không khả dụng."
4. **Lỗi không xác định**: `500 Internal Server Error`. Ở `production` thông điệp bị thay bằng `Internal server error`; ở môi trường dev giữ thông điệp gốc để debug.
5. **Ngữ cảnh không phải HTTP** (cron, scheduler): chỉ ghi log, không ghi response.

## 3. Ghi log

- Lỗi `>= 500` ghi mức `error` kèm stack trace; lỗi `< 500` ghi mức `warn`.
- Mỗi dòng log có method, path, status, thông điệp và request id (nếu có) để truy vết.
