# Kế Hoạch Sửa Lỗi Dependency Injection UserCategoryEntity Trong FinanceModule

Khắc phục lỗi khởi động NestJS: `Nest can't resolve dependencies of the FinanceService (FinanceTransactionEntityRepository, DebtEntityRepository, DebtContactEntityRepository, DebtPaymentEntityRepository, ?). Please make sure that the argument "UserCategoryEntityRepository" at index [4] is available in the FinanceModule context.`

## Nguyên nhân gốc rễ (Root Cause)

- Trong `apps/api/src/finance/finance.service.ts`, `FinanceService` inject `@InjectRepository(UserCategoryEntity)` ở vị trí tham số thứ 5 của constructor (`index [4]`).
- Tuy nhiên, trong `apps/api/src/finance/finance.module.ts`, `TypeOrmModule.forFeature([...])` chỉ mới đăng ký 4 entity:
  - `FinanceTransactionEntity`
  - `DebtEntity`
  - `DebtContactEntity`
  - `DebtPaymentEntity`
- Do thiếu `UserCategoryEntity` trong `TypeOrmModule.forFeature` của `FinanceModule`, NestJS không thể tìm thấy provider `UserCategoryEntityRepository` khi khởi tạo instance của `FinanceService`.

---

## Thay đổi dự kiến (Proposed Changes)

### Backend API Module

#### [MODIFY] [finance.module.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.module.ts)

- Import `UserCategoryEntity` từ `../database/entities/user-category.entity`.
- Thêm `UserCategoryEntity` vào danh sách entity của `TypeOrmModule.forFeature([...])`.

---

## Kế hoạch kiểm thử & xác minh (Verification Plan)

### Automated Checks

- Chạy `npm run typecheck --workspace @zalobot/api` để xác minh tính toàn vẹn kiểu dữ liệu và module references.
- Chạy `npm run build:api` để đảm bảo ứng dụng backend build thành công mà không có lỗi TypeScript / NestJS metadata.
- Chạy `npm run agent-system:validate` để đảm bảo toàn bộ hệ thống tài liệu và rules hợp lệ.
