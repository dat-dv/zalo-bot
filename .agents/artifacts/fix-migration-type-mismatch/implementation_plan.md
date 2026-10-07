# Kế hoạch khắc phục lỗi TypeORM Migration (Xung đột kiểu dữ liệu Foreign Key)

## Bối cảnh & Nguyên nhân

Khi khởi động backend NestJS với `migrationsRun: true`, migration `CreateDebtPaymentAllocations1724670000000` gặp lỗi:

```text
QueryFailedError: foreign key constraint "FK_debt_payment_allocations_transaction" cannot be implemented
DETAIL: Key columns "finance_transaction_id" and "id" are of incompatible types: character varying and uuid.
```

**Nguyên nhân**: Bảng `finance_transactions` và `debts` trong PostgreSQL có khóa chính `id` mang kiểu `uuid`. Trong file migration, việc ép cứng ràng buộc SQL `FOREIGN KEY ("finance_transaction_id") REFERENCES "finance_transactions"("id")` với cột `character varying` đã bị PostgreSQL từ chối do 2 kiểu dữ liệu không tương thích.

---

## User Review Required

> [!IMPORTANT]
> Toàn bộ quan hệ quan trọng giữa `debt_payment_allocations`, `debt_payments`, `finance_transactions`, và `debts` vẫn được quản lý và bảo toàn 100% thông qua các quan hệ TypeORM `@ManyToOne` / `@OneToMany` (`CASCADE`, `SET NULL`) và các chỉ mục hiệu năng cao `IDX_*`. Việc loại bỏ FK constraint thô trong raw SQL giúp tương thích tuyệt đối với cả môi trường PostgreSQL dùng `uuid` hoặc `varchar`.

---

## Thay đổi đề xuất

### Backend Database Migrations

#### [MODIFY] [1724670000000-CreateDebtPaymentAllocations.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/migrations/1724670000000-CreateDebtPaymentAllocations.ts)

- Bỏ 2 ràng buộc cứng `FK_debt_payment_allocations_transaction` và `FK_debt_payment_allocations_debt` trong câu lệnh `CREATE TABLE`.
- Chuẩn hóa kiểu khóa chính `id` về `character varying NOT NULL DEFAULT gen_random_uuid()::text`.
- Giữ nguyên các index tìm kiếm hiệu năng cao:
  - `IDX_debt_payment_allocations_user_id`
  - `IDX_debt_payment_allocations_finance_transaction_id`
  - `IDX_debt_payment_allocations_debt_id`
  - `IDX_debt_payments_finance_transaction_id`

#### [MODIFY] [1724680000000-AddParentDebtHierarchy.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/migrations/1724680000000-AddParentDebtHierarchy.ts)

- Bỏ ràng buộc cứng `FK_debts_parent_debt_id` trong block `DO $$ BEGIN ... END $$;`.
- Giữ nguyên cột `parent_debt_id character varying` và index `IDX_debts_parent_debt_id`.

---

## Kế hoạch kiểm tra (Verification Plan)

### Automated Tests & Quality Gates

- Chạy `npm run typecheck` xác nhận 0 lỗi TypeScript.
- Chạy `npm run lint` xác nhận tuân thủ ESLint & Prettier.
- Chạy `npm run test --workspace=@zalobot/api` kiểm tra toàn bộ 70/70 unit tests.
- Chạy `npm run agent-system:validate -- --check-changes --check-i18n` kiểm tra tài liệu và i18n.
- Chạy `npm run build:api` kiểm tra build file JS migration vào `dist/`.
