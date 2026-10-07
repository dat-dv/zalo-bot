# Walkthrough: Bổ sung Autocomplete cho trường "Danh mục" trên màn hình Thu chi

Đã hoàn thành tích hợp cơ chế tự động gợi ý danh mục (**Category Autocomplete**) thông minh theo ngữ cảnh trên Web Dashboard.

---

## 1. Các thay đổi đã thực hiện

### 1.1. Packages / Shared Contracts (`@zalobot/contracts`)

- Xuất các bộ danh mục chuẩn định sẵn:
  - `DEFAULT_INCOME_CATEGORIES`: `['Lương', 'Thưởng', 'Đầu tư', 'Thu nợ', 'Kinh doanh', 'Quà tặng', 'Khác']`
  - `DEFAULT_EXPENSE_CATEGORIES`: `['Ăn uống', 'Di chuyển', 'Mua sắm', 'Hóa đơn & Tiện ích', 'Giải trí', 'Nhà cửa', 'Sức khỏe', 'Giáo dục', 'Gia đình', 'Khác']`

### 1.2. Frontend Transactions Screen (`apps/web/src/modules/dashboard/view/transactions-screen.tsx`)

- Tích hợp logic gợi ý danh mục tự động thích ứng với Loại giao dịch (`editDraft.type`):
  - **Khoản chi (`expense`)**: Tự động gợi ý danh mục chi tiêu chuẩn (`DEFAULT_EXPENSE_CATEGORIES`) + danh mục chi tiêu trong lịch sử giao dịch của người dùng.
  - **Khoản thu (`income`)**: Tự động gợi ý danh mục thu nhập chuẩn (`DEFAULT_INCOME_CATEGORIES`) + danh mục thu nhập trong lịch sử giao dịch của người dùng.
- Render thẻ HTML5 `<datalist id="transaction-categories-autocomplete">` và gắn `list="transaction-categories-autocomplete"` vào input chỉnh sửa `category`.

### 1.3. Frontend Expenses Screen (`apps/web/src/modules/expenses/view/expenses-screen.tsx`)

- Tích hợp danh sách gợi ý `categorySuggestions` kết hợp giữa `DEFAULT_EXPENSE_CATEGORIES` và toàn bộ danh mục chi tiêu đã có.
- Render `<datalist id="expense-categories-autocomplete">` và gắn `list="expense-categories-autocomplete"` vào input `category`.

---

## 2. Kết quả xác thực (Verification Results)

### Kiểm tra tự động

- **Typecheck**: `npm run typecheck` ➜ Passed (0 lỗi toàn bộ monorepo).
- **Unit Tests**: `npm run test --workspace @zalobot/api` ➜ 5/5 tests passed.
- **Web Build**: `npm run build:web` ➜ Compiled & Generated static pages successfully.
- **Agent System Validation**: `npm run agent-system:validate` ➜ 85 artifacts, 149 dependencies, 0 cyclic groups passed.

---

## 3. Hướng dẫn kiểm tra thủ công (Manual Verification)

1. Mở trang `/transactions`:
   - Bấm vào nút Sửa (✎) hoặc double click vào ô **Danh mục** trên một dòng giao dịch.
   - Nhấp chuột vào ô hoặc gõ các chữ cái đầu ➜ Danh sách menu dropdown gợi ý danh mục hiển thị đầy đủ, cho phép chọn nhanh mà không cần nhập tay toàn bộ.
   - Thử đổi loại giao dịch sang "Khoản thu" ➜ Danh mục gợi ý tự động chuyển sang các danh mục thu nhập (Lương, Thưởng, Đầu tư...).
2. Mở trang `/expenses`:
   - Double click vào ô **Danh mục** ➜ Danh sách gợi ý danh mục chi tiêu phổ biến xuất hiện ngay lập tức.
