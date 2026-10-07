---
metadata:
  agent-artifact:
    id: docs-global-backend-exception-filter
    type: documentation
    depends_on:
      - .agents/knowledge/global/backend-exception-filter.md
---

# Global Exception Filter Backend

Tài liệu canonical tương ứng: [`backend-exception-filter.md`](../../knowledge/global/backend-exception-filter.md).

## 1. Mục Đích & Kiến Trúc

- Toàn bộ ngoại lệ phát sinh trong quá trình xử lý HTTP request tại Backend (`apps/api`) được bắt và chuẩn hóa bởi `GlobalExceptionsFilter` (đăng ký qua `APP_FILTER` trong `AppModule`).
- Format lỗi trả về luôn tuân thủ interface `IApiErrorResponse` từ `@zalobot/contracts`:
  ```json
  {
    "statusCode": 400,
    "message": "Nội dung lỗi hoặc mảng lỗi validation",
    "error": "Bad Request",
    "timestamp": "2026-08-23T16:48:00.000Z",
    "path": "/api/transactions"
  }
  ```

## 2. Quy Tắc Xử Lý Lỗi

1. **HttpException chuẩn**: Giữ nguyên status code và thông điệp lỗi (hỗ trợ cả mảng lỗi validation từ DTO).
2. **Lỗi TypeORM / PostgreSQL**:
   - `EntityNotFoundError`: Map tự động về `404 Not Found` (`Resource not found`).
   - `QueryFailedError` (lỗi constraint / unique key): Map về `409 Conflict` (`Database constraint violation`) hoặc `400 Bad Request`.
3. **Lỗi không xác định (Unhandled Error)**:
   - Trả về `500 Internal Server Error`.
   - Ở môi trường `production`, ẩn hoàn toàn stack trace và thông tin nội bộ của hệ thống.
4. **Non-HTTP Context (zalo Bot / Cron)**:
   - Ghi log lỗi vào Logger hệ thống, không can thiệp vào response HTTP.
