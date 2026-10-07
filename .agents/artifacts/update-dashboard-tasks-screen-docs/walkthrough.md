# Walkthrough - Khắc phục Lỗi Pre-commit Hook & System Validation

Đã khắc phục hoàn toàn lỗi `pre-commit` script (`husky - pre-commit script failed`) bằng cách cập nhật tri thức canonical (`.agents/knowledge/modules/`) và tài liệu hướng dẫn nhà phát triển (`.agents/docs/modules/`) cho các module bị thay đổi mã nguồn.

## Các thay đổi đã thực hiện

### 1. Canonical Knowledge & Developer Docs Updates

- **Module `dashboard`**:
  - [EN] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md): Bổ sung tài liệu tính năng của `TasksScreen` (bộ lọc trạng thái `all`/`needsAction`/`completed`, các cột dữ liệu `notes`/`updatedAt`/`actions`, thao tác `inline row editing` trên ô nhập liệu và thông báo toast).
  - [VI] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md): Cập nhật mô tả UI màn hình Công việc trong module Dashboard.

- **Module `calendar`**:
  - [EN] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/calendar/README.md): Tạo mới tài liệu canonical cho module `calendar`.
  - [VI] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/calendar/README.md): Tạo mới tài liệu nhà phát triển cho module `calendar`.

- **Module `reminders`**:
  - [EN] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/reminders/README.md): Tạo mới tài liệu canonical cho module `reminders`.
  - [VI] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/reminders/README.md): Tạo mới tài liệu nhà phát triển cho module `reminders`.

- **Module `debts` & `expenses`**:
  - [EN] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/debts/README.md) & [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/expenses/README.md): Cập nhật các API mutation và endpoint mới (`updateDebt`, `createDebtPayment`, `updateExpense`, `deleteExpense`).
  - [VI] [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/debts/README.md) & [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/expenses/README.md): Cập nhật tương ứng trong tài liệu Tiếng Việt.

- **Index Modules README**:
  - [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/README.md) & [README.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/README.md): Bổ sung `calendar` và `reminders` vào danh mục module.

## Kết quả kiểm thử

- **System Validation Check**:
  `npm run agent-system:validate -- --check-changes --check-i18n` -> **Passed** (85 artifacts, 149 dependencies, 0 errors).
- **TypeScript Typecheck**:
  `npm run typecheck` -> **Passed** (0 errors).
