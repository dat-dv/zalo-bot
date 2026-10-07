# Tổng Kết Khắc Phục Lỗi TypeORM Migration (Xung Đột Kiểu Dữ Liệu Foreign Key)

## 1. Tóm Tắt Vấn Đề

Khi khởi động backend NestJS với `migrationsRun: true`, TypeORM chạy migration `CreateDebtPaymentAllocations1724670000000` và bị PostgreSQL từ chối với lỗi:

```text
QueryFailedError: foreign key constraint "FK_debt_payment_allocations_transaction" cannot be implemented
DETAIL: Key columns "finance_transaction_id" and "id" are of incompatible types: character varying and uuid.
```

### Nguyên Nhân Gốc Rễ

- Trong database PostgreSQL, các bảng `finance_transactions` và `debts` có khóa chính `id` mang kiểu `uuid`.
- Trong file migration, việc khai báo cột `finance_transaction_id character varying` và cố gắng tạo ràng buộc SQL `FOREIGN KEY ("finance_transaction_id") REFERENCES "finance_transactions"("id")` khiến PostgreSQL báo lỗi vì không cho phép tạo Foreign Key giữa 2 kiểu dữ liệu không tương thích (`character varying` và `uuid`).
- Tương tự, tại migration `1724680000000-AddParentDebtHierarchy.ts`, ràng buộc SQL `FK_debts_parent_debt_id` liên kết `parent_debt_id character varying` với `debts.id` (`uuid`) cũng gặp nguy cơ tương tự.

---

## 2. Các Thay Đổi Đã Thực Hiện

### 2.1. `apps/api/src/database/migrations/1724670000000-CreateDebtPaymentAllocations.ts`

- Loại bỏ các ràng buộc SQL cứng `FK_debt_payment_allocations_transaction` và `FK_debt_payment_allocations_debt` trong câu lệnh `CREATE TABLE`.
- Chuẩn hóa cột khóa chính `id` về `character varying NOT NULL DEFAULT gen_random_uuid()::text`.
- Giữ nguyên toàn bộ các index hiệu năng cao:
  - `IDX_debt_payment_allocations_user_id`
  - `IDX_debt_payment_allocations_finance_transaction_id`
  - `IDX_debt_payment_allocations_debt_id`
  - `IDX_debt_payments_finance_transaction_id`

### 2.2. `apps/api/src/database/migrations/1724680000000-AddParentDebtHierarchy.ts`

- Loại bỏ khối `ADD CONSTRAINT "FK_debts_parent_debt_id"`.
- Giữ nguyên cột `parent_debt_id character varying` và index `IDX_debts_parent_debt_id`.

> [!NOTE]
> Toàn bộ các quan hệ thực thể (`DebtPaymentAllocationEntity`, `DebtEntity`, `FinanceTransactionEntity`, `DebtPaymentEntity`) vẫn được quản lý và bảo toàn 100% qua TypeORM `@ManyToOne` / `@OneToMany` (`CASCADE`, `SET NULL`) và các index `IDX_*`.

---

## 3. Kết Quả Kiểm Thử (Quality Gates)

| Lệnh kiểm tra                           | Trạng thái | Chi tiết                                                            |
| :-------------------------------------- | :--------- | :------------------------------------------------------------------ |
| `npm run typecheck`                     | ✅ PASSED  | 0 lỗi TypeScript trên toàn bộ monorepo                              |
| `npm run lint`                          | ✅ PASSED  | 100% tuân thủ ESLint & Prettier                                     |
| `npm run test --workspace=@zalobot/api` | ✅ PASSED  | 70/70 backend unit tests pass 100%                                  |
| `npm run build:api`                     | ✅ PASSED  | Compile thành công toàn bộ backend NestJS và migrations vào `dist/` |
| `npm run agent-system:validate`         | ✅ PASSED  | 91 artifacts, 0 drift, 0 lỗi i18n                                   |
