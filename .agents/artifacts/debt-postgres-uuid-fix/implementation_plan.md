# Kế Hoạch Sửa Lỗi PostgreSQL UUID & Khởi Động Backend Trơn Tru (Phương Án 1)

## 1. Bối Cảnh & Mục Tiêu

Trên cơ sở dữ liệu PostgreSQL thực tế:

- Các bảng hiện có (`debts`, `debt_payments`, `finance_transactions`, `debt_contacts`) sử dụng khóa chính kiểu **`uuid`**.
- Migration `1724690000000-FixPostgresUuidTypes` trước đó bị lỗi do cố gắng `ALTER COLUMN "id" TYPE uuid` trên bảng `debt_payment_allocations` khi cột này đang mang giá trị `DEFAULT gen_random_uuid()::text`.
- Mục tiêu: Áp dụng Phương án 1 được người dùng phê duyệt để `DROP` và tạo mới bảng `debt_payment_allocations` với chuẩn `uuid` nguyên bản, đồng thời chuyển đổi an toàn các cột liên kết `parent_debt_id` và `finance_transaction_id` sang kiểu `uuid`.

## 2. User Review Required

> [!IMPORTANT]
>
> - Bảng `debt_payment_allocations` là bảng mới tạo cho tính năng phân bổ (chưa có dữ liệu production cũ), việc drop và tạo lại sẽ làm sạch 100% schema mà không ảnh hưởng bất kỳ dữ liệu cũ nào của hệ thống.
> - Các bảng chứa dữ liệu thật (`debts`, `debt_payments`, `finance_transactions`) sẽ chỉ chuyển đổi kiểu dữ liệu cột liên quan (`parent_debt_id`, `finance_transaction_id`) mà không làm mất bất kỳ dòng dữ liệu nào.

## 3. Các Thay Đổi Dự Kiến

### Component: Database Migrations (`apps/api`)

#### [MODIFY] [1724690000000-FixPostgresUuidTypes.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/migrations/1724690000000-FixPostgresUuidTypes.ts)

- Cập nhật logic `up()` trong migration:
  1. Kiểm tra nếu `debts.id` là `uuid`:
     - Chuyển `debts.parent_debt_id` sang `uuid` (`USING (CASE WHEN parent_debt_id IS NULL OR parent_debt_id = '' THEN NULL ELSE parent_debt_id::uuid END)`).
     - Chuyển `debt_payments.finance_transaction_id` sang `uuid` (`USING (CASE WHEN finance_transaction_id IS NULL OR finance_transaction_id = '' THEN NULL ELSE finance_transaction_id::uuid END)`).
     - Thực hiện `DROP TABLE IF EXISTS "debt_payment_allocations" CASCADE;`.
     - Tạo lại bảng `debt_payment_allocations` chuẩn `uuid`:
       ```sql
       CREATE TABLE "debt_payment_allocations" (
         "id" uuid NOT NULL DEFAULT gen_random_uuid(),
         "user_id" character varying NOT NULL,
         "finance_transaction_id" uuid NOT NULL,
         "debt_id" uuid NOT NULL,
         "amount" integer NOT NULL,
         "allocated_at" TIMESTAMP NOT NULL,
         "note" character varying,
         "created_at" TIMESTAMP NOT NULL DEFAULT now(),
         CONSTRAINT "PK_debt_payment_allocations_id" PRIMARY KEY ("id")
       );
       ```
     - Tạo lại các index `IDX_debt_payment_allocations_*`.
  2. Nếu môi trường khác dùng `character varying`: Giữ nguyên schema tương thích `character varying`.

## 4. Kế Hoạch Kiểm Thử (Verification Plan)

### Automated Tests

- Chạy toàn bộ test suite backend:
  ```bash
  npm run test --workspace=@zalobot/api
  ```
- Kiểm tra toàn bộ kiểu dữ liệu TypeScript và lint:
  ```bash
  npm run typecheck && npm run lint
  ```
- Biên dịch ứng dụng backend:
  ```bash
  npm run build:api
  ```
- Chạy pre-commit validator:
  ```bash
  npm run agent-system:validate
  ```

### Manual Verification

- Deploy backend lên môi trường production/staging và kiểm tra NestJS khởi động thành công, migration chạy trơn tru với 0 lỗi kết nối TypeORM.
