# Kế Hoạch Khắc Phục Lỗi 500 Tại API Debts & Dashboard

Khắc phục triệt để lỗi `500 Internal Server Error` tại `GET /api/debts` do việc gọi trực tiếp hàm `.toISOString()` trên các trường ngày tháng có giá trị `null`, `undefined` hoặc `string` từ cơ sở dữ liệu.

## User Review Required

> [!IMPORTANT]
>
> - **Phạm vi bảo vệ**: Toàn bộ các endpoint trong `ReportsController` (`/api/debts`, `/api/dashboard`, `/api/contacts`, `/api/expenses`) và `FinanceController` sẽ được chuyển sang dùng hàm helper `toIsoDate` / `toOptionalIsoDate` an toàn tuyệt đối.
> - **Cập nhật dữ liệu cũ**: Migration `InitSchema` sẽ bổ sung câu lệnh cập nhật an toàn cho các bản ghi cũ đang có `created_at IS NULL` về thời gian hiện tại để tránh lỗi truy vấn.

## Proposed Changes

---

### Backend Reports & Finance Controllers (`apps/api`)

#### [MODIFY] [reports.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/reports/reports.controller.ts)

- Bổ sung 2 helper functions:
  - `toIsoDate(value: unknown, fallback?: string): string`
  - `toOptionalIsoDate(value: unknown): string | undefined`
- Thay thế toàn bộ các lời gọi `.toISOString()` trực tiếp trên các đối tượng `debt`, `transaction`, `contact`, `activity`, `reminder`, `expense` sang `toIsoDate` / `toOptionalIsoDate`.

#### [MODIFY] [finance.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.controller.ts)

- Thay thế các lời gọi `.toISOString()` trên `category`, `place`, `contact` sang `toIsoDate` / `toOptionalIsoDate`.

---

### Database Migration (`apps/api/src/database/migrations`)

#### [MODIFY] [1724650000000-InitSchema.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/migrations/1724650000000-InitSchema.ts)

- Bổ sung lệnh chuẩn hóa dữ liệu cũ nếu có dòng bị NULL:
  ```sql
  UPDATE "debts" SET "created_at" = now() WHERE "created_at" IS NULL;
  UPDATE "debts" SET "occurred_at" = "created_at" WHERE "occurred_at" IS NULL;
  UPDATE "finance_transactions" SET "created_at" = now() WHERE "created_at" IS NULL;
  ```

---

## Verification Plan

### Automated Tests

- Chạy kiểm tra kiểu: `npm run typecheck`
- Chạy linter: `npm run lint`
- Chạy toàn bộ test suites: `npm test --workspace @zalobot/api`
- Build backend: `npm run build:api`
