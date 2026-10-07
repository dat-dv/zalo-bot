# Kế hoạch triển khai Trang Cài đặt chung (Settings) & Quản lý Danh mục (Categories)

## Tổng quan & Bối cảnh

Người dùng mong muốn có một trang **Cài đặt chung (`/settings`)** trên Web Dashboard để chủ động cấu hình hệ thống, trọng tâm là phân hệ **Quản lý Danh mục Thu & Chi (Category Management)**:

- Cho phép người dùng xem danh sách, thêm danh mục mới, chỉnh sửa tên danh mục, và xóa danh mục tùy ý.
- Đồng bộ danh mục người dùng cấu hình vào cơ sở dữ liệu SQLite và tích hợp tự động vào menu gợi ý (autocomplete) của toàn bộ các bảng Thu chi (`Transactions`), Chi tiêu (`Expenses`), và Khoản thu (`Income`).
- Định hình sẵn nền tảng cho trang Cài đặt để dễ dàng mở rộng thêm các tab cấu hình tiếp theo (Ngân sách & Tài chính, Tùy chọn thông báo, Liên kết tài khoản).

---

## User Review Required

> [!IMPORTANT]
> **Quy tắc khởi tạo danh mục ban đầu (Seeding Defaults)**:
>
> - Khi người dùng mới truy cập hoặc chưa từng cấu hình danh mục riêng trong DB, hệ thống sẽ tự động nạp (seed) danh sách danh mục chuẩn mặc định (`DEFAULT_INCOME_CATEGORIES` và `DEFAULT_EXPENSE_CATEGORIES`) để người dùng có sẵn dữ liệu và có thể chỉnh sửa/xóa/thêm mới ngay lập tức.
> - Bảng `user_categories` sẽ lưu trữ độc lập theo từng `userId`.

---

## Thay đổi đề xuất (Proposed Changes)

### 1. Packages / Shared Contracts (`packages/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung `APP_ROUTES.settings = '/settings'`.
- Bổ sung `API_ROUTES.categories = '/api/categories'`.
- Thêm interfaces:
  ```typescript
  export interface ICategoryItem {
    id: string;
    type: 'income' | 'expense';
    name: string;
    color?: string;
    icon?: string;
    isDefault?: boolean;
    createdAt: string;
    updatedAt?: string;
  }
  export interface ICreateCategoryRequest {
    type: 'income' | 'expense';
    name: string;
    color?: string;
    icon?: string;
  }
  export interface IUpdateCategoryRequest {
    name?: string;
    color?: string;
    icon?: string;
  }
  ```
- Bổ sung translation keys đa ngôn ngữ (`vi` và `en`):
  - `nav.settings`: `'Cài đặt'` / `'Settings'`
  - `nav.section.system`: `'Hệ thống'` / `'System'`
  - `settings.title`: `'Cài đặt chung'` / `'General Settings'`
  - `settings.subtitle`: `'Quản lý danh mục thu chi và cấu hình hệ thống'` / `'Manage categories and system configuration'`
  - `settings.tabs.categories`: `'Danh mục Thu & Chi'` / `'Categories'`
  - `settings.tabs.preferences`: `'Tùy chọn hệ thống'` / `'Preferences'`
  - `settings.categories.expenseTitle`: `'Danh mục Chi tiêu'` / `'Expense Categories'`
  - `settings.categories.incomeTitle`: `'Danh mục Thu nhập'` / `'Income Categories'`
  - `settings.categories.addExpense`: `'+ Thêm danh mục chi'` / `'+ Add Expense Category'`
  - `settings.categories.addIncome`: `'+ Thêm danh mục thu'` / `'+ Add Income Category'`
  - `settings.categories.namePlaceholder`: `'Nhập tên danh mục...'` / `'Enter category name...'`
  - `settings.categories.name`: `'Tên danh mục'` / `'Category Name'`
  - `settings.categories.type`: `'Loại'` / `'Type'`
  - `settings.categories.count`: `'{count} danh mục'` / `'{count} categories'`
  - `settings.categories.empty`: `'Chưa có danh mục nào'` / `'No categories yet'`
  - `settings.categories.deleteConfirm`: `'Bạn có chắc chắn muốn xóa danh mục "{name}" không?'` / `'Are you sure you want to delete category "{name}"?'`
  - `settings.categories.created`: `'Đã tạo danh mục thành công'` / `'Category created successfully'`
  - `settings.categories.updated`: `'Đã cập nhật danh mục thành công'` / `'Category updated successfully'`
  - `settings.categories.deleted`: `'Đã xóa danh mục thành công'` / `'Category deleted successfully'`

---

### 2. Backend Module (`apps/api`)

#### [NEW] [user-category.entity.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/entities/user-category.entity.ts)

- Định nghĩa TypeORM Entity `UserCategoryEntity` (`user_categories` table) gồm: `id` (uuid), `userId`, `type` (`income` | `expense`), `name`, `color`, `icon`, `isDefault`, `createdAt`, `updatedAt`.

#### [MODIFY] [database.module.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/database/database.module.ts)

- Đăng ký `UserCategoryEntity` trong `TypeOrmModule.forRootAsync` và `TypeOrmModule.forFeature`.

#### [MODIFY] [finance.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.service.ts)

- Inject `UserCategoryEntity` repository.
- Bổ sung các phương thức:
  - `listCategories(userId: number, type?: 'income' | 'expense')`: Lấy danh mục của user. Nếu user chưa có danh mục nào, tự động seed danh mục mặc định từ `DEFAULT_INCOME_CATEGORIES` và `DEFAULT_EXPENSE_CATEGORIES` rồi trả về.
  - `createCategory(userId: number, dto: ICreateCategoryRequest)`: Tạo mới danh mục, kiểm tra trùng lặp tên.
  - `updateCategory(userId: number, id: string, dto: IUpdateCategoryRequest)`: Cập nhật tên / màu sắc / icon.
  - `deleteCategory(userId: number, id: string)`: Xóa danh mục của user.

#### [MODIFY] [finance.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/finance/finance.controller.ts)

- Bổ sung các endpoints RESTful có bảo vệ Bearer JWT:
  - `GET /api/categories`: Lấy danh sách danh mục (hỗ trợ lọc `?type=income|expense`).
  - `POST /api/categories`: Tạo danh mục mới.
  - `PATCH /api/categories/:id`: Cập nhật danh mục.
  - `DELETE /api/categories/:id`: Xóa danh mục.

---

### 3. Frontend Module (`apps/web`)

#### [NEW] [categories-query.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/settings/api/categories-query.ts)

- Định nghĩa React Query hooks:
  - `useCategoriesQuery(type?: 'income' | 'expense')`
  - `useCreateCategoryMutation()`
  - `useUpdateCategoryMutation()`
  - `useDeleteCategoryMutation()`

#### [NEW] [settings-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/settings/view/settings-screen.tsx)

- Xây dựng giao diện trang Cài đặt chuẩn Enterprise:
  - Header với tiêu đề `Cài đặt chung` & mô tả.
  - Bố cục 2 Panel song song / Tab linh hoạt:
    - **Panel Danh mục Chi tiêu**: Bảng quản lý danh mục chi với nút `+ Thêm`, sửa inline tên danh mục, xóa danh mục có xác nhận, hiển thị số lượng.
    - **Panel Danh mục Thu nhập**: Bảng quản lý danh mục thu với tính năng tương tự.
  - Form thêm nhanh danh mục trực tiếp ngay trên header panel hoặc inline row.

#### [NEW] [page.tsx](<file:///Users/datdoan/Documents/projects/zalobot/apps/web/app/(private)/settings/page.tsx>)

- Khai báo Next.js App Router Page cho `/settings`.

#### [MODIFY] [app-navigation.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/app-navigation.tsx)

- Bổ sung mục `Cài đặt` (`APP_ROUTES.settings`) vào menu điều hướng kèm icon Settings (bánh răng).

#### [MODIFY] [transactions-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx) & [expenses-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/expenses/view/expenses-screen.tsx)

- Sử dụng `useCategoriesQuery` để nạp danh mục tùy chỉnh của người dùng vào menu Autocomplete, kết hợp mượt mà với danh mục thực tế trong lịch sử giao dịch.

---

## Kế hoạch kiểm thử & Xác thực (Verification Plan)

### Automated Tests

1. **Kiểm tra kiểu dữ liệu toàn monorepo**:
   ```bash
   npm run typecheck
   ```
2. **Kiểm tra unit tests backend**:
   ```bash
   npm run test --workspace @zalobot/api
   ```
3. **Kiểm tra tính toàn vẹn hệ thống Agent**:
   ```bash
   npm run agent-system:validate
   ```
4. **Kiểm tra build web**:
   ```bash
   npm run build:web
   ```

### Manual Verification

1. Mở trang `/settings` qua thanh Sidebar:
   - Kiểm tra hiển thị đầy đủ 2 nhóm danh mục: Chi tiêu và Thu nhập.
   - Thử thêm một danh mục mới (ví dụ: "Tiền cà phê sáng") -> Danh mục xuất hiện ngay lập tức trong bảng.
   - Thử sửa tên danh mục hoặc xóa một danh mục -> Dữ liệu cập nhật real-time.
2. Mở trang `/transactions` hoặc `/expenses`:
   - Bấm vào sửa Danh mục trên 1 dòng -> Autocomplete hiển thị ngay danh mục vừa thêm ở trang Settings.
