# Kế hoạch thiết kế lại giao diện Dashboard Enterprise (Fullscreen & Data-Dense)

Thiết kế lại toàn bộ giao diện Web Dashboard theo chuẩn **Flat Enterprise + Data-Dense B2B SaaS + Excel-lite interaction**, mở rộng 100% Fullscreen màn hình (không giới hạn `max-width`), tăng mật độ hiển thị dữ liệu (Data Density), bo góc tối thiểu (2px–4px), bổ sung thanh tìm kiếm & bộ lọc dữ liệu (Search & Filter toolbars) cho tất cả các bảng.

---

## 1. Hướng tiếp cận & Nguyên tắc thiết kế (Design Direction)

1. **Bố cục Fullscreen / Fluid 100% Viewport Width:**
   - Xoá bỏ giới hạn `max-width: 1240px; margin: 0 auto;`.
   - Sidebar cố định bên trái (220px) với phong cách Enterprise tối giản, sticky toàn chiều cao `100vh`.
   - Vùng nội dung chính chiếm toàn bộ chiều rộng còn lại (`calc(100vw - 220px)`), padding gọn gàng `16px 20px` tận dụng tối đa không gian màn hình lớn.
1. **Ngôn ngữ thẩm mỹ Enterprise & Excel-lite:**
   - **Ít bo góc (Low Radius):** Đồng bộ `border-radius: 2px – 4px` cho toàn bộ nút bấm, thẻ metric, input và bảng.
   - **Đường viền sắc nét (Crisp 1px Borders):** Phân cách rõ ràng giữa các cột, hàng và panels bằng viền `#e2e8f0` (Light) và `#334155` (Dark).
   - **Mật độ thông tin cao (High Density):** Giảm chiều cao hàng của bảng xuống 34px–36px, thẻ metric gọn 72px, số liệu dùng `font-variant-numeric: tabular-nums` căn chỉnh chuẩn kế toán.
1. **Công cụ xử lý dữ liệu mạnh mẽ (Data Handling & Utilities):**
   - Bổ sung **Toolbar trên từng bảng**: Ô tìm kiếm nhanh (Search by keyword), nút lọc trạng thái (Filter pills/select), đếm tổng số dòng hiển thị.
   - Header bảng dính (`sticky table header`) khi cuộn.
   - Hỗ trợ xem dữ liệu chi tiết, phân loại nhanh và thao tác trơn tru.
1. **Tuân thủ quy chuẩn quốc tế hóa (Zero Hardcoded Text):**
   - Bổ sung toàn bộ translation keys mới vào `packages/contracts` cho cả 2 ngôn ngữ `vi` và `en`.

---

## 2. Thay đổi dự kiến (Proposed Changes)

### Package: `@zalobot/contracts`

#### [MODIFY] packages/contracts/src/index.ts

- Bổ sung translation keys cho bộ lọc và tìm kiếm:
  - `table.searchPlaceholder`: `"Tìm kiếm nhanh..."` / `"Quick search..."`
  - `table.filter.all`: `"Tất cả"` / `"All"`
  - `table.filter.receivable`: `"Cần thu"` / `"Receivable"`
  - `table.filter.payable`: `"Cần trả"` / `"Payable"`
  - `table.filter.income`: `"Thu"` / `"Income"`
  - `table.filter.expense`: `"Chi"` / `"Expense"`
  - `table.rowsCount`: `"{count} dòng"` / `"{count} rows"`
  - `dashboard.quickStats`: `"Chỉ số nhanh"` / `"Quick Stats"`

---

### Shared UI: `apps/web/src/shared/ui/` & Styles

#### [MODIFY] apps/web/src/styles.css

- Tái cấu trúc Layout sang **Fullscreen Enterprise Grid**:
  - `.workspace`: `max-width: 100%; padding: 14px 18px; width: 100%;`.
  - `.app-shell`: `grid-template-columns: 210px minmax(0, 1fr); gap: 18px;`.
  - `.app-nav`: Cố định 210px, giao diện compact, thanh lịch.
  - `.metric-grid`: Grid 4–6 cột linh hoạt, viền phẳng, padding gọn `10px 14px`, số liệu to rõ ràng `tabular-nums`.
  - `.data-panel`: Viền phẳng `2px`, header tích hợp thanh toolbar tìm kiếm + bộ lọc inline.
  - `.data-table`: Row height 34px, header 32px nền xám nhạt, border phân tách rõ ràng phong cách Excel/Sheets, hỗ trợ sticky header.
  - Controls (Input, Button, Select): Chiều cao chuẩn 30px–32px, `border-radius: 3px`, focus ring sắc nét.

#### [MODIFY] apps/web/src/shared/ui/data-table.tsx

- Mở rộng `DataPanel` để hỗ trợ slot `actions` (ô Search, nút lọc, bộ đếm số lượng).
- Nâng cấp `DataTable` với styling Enterprise gọn gàng, sticky header, hỗ trợ hiển thị dữ liệu dày đặc không bị tràn.

#### [MODIFY] apps/web/src/shared/ui/reports-navigation.tsx

- Cập nhật Sidebar Navigation theo phong cách Enterprise phẳng: Brand header gọn 36px, item list mật độ cao, quick badge, chân trang tích hợp toggle sáng/tối và chọn ngôn ngữ gọn nhẹ.

---

### Module Views: `apps/web/src/modules/`

#### [MODIFY] apps/web/src/modules/dashboard/view/dashboard-screen.tsx

- Chuyển sang bố cục Fullscreen đa cột:
  - Header compact với Breadcrumb + Quick Refresh + Logout.
  - Metric bar 4 cột trải rộng toàn màn hình.
  - Thêm ô tìm kiếm nhanh lọc giao dịch / công nợ / tasks trực tiếp trên giao diện.
  - Content grid 2 cột full width hiển thị nhiều dòng hơn mà không cần cuộn nhiều.

#### [MODIFY] apps/web/src/modules/contacts/view/contacts-screen.tsx

- Tích hợp thanh tìm kiếm theo Tên / Biệt danh / Mô tả.
- Bộ đếm số lượng liên lạc, bảng danh bạ full-width hiển thị sắc nét.

#### [MODIFY] apps/web/src/modules/debts/view/debts-screen.tsx

- Tích hợp thanh Toolbar:
  - Search theo tên đối tác / ghi chú.
  - Filter pills: "Tất cả" | "Cần thu" | "Cần trả".
  - Tổng số tiền cần thu & cần trả hiển thị ngay trên thanh công cụ.

#### [MODIFY] apps/web/src/modules/expenses/view/expenses-screen.tsx

- Tích hợp thanh Toolbar:
  - Search theo danh mục / nội dung chi.
  - Filter theo danh mục phổ biến.
  - Tổng số tiền chi hiển thị realtime theo từ khóa tìm kiếm.

---

## 3. Kế hoạch kiểm thử & Xác thực (Verification Plan)

### Automated Verification

1. **Kiểm tra build toàn bộ workspace:**
   ```bash
   npm run build
   ```
1. **Kiểm tra Type Safety & Linters:**
   ```bash
   npm run typecheck
   npm run lint
   npm run agent-system:validate
   ```

### Manual Verification

- Mở Dashboard trên màn hình Fullscreen (Desktop & Laptop), kiểm tra:
  1. Giao diện trải rộng 100% không bị giới hạn container hẹp.
  2. Bấm tìm kiếm & lọc trên các bảng (Công nợ, Khoản chi, Danh bạ) phản hồi tức thì.
  3. Các đường viền, bo góc 2px-4px chuẩn Enterprise B2B SaaS sắc sảo.
  4. Chuyển đổi Dark / Light mode hiển thị độ tương phản cao, dễ nhìn.
