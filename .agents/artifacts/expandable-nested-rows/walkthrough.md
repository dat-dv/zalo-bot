# Walkthrough: Mũi Tên Dropdown Mở Rộng Hàng Con Lồng Nhau (Nested Rows)

Đã hoàn thành triển khai tính năng mở rộng dòng lồng nhau (**Cách A - Nested Rows**) cho các bảng dữ liệu có tính năng gộp (Công nợ) và phân bổ (Thu–Chi).

---

## 1. Những Điểm Thay Đổi Chính

### A. Gói Hợp Đồng Dùng Chung (`@zalobot/contracts`)

- Bổ sung trường `allocations` vào giao diện `ITransactionItem`.
- Bổ sung bộ từ điển song ngữ (`vi` & `en`):
  - `transactions.expandAllocations`: `'Mở rộng chi tiết phân bổ'` / `'Expand debt allocations'`
  - `transactions.collapseAllocations`: `'Thu gọn chi tiết phân bổ'` / `'Collapse debt allocations'`
  - `transactions.badge.allocatedChild`: `'Phân bổ'` / `'Allocation'`
  - `transactions.allocation.viewDebt`: `'Xem khoản nợ'` / `'View debt record'`
  - `transactions.allocation.editAllocations`: `'Chỉnh sửa phân bổ'` / `'Edit allocations'`

### B. Thành Phần Bảng Dùng Chung (`DataTable`)

- Bổ sung prop `getRowClassName?: (row: T, index: number) => string | undefined` vào `DataTableProps` để tùy biến nền các hàng con (`bg-slate-50/70 dark:bg-slate-900/40`).
- Bổ sung prop `disableSorting?: boolean` để giữ nguyên trật tự phân cấp cha–con khi danh sách đã được làm phẳng có thứ tự.

### C. Module Công Nợ (`DebtsTable`)

- Nâng cấp nút bấm mở rộng cây nợ cha–con thành nút icon Chevron SVG tinh tế (`▶ / ▼` xoay `rotate-90`).
- Áp dụng nền phân biệt cho hàng nợ con và ký hiệu rẽ nhánh `↳`.
- Đảm bảo tính toán tổng tiền footer chỉ tính các khoản cha độc lập để tránh tính trùng (double-counting).

### D. Module Thu–Chi (`TransactionsTable` & Backend)

- **Backend API (`FinanceService` & `ReportsController`)**: Bổ sung `relations: { place: true, allocations: { debt: true } }` khi nạp dữ liệu dashboard và map đầy đủ danh sách `allocations` của từng giao dịch.
- **Frontend `TransactionsTable`**:
  - Quản lý state `expandedAllocationIds`.
  - Làm phẳng danh sách `flattenedTransactions` khi mở rộng.
  - Hiển thị nút bấm Chevron (`▶ / ▼` với `rotate-90`) cạnh badge `🔗 N phân bổ`.
  - Hiển thị các dòng con phân bổ:
    - Loại: Huy hiệu `Phân bổ` (`Allocation`)
    - Danh mục: Ký hiệu `↳` + Tên đối tác/khoản nợ
    - Ghi chú: Ghi chú phân bổ riêng
    - Số tiền: Số tiền phân bổ định dạng xanh dương
    - Thao tác: Nút bấm `✏️ Chỉnh sửa phân bổ` mở modal phân bổ nhanh.

---

## 2. Kết Quả Kiểm Thử & Quality Gates

1. `npm run build --workspace=@zalobot/contracts`: **PASS** (100% type definition build thành công).
2. `npm run typecheck`: **PASS** (0 errors trên cả 3 workspaces: `@zalobot/api`, `@zalobot/web`, `@zalobot/contracts`).
3. `npm run lint`: **PASS** (0 linter errors, tuân thủ 100% Zero-Any và i18n rules).
4. `npm run test --workspace=@zalobot/api`: **PASS** (74/74 unit tests passed).
5. `npm run agent-system:validate`: **PASS** (91 artifacts, 157 dependencies, 56 pairs).
