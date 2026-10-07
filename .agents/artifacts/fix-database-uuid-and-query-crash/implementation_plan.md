# Kế hoạch khắc phục lỗi Database Query Failed (Dashboard & Analytics)

Tài liệu thiết kế và kế hoạch chi tiết khắc phục lỗi `400 - Database query failed` trên các API `/api/dashboard` và `/api/finance/analytics` do xung đột kiểu dữ liệu (`UUID` vs `character varying`) giữa các bảng PostgreSQL và refactor `FinanceService` sang TypeORM Repository methods.

## Bối cảnh & Nguyên nhân gốc rễ

1. **Xung đột kiểu dữ liệu giữa các bảng PostgreSQL:**
   - Trong migration gần nhất `FixPostgresUuidTypes1724690000000`, cột ngoại khóa `finance_transactions.place_id` và `finance_transactions.contact_id` được chuyển đổi sang kiểu `UUID`.
   - Tuy nhiên, các bảng cha `finance_places.id`, `debt_contacts.id`, và `finance_transactions.id` được tạo ban đầu dưới dạng `character varying` (varchar) và chưa được chuyển đổi sang `UUID`.
   - Khi TypeORM thực hiện `LEFT JOIN finance_places ON finance_places.id = finance_transactions.place_id`, PostgreSQL ném lỗi:
     ```text
     QueryFailedError: operator does not exist: character varying = uuid
     ```
2. **Sử dụng raw string trong QueryBuilder:**
   - Các hàm `FinanceService.getSummary()`, `getAnalyticsReport()`, và `listTransactions()` vẫn sử dụng `createQueryBuilder` với các chuỗi tên cột cơ sở dữ liệu (`transaction.user_id`, `transaction.occurred_at`) thay vì phương thức an toàn kiểu `Repository.find()`.
3. **Filter che giấu lỗi thực tế:**
   - `GlobalExceptionsFilter` bắt `QueryFailedError`, chuyển thành HTTP 400 Bad Request và chỉ log cảnh báo chung chung `Database query failed`, làm ẩn hoàn toàn thông điệp lỗi SQL thực sự từ PostgreSQL.

---

## User Review Required

> [!IMPORTANT]
>
> - Cần chạy migration mới để đồng bộ toàn bộ kiểu dữ liệu `id` của `finance_places`, `debt_contacts`, `finance_transactions` sang `UUID` trên PostgreSQL database.
> - Refactor toàn bộ truy vấn trong `FinanceService` sang `find()` methods để loại bỏ hoàn toàn các chuỗi raw column name trong `createQueryBuilder`.

---

## Proposed Changes

### 1. Database Migrations

#### [NEW] [1724700000000-FixPostgresPlaceAndContactUuidTypes.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/migrations/1724700000000-FixPostgresPlaceAndContactUuidTypes.ts)

- Bổ sung migration chuyển đổi toàn bộ các cột ID và Foreign Key còn lại sang kiểu `UUID` trong PostgreSQL một cách an toàn và nhất quán:
  - `finance_places.id` -> `uuid`
  - `debt_contacts.id` -> `uuid`
  - `finance_transactions.id` -> `uuid`
  - `debts.id` -> `uuid`
  - `debt_payments.id` -> `uuid`
  - Đồng bộ `place_id`, `contact_id`, `parent_debt_id`, `finance_transaction_id`, `debt_id` sang kiểu `uuid`.

#### [MODIFY] [data-source.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/data-source.ts)

- Đăng ký migration mới `FixPostgresPlaceAndContactUuidTypes1724700000000` vào mảng `migrations` của DataSource.

---

### 2. Backend Finance Service Refactoring

#### [MODIFY] [finance.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.ts)

- Thay thế `createQueryBuilder` bằng `transactionRepo.find()` với các toán tử TypeORM chuẩn (`Between`, `MoreThanOrEqual`, `LessThanOrEqual`, `LessThan`) cho:
  - `getSummary(userId, startAt, endAt)`: Truy vấn danh sách giao dịch kèm quan hệ `place` với `FindOptionsWhere`.
  - `getAnalyticsReport(userId, startAt, endAt, grain)`: Lấy `priorTransactions` trước mốc `startAt` dùng `LessThan(startDate)`.
  - `listTransactions(userId, type)`: Truy vấn danh sách giao dịch kèm các quan hệ `place`, `contact`, `allocations.debt` qua `find()`.

---

### 3. Global Exceptions Filter Logging Enhancement

#### [MODIFY] [global-exceptions.filter.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/common/filters/global-exceptions.filter.ts)

- Cập nhật xử lý `QueryFailedError`:
  - Trả về status 500 (Internal Server Error) nếu không phải lỗi duplicate/constraint key.
  - Ghi log chi tiết `this.logger.error(\`Database query failed: ${exception.message}\`, exception.stack)` để luôn hiển thị chi tiết câu SQL lỗi trong hệ thống logging.

---

### 4. Unit Test Updates

#### [MODIFY] [finance.service.spec.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.spec.ts)

- Cập nhật mock `transactionRepository.find` để hỗ trợ các bài test `getAnalyticsReport`, `createTransaction`, và `getSummary`.

---

## Verification Plan

### Automated Tests

- Chạy toàn bộ test suite:
  ```bash
  npm run test --workspace @zalobot/api
  ```
- Kiểm tra typecheck và linter:
  ```bash
  npm run typecheck
  npm run lint
  ```
- Chạy validator hệ thống:
  ```bash
  npm run agent-system:validate
  ```

### Manual Verification

- Kiểm tra trực tiếp các API `/api/dashboard`, `/api/finance/analytics`, `/api/transactions` đảm bảo HTTP 200 OK với đầy đủ dữ liệu.
