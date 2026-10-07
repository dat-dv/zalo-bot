# Walkthrough: Hoàn Thành Kiến Trúc Master-Detail Expanded Sub-panel (1 Dropdown Duy Nhất & 1 Level Thụt Lề)

Đã hoàn thành tái cấu trúc cơ chế mở rộng chi tiết của **Bảng Công Nợ (`DebtsTable`)** và **Bảng Thu Chi (`TransactionsTable`)** sang chuẩn kiến trúc **Master-Detail Expanded Sub-panel**.

---

## 1. Những Cải Tiến & Giải Pháp Đạt Được

### A. DataTable Component (`apps/web/src/shared/ui/data-table.tsx`)

- Hỗ trợ 2 props chuẩn cho Master-Detail:
  - `renderExpandedRow?: (row: T, index: number) => React.ReactNode`: Render khối panel chi tiết bên dưới dòng cha với `colSpan={visibleColumns.length}`.
  - `isRowExpanded?: (row: T, index: number) => boolean`: Xác định trạng thái mở rộng của từng dòng.
- Khi mở rộng, thẻ `<tbody>` bao bọc cặp `<tr>` bằng `Fragment`, render dòng chi tiết thụt lề với nền phân biệt nhẹ `bg-slate-50/70 dark:bg-slate-900/50`.

### B. Bảng Công Nợ (`apps/web/src/modules/debts/presentation/components/debts-table.tsx`)

- **Bảng chính sạch sẽ**: Danh sách dòng chính chỉ gồm các khoản nợ gốc / nợ cha (`!parentDebtId`), đảm bảo **STT luôn liên tục `1, 2, 3...`** và checkbox chỉ chọn đúng các khoản nợ thực tế.
- **Duy nhất 1 nút dropdown `▶ / ▼`**: Mỗi dòng nợ chỉ có đúng 1 nút bấm Chevron ở đầu tên đối tác (hiển thị khi có khoản con hoặc có đợt trả nợ).
- **1 Level Thụt Lề Duy Nhất (`pl-12 pr-4`)**:
  - _Khoản gộp_: Mở ra bảng mini các khoản con (STT con, Tên khoản con, Số tiền ban đầu, Số tiền còn lại kèm tiến độ đã trả, Hạn trả, Ghi chú).
  - _Khoản có đợt thanh toán / Đã tất toán_: Mở ra bảng mini lịch sử đợt trả nợ (Đợt #, Số tiền trả `- X ₫` màu xanh ngọc, Ngày thanh toán, Ghi chú, Liên kết giao dịch `🔗`, Nút xóa đợt trả `✕`).
- **Tóm tắt nhanh ở dòng cha**: Cột Số tiền còn lại hiển thị nhãn phụ tiến độ `(Đã trả X ₫ · N đợt)`. Dòng đã tất toán (`0 ₫`) có thể bấm `▶` để tra cứu lịch sử trả nợ bất cứ lúc nào.

### C. Bảng Thu–Chi (`apps/web/src/modules/dashboard/presentation/components/transactions-table.tsx`)

- Bỏ cơ chế append dòng phân bổ vào bảng chính.
- Bảng chính giữ nguyên STT `1, 2, 3...`.
- Khi bấm nút `▶ / ▼` trên giao dịch có phân bổ: Hiển thị Sub-panel mini chi tiết các khoản phân bổ công nợ (`colSpan`) kèm nút `✏️ Chỉnh sửa phân bổ`.

---

## 2. Kết Quả Kiểm Thử & Quality Gates

1. `npm run typecheck`: **PASS** (0 errors trên `@zalobot/api`, `@zalobot/web`, `@zalobot/contracts`).
2. `npm run lint`: **PASS** (0 errors, 0 warnings, tuân thủ 100% Zero-Any và i18n rules).
3. `npm run test --workspace=@zalobot/api`: **PASS** (74/74 unit tests passed).
4. `npm run agent-system:validate`: **PASS** (91 artifacts, 157 dependencies, 56 pairs).
