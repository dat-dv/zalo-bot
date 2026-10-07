# Kế Hoạch Triển Khai: Master-Detail Expanded Sub-panel (1 Dropdown Duy Nhất & 1 Level Thụt Lề)

## 1. Mục Tiêu & Bối Cảnh

Người dùng yêu cầu tái cấu trúc cơ chế hiển thị dòng con:

- **Chỉ có đúng 1 nút dropdown toggle `▶ / ▼` trên mỗi dòng**: Loại bỏ hoàn toàn tình trạng có 2 nút bấm chevron nằm cạnh nhau.
- **Chỉ 1 level phân cấp duy nhất**: Không lồng ghép 2-3 cấp dropdown vô tận gây phức tạp.
- **Thụt lề vào trong dạng Sub-panel (`colSpan`)**: Không chèn (append) các dòng con trực tiếp vào mảng dữ liệu chính của bảng. Điều này giữ cho số thứ tự STT `1, 2, 3...` của bảng chính luôn liên tục và không làm sai lệch checkbox chọn nợ.

---

## 2. User Review Required

> [!IMPORTANT]
> **Thiết Kế Master-Detail Sub-panel**:
>
> 1. **Bảng dữ liệu dùng chung (`DataTable`)**: Hỗ trợ 2 props mới:
>    - `renderExpandedRow?: (row: T, index: number) => React.ReactNode`: Render nội dung chi tiết dạng ô `colSpan={visibleColumns.length}` có viền bo và thụt lề `pl-10`.
>    - `isRowExpanded?: (row: T, index: number) => boolean`: Kiểm tra dòng đang mở rộng.
> 2. **Bảng Công Nợ (`DebtsTable`)**:
>    - Bảng chính chỉ chứa các khoản nợ độc lập / khoản nợ cha (STT chuẩn `1, 2, 3...`, checkbox chỉ chọn các khoản chính).
>    - Mỗi dòng chỉ có **1 nút bấm mũi tên `▶ / ▼`** duy nhất ở cột Người liên quan (hiện lên khi có khoản con hoặc có đợt thanh toán).
>    - Khi bấm mở, hiển thị **Sub-panel Mini Grid** thụt lề bên dưới:
>      - Với khoản gộp: Danh sách các khoản con cấu thành.
>      - Với khoản có thanh toán / đã tất toán: Bảng lịch sử các đợt thanh toán (Đợt #, Số tiền `- X ₫`, Ngày trả, Ghi chú, Nút xóa đợt trả).
> 3. **Bảng Thu–Chi (`TransactionsTable`)**:
>    - Áp dụng tương tự cho phân bổ công nợ: Không chèn dòng con vào bảng chính, mà mở rộng thành Sub-panel chi tiết phân bổ thụt lề ngay dưới giao dịch.

---

## 3. Đề Xuất Thay Đổi Chi Tiết

### A. Thành Phần Bảng Dùng Chung (`apps/web/src/shared/ui/data-table.tsx`)

#### [MODIFY] [data-table.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/data-table.tsx)

- Bổ sung vào `DataTableProps<T>`:
  - `renderExpandedRow?: (row: T, index: number) => React.ReactNode`
  - `isRowExpanded?: (row: T, index: number) => boolean`
- Trong thẻ `<tbody>`: Khi `isExpanded && renderExpandedRow`, render thêm `<tr><td colSpan={visibleColumns.length} className="border-b border-slate-200 p-2.5 bg-slate-50/60 dark:bg-slate-900/40 dark:border-slate-800">...</td></tr>`.

---

### B. Module Công Nợ (`apps/web/src/modules/debts`)

#### [MODIFY] [debts-table.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/presentation/components/debts-table.tsx)

- Bỏ cơ chế `flattenedRows` chèn dòng phẳng vào mảng chính.
- Sử dụng mảng danh sách các khoản nợ gốc `debts.filter(d => !d.parentDebtId)`.
- Sử dụng 1 state duy nhất: `expandedDebtIds: Set<string>`.
- Cột **Người liên quan**: Chỉ render **1 nút bấm mũi tên `▶ / ▼`** duy nhất khi `item.children?.length > 0` hoặc `item.payments?.length > 0`.
- Xây dựng hàm `renderExpandedRow(debt: IDebtListItem)`:
  - Khung Sub-panel thụt lề `pl-10 pr-2 py-1.5`.
  - Hiển thị bảng mini các khoản con (nếu là nợ gộp) hoặc bảng mini lịch sử đợt trả nợ (nếu có thanh toán).

---

### C. Module Thu–Chi (`apps/web/src/modules/dashboard`)

#### [MODIFY] [transactions-table.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/presentation/components/transactions-table.tsx)

- Bỏ cơ chế `flattenedTransactions` chèn dòng con phân bổ vào mảng chính.
- Sử dụng `renderExpandedRow` của `DataTable` để hiển thị Sub-panel mini các khoản phân bổ công nợ thụt lề bên dưới giao dịch cha.

---

### D. Tài Liệu Hệ Thống & Knowledge Sync

#### [MODIFY] [debts knowledge](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/debts/README.md) & [debts docs](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/debts/README.md)

- Cập nhật quy chuẩn UX Master-Detail Expanded Sub-panel (1 dropdown, 1 level, colSpan sub-grid).

#### [MODIFY] [dashboard knowledge](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md) & [dashboard docs](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md)

- Cập nhật quy chuẩn Sub-panel cho phân bổ thu chi.

---

## 4. Kế Hoạch Kiểm Thử & Xác Minh (Verification Plan)

### Automated Tests & Quality Gates

- `npm run typecheck`: Kiểm tra 100% type safety trên cả 3 workspaces.
- `npm run lint`: Kiểm tra không có vi phạm ESLint.
- `npm run test --workspace=@zalobot/api`: Chạy 74 unit tests backend.
- `npm run agent-system:validate`: Kiểm tra tính toàn vẹn hệ thống tài liệu.

### Manual Verification

1. Mở trang Quản lý Công nợ (`/debts`):
   - Kiểm tra STT bảng chính luôn liên tục `1, 2, 3...` không bị nhảy số.
   - Kiểm tra mỗi dòng nợ chỉ có đúng 1 nút mũi tên `▶ / ▼`.
   - Bấm mở dòng 1 (Đã tất toán): Xuất hiện Sub-panel thụt lề hiển thị bảng chi tiết đợt trả 1.000.000đ.
   - Bấm mở dòng 3 (Khoản gộp): Xuất hiện Sub-panel thụt lề hiển thị bảng chi tiết 2 khoản con.
2. Mở trang Giao dịch Thu–Chi (`/transactions`):
   - Bấm mở giao dịch có phân bổ: Xuất hiện Sub-panel thụt lề hiển thị chi tiết các khoản phân bổ.
