# Kế Hoạch Triển Khai: Mũi Tên Dropdown Mở Rộng Hàng Con Lồng Nhau (Nested Rows) Cho Các Bảng Dữ Liệu

## 1. Mục Tiêu & Bối Cảnh

Người dùng lựa chọn **Cách A (Nested Rows - Hàng con lồng nhau)** để hiển thị chi tiết các bản ghi được gộp (combined) hoặc phân bổ (allocated) trong các bảng dữ liệu (Bảng Công Nợ và Bảng Thu–Chi).

Khi một dòng dữ liệu có các mục con (ví dụ: khoản nợ cha chứa nhiều khoản nợ con sau khi gộp, hoặc giao dịch thu–chi chứa các phân bổ công nợ):

- Xuất hiện nút mũi tên dropdown (`▶` thu gọn / `▼` mở rộng) cùng badge số lượng mục con.
- Khi bấm mở rộng, các dòng con sẽ hiển thị trực tiếp ngay bên dưới dòng cha với cấu trúc lồng nhau (nested rows), thụt lề trực quan (`↳`), nền phân biệt nhẹ (`bg-slate-50/70 dark:bg-slate-900/40`), và số thứ tự phân cấp (như `1.1`, `1.2` hoặc dấu nhánh).

---

## 2. User Review Required

> [!IMPORTANT]
> **Phạm vi áp dụng Cách A (Nested Rows)**:
>
> 1. **Bảng Công Nợ (`DebtsTable`)**: Chuẩn hóa và làm đẹp cơ chế cây nợ cha–con hiện tại (icon dropdown mượt mà, phân cấp số thứ tự `1.1`, `1.2`, nền hàng con riêng biệt).
> 2. **Bảng Thu–Chi (`TransactionsTable`)**: Thêm cơ chế mở rộng dòng trực tiếp cho các giao dịch có phân bổ nợ (`allocations`), hiển thị các dòng con phân bổ ngay bên dưới thay vì chỉ có thể mở modal popup.
> 3. **Thành phần Dùng Chung (`DataTable`)**: Bổ sung hỗ trợ class styling hàng con (`isChildRow`, `depth`, `rowClassName`) để đảm bảo tất cả bảng trong dự án có giao diện phân cấp đồng bộ 100%.

---

## 3. Đề Xuất Thay Đổi Chi Tiết

### A. Gói Hợp Đồng Dùng Chung (`@zalobot/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung translation keys song ngữ (`vi` & `en`):
  - `transactions.expandAllocations`: `'Mở rộng chi tiết phân bổ'` / `'Expand debt allocations'`
  - `transactions.collapseAllocations`: `'Thu gọn chi tiết phân bổ'` / `'Collapse debt allocations'`
  - `transactions.badge.allocatedChild`: `'Phân bổ'` / `'Allocation'`
  - `table.childRowIndicator`: `'↳'`

---

### B. Shared UI (`DataTable`)

#### [MODIFY] [data-table.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/data-table.tsx)

- Bổ sung hỗ trợ định kiểu dòng con linh hoạt qua `getRowClassName?: (row: T, index: number) => string` hoặc nhận biết thuộc tính `_isChild?: boolean`.
- Đảm bảo hover effect, borders (`border-b`, `border-r`), và spacing của các hàng con hiển thị hài hòa, không phá vỡ tính năng kéo giãn cột (column resize) hoặc ẩn/hiện cột (column toggle).

---

### C. Module Công Nợ (`debts`)

#### [MODIFY] [debts-table.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/presentation/components/debts-table.tsx)

- Nâng cấp UI mũi tên dropdown tại cột Đối tác (`counterparty`) thành nút bấm icon Chevron tinh tế (`▶ / ▼`) có hiệu ứng hover và tooltip rõ ràng.
- Gắn class styling nền dòng con (`bg-slate-50/70 dark:bg-slate-900/40`).
- Cột `STT`: Hiển thị số thứ tự phân tầng (ví dụ dòng cha là `1`, dòng con là `1.1`, `1.2` hoặc icon `↳`).
- Đảm bảo tính toán tổng số tiền (Footer/Summary) chỉ cộng các dòng cha hoặc tránh double-counting.

---

### D. Module Thu–Chi (`dashboard`)

#### [MODIFY] [transactions-table.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/presentation/components/transactions-table.tsx)

- Quản lý state `expandedTransactionIds: Set<string>`.
- Làm phẳng danh sách `flattenedTransactions`: Chèn các dòng con ảo (`_isAllocationChild: true`) ngay dưới giao dịch cha khi giao dịch đó có `item.allocations.length > 0` và đang được mở rộng.
- Cột Ghi chú/Danh mục: Thêm nút mũi tên `▶ / ▼` cạnh badge `🔗 N phân bổ` để click mở rộng ngay tại bảng.
- Hiển thị dòng con phân bổ:
  - Cột `STT`: `↳`
  - Cột `type`: Badge `Phân bổ` (`Allocation`)
  - Cột `category` / `note`: Tên khoản nợ / Đối tác được phân bổ kèm ghi chú
  - Cột `amount`: Số tiền được phân bổ
  - Cột `actions`: Nút xem/sửa phân bổ nhanh

---

### E. Tài Liệu Hệ Thống & Knowledge Sync

#### [MODIFY] [debts knowledge](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/debts/README.md)

- Cập nhật quy chuẩn UX phân cấp cha–con và nested rows.

#### [MODIFY] [dashboard knowledge](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md)

- Cập nhật quy chuẩn mở rộng phân bổ công nợ dạng nested rows.

#### [MODIFY] [debts docs](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/debts/README.md)

- Bổ sung tài liệu hướng dẫn cho developer về cấu trúc cây phân cấp bảng nợ.

#### [MODIFY] [dashboard docs](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md)

- Bổ sung tài liệu hướng dẫn xem phân bổ giao dịch inline.

---

## 4. Kế Hoạch Kiểm Thử & Xác Minh (Verification Plan)

### Automated Tests & Quality Gates

- `npm run agent-system:validate`: Kiểm tra tính toàn vẹn hệ thống và liên kết tài liệu.
- `npm run typecheck --workspace=@zalobot/contracts`: Kiểm tra kiểu dữ liệu và từ điển song ngữ.
- `npm run typecheck --workspace=@zalobot/web`: Kiểm tra tính toàn vẹn type-safe của giao diện web.
- `npm run lint`: Kiểm tra tuân thủ coding conventions và Zero Hardcoded Text.

### Manual Verification

1. Mở trang Quản lý Công nợ (`/debts`):
   - Kiểm tra các khoản nợ gộp có nút `▶ / ▼`.
   - Bấm mở rộng/thu gọn, kiểm tra thụt lề `↳`, nền xám phân biệt, và số tiền hiển thị chuẩn xác.
2. Mở trang Thu–Chi (`/transactions` hoặc Overview Dashboard):
   - Kiểm tra giao dịch có phân bổ công nợ hiển thị icon mũi tên `▶ / ▼`.
   - Bấm mở rộng, kiểm tra các dòng phân bổ con xuất hiện ngay dưới dòng chính.
   - Thử chỉnh sửa inline hoặc thao tác trên dòng chính xem có bị ảnh hưởng hay không.
