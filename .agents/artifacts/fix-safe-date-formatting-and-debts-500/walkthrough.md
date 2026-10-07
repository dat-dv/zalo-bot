# Walkthrough: Khắc Phục Lỗi 500 Tại API Debts & Chuẩn Hóa Date Parsing

Đã khắc phục triệt để nguy cơ và nguyên nhân lỗi `500 Internal Server Error` tại `GET /api/debts` và toàn bộ các endpoint Dashboard.

## Thay Đổi Đã Thực Hiện

### 1. Backend Controllers (`apps/api`)

- [MODIFY] [reports.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/reports/reports.controller.ts):
  - Định nghĩa hàm helper `toIsoDate` và `toOptionalIsoDate` xử lý an toàn cho mọi kiểu dữ liệu `Date`, `string`, `number`, `null`, `undefined`.
  - Áp dụng trên toàn bộ các endpoint: `/api/debts`, `/api/dashboard`, `/api/contacts`, `/api/expenses`.
- [MODIFY] [finance.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.controller.ts):
  - Chuyển đổi toàn bộ các lời gọi `.toISOString()` ở `categories`, `combineContacts`, `places` sang `toIsoDate` / `toOptionalIsoDate`.

### 2. Database Migration (`apps/api/src/database/migrations`)

- [MODIFY] [1724650000000-InitSchema.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/migrations/1724650000000-InitSchema.ts):
  - Bổ sung câu lệnh cập nhật an toàn:
    - `UPDATE "debts" SET "created_at" = now() WHERE "created_at" IS NULL`
    - `UPDATE "debts" SET "occurred_at" = "created_at" WHERE "occurred_at" IS NULL`
    - `UPDATE "finance_transactions" SET "created_at" = now() WHERE "created_at" IS NULL`

---

## Kết Quả Kiểm Tra & Xác Minh

- `npm run typecheck`: ✅ Thành công 100% không lỗi.
- `npm run lint`: ✅ Thành công (0 errors).
- `npm test --workspace @zalobot/api`: ✅ 54/54 tests passed.
- `npm run build:api`: ✅ NestJS API build hoàn tất.
