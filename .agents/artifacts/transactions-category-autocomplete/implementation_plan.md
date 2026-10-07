# Kế hoạch bổ sung Autocomplete cho trường "Danh mục" trên màn hình Thu chi

## Tổng quan & Bối cảnh

Người dùng phản ánh trường **Danh mục** (`category`) trên màn hình Thu chi (`TransactionsScreen`) hiện vẫn phải nhập tay hoàn toàn bằng bàn phím mà chưa có gợi ý tự động (autocomplete / datalist), gây bất tiện và không nhất quán giữa các lần nhập.

Mục tiêu: Tích hợp cơ chế tự động gợi ý danh mục thông minh theo loại giao dịch (Thu / Chi) dựa trên:

1. Danh sách danh mục chuẩn định sẵn (`DEFAULT_INCOME_CATEGORIES` và `DEFAULT_EXPENSE_CATEGORIES`).
2. Toàn bộ các danh mục thực tế mà người dùng đã từng sử dụng trong lịch sử giao dịch.

---

## User Review Required

> [!NOTE]
> Gợi ý danh mục sẽ tự động thích ứng theo cột **Loại giao dịch** (`type`):
>
> - Khi chọn **Khoản chi** (`expense`): Gợi ý các danh mục chi tiêu (Ăn uống, Di chuyển, Mua sắm, Hóa đơn & Tiện ích, Giải trí, Nhà cửa, Sức khỏe, Giáo dục, Gia đình, Khác...) + các danh mục chi tiêu đã có.
> - Khi chọn **Khoản thu** (`income`): Gợi ý các danh mục thu nhập (Lương, Thưởng, Đầu tư, Thu nợ, Kinh doanh, Quà tặng, Khác...) + các danh mục thu nhập đã có.

---

## Thay đổi đề xuất (Proposed Changes)

### 1. Packages / Shared Contracts (`packages/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Xuất các hằng số danh mục chuẩn:
  - `DEFAULT_INCOME_CATEGORIES`: `['Lương', 'Thưởng', 'Đầu tư', 'Thu nợ', 'Kinh doanh', 'Quà tặng', 'Khác']`
  - `DEFAULT_EXPENSE_CATEGORIES`: `['Ăn uống', 'Di chuyển', 'Mua sắm', 'Hóa đơn & Tiện ích', 'Giải trí', 'Nhà cửa', 'Sức khỏe', 'Giáo dục', 'Gia đình', 'Khác']`

---

### 2. Frontend Transactions Module (`apps/web/src/modules/dashboard`)

#### [MODIFY] [transactions-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx)

- Tính toán `categorySuggestions` kết hợp giữa danh mục mặc định tương ứng với `editDraft.type` và các danh mục xuất hiện trong `rawList`.
- Render thẻ HTML5 `<datalist id="transaction-categories-autocomplete">`.
- Gắn thuộc tính `list="transaction-categories-autocomplete"` vào ô input chỉnh sửa `category`.

---

### 3. Frontend Expenses Module (`apps/web/src/modules/expenses`)

#### [MODIFY] [expenses-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/expenses/view/expenses-screen.tsx)

- Tính toán danh sách gợi ý danh mục chi tiêu kết hợp giữa `DEFAULT_EXPENSE_CATEGORIES` và danh mục thực tế.
- Render thẻ `<datalist id="expense-categories-autocomplete">` và gắn `list="expense-categories-autocomplete"` vào input danh mục.

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

1. Mở trang `/transactions`:
   - Bấm vào nút Sửa (✎) hoặc double click vào ô Danh mục trên 1 dòng chi tiêu -> Click chuột hoặc gõ chữ cái đầu -> Menu gợi ý danh mục chi tiêu xuất hiện.
   - Chuyển loại giao dịch sang "Khoản thu" -> Danh sách gợi ý tự động đổi sang danh mục thu nhập (Lương, Thưởng...).
2. Mở trang `/expenses`:
   - Double click vào ô Danh mục -> Menu autocomplete xuất hiện đầy đủ các danh mục chi tiêu phổ biến.
