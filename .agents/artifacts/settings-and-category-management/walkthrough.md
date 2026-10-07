# Walkthrough: Xây dựng Trang Cài đặt chung & Quản lý Danh mục (Categories)

Đã hoàn thành xây dựng trang **Cài đặt chung (`/settings`)** và phân hệ **Quản lý Danh mục Thu & Chi (Category Management)** trên Web Dashboard.

---

## 1. Các thay đổi đã thực hiện

### 1.1. Packages / Shared Contracts (`@zalobot/contracts`)

- Thêm route điều hướng `APP_ROUTES.settings = '/settings'` và API endpoint `API_ROUTES.categories = '/api/categories'`.
- Khai báo các interface: `ICategoryItem`, `ICreateCategoryRequest`, `IUpdateCategoryRequest`, `ICategoryListResponse`.
- Bổ sung translation keys đa ngôn ngữ (`vi` & `en`) cho thanh điều hướng và màn hình Cài đặt.

### 1.2. Database & Backend API (`apps/api`)

- **TypeORM Entity**: Tạo `UserCategoryEntity` (`user_categories` table) liên kết theo `userId`, quản lý `type` (`income` | `expense`), `name`, `color`, `icon`, `isDefault`.
- **`FinanceService`**:
  - `listCategories(userId, type?)`: Tự động nạp (auto-seed) danh mục chuẩn mặc định từ `DEFAULT_EXPENSE_CATEGORIES` và `DEFAULT_INCOME_CATEGORIES` cho người dùng mới.
  - `createCategory(userId, input)`: Tạo danh mục mới và ngăn chặn trùng lặp tên.
  - `updateCategory(userId, id, input)`: Cho phép đổi tên danh mục.
  - `deleteCategory(userId, id)`: Xóa danh mục an toàn.
- **`FinanceController`**: Cung cấp trọn bộ RESTful API endpoints có bảo vệ Bearer JWT:
  - `GET /api/categories`
  - `POST /api/categories`
  - `PATCH /api/categories/:id`
  - `DELETE /api/categories/:id`

### 1.3. Frontend Web Dashboard (`apps/web`)

- **Navigation (`AppNavigation`)**: Thêm mục **Cài đặt** (`Settings`) trong nhóm **Hệ thống** với icon bánh răng.
- **React Query API Layer (`categories-query.ts`)**: Cung cấp các hooks `useCategoriesQuery`, `useCreateCategoryMutation`, `useUpdateCategoryMutation`, `useDeleteCategoryMutation`.
- **Màn hình Cài đặt (`SettingsScreen`)**:
  - Bố cục 2 Panel quản lý độc lập: **Danh mục Chi tiêu** và **Danh mục Thu nhập**.
  - Thanh công cụ: Ô tìm kiếm nhanh, nút `+ Thêm danh mục`, form thêm nhanh trực tiếp.
  - Thao tác trên từng dòng: Sửa inline tên danh mục (Enter để lưu, Escape để hủy), nút Xóa kèm hộp thoại xác nhận.
- **Tích hợp Autocomplete toàn hệ thống**:
  - Tự động liên kết danh mục người dùng cấu hình vào menu gợi ý dropdown trên cả hai màn hình **Thu chi (`TransactionsScreen`)** và **Chi tiêu (`ExpensesScreen`)**.

---

## 2. Kết quả xác thực (Verification Results)

### Kiểm tra tự động

- **Typecheck**: `npm run typecheck` ➜ Passed (0 lỗi toàn bộ monorepo).
- **Unit Tests**: `npm run test --workspace @zalobot/api` ➜ 5/5 tests passed.
- **API Build**: `npm run build:api` ➜ Compiled successfully.
- **Web Build**: `npm run build:web` ➜ Compiled & Generated static route `/settings` successfully.
- **Agent System Validation**: `npm run agent-system:validate` ➜ 86 artifacts, 150 dependencies, 54 pairs, 0 cyclic groups passed.

---

## 3. Hướng dẫn kiểm tra thủ công (Manual Verification)

1. Mở trang `/settings` bằng cách nhấp vào mục **Cài đặt** trên thanh Sidebar bên trái:
   - Kiểm tra hiển thị 2 bảng: **Danh mục Chi tiêu** và **Danh mục Thu nhập**.
   - Bấm **+ Thêm danh mục chi** ➜ Nhập tên danh mục mới (ví dụ: `Cà phê & Trà`) và nhấn Enter ➜ Danh mục xuất hiện ngay trên bảng.
   - Nhấp đúp hoặc bấm biểu tượng cây bút ✎ trên một danh mục để đổi tên ➜ Nhấn Enter để lưu.
   - Bấm biểu tượng thùng rác 🗑 ➜ Hộp thoại xác nhận xuất hiện, chọn OK để xóa.
2. Mở trang `/transactions` hoặc `/expenses`:
   - Bấm vào sửa Danh mục trên một dòng bất kỳ ➜ Danh mục vừa tạo ở trang Cài đặt lập tức xuất hiện trong menu gợi ý autocomplete.
