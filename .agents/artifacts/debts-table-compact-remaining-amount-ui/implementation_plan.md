# Kế hoạch Tinh Giản Giao Diện Ô "Số Tiền Còn Lại" trong Bảng Công Nợ

## Bối cảnh & Vấn đề hiện tại

Hiện tại, trong cột **Số tiền còn lại** (`remainingAmount`) của `DebtsTable`, khi một khoản nợ có phát sinh thanh toán (`paidTotal > 0`), component đang hiển thị 2 dòng chữ xếp chồng dạng cột (`flex flex-col items-end`):

1. Dòng 1: Số tiền còn lại (in đậm, ví dụ: `15.000.000 ₫`)
2. Dòng 2: Dòng chữ phụ `Đã trả 3.000.000 ₫ (2 đợt)` với cỡ chữ `text-[9.5px]`.

**Hạn chế:**

- Gây đội chiều cao của dòng bảng (`<tr>`), làm mất đi tính phẳng, cô đọng chuẩn Excel-lite (chuẩn chiều cao `28px–32px` của B2B SaaS).
- Bị trùng lặp thông tin vì ở cột **Người liên quan** đã có badge `[2 đợt trả]` và nút `▶ / ▼` mở rộng Sub-panel chi tiết từng đợt.

---

## Đề xuất Giải Pháp Thiết Kế Tinh Giản

### Phương Án Lựa Chọn (Khuyến Nghị: Phương Án 1 kết hợp Micro Progress Bar hoặc Tooltip)

1. **Phương án 1 (Khuyến nghị - Single Line + Slim Progress Track + Tooltip)**:
   - Giữ hiển thị số tiền còn lại trên **1 dòng duy nhất** (`tabular-nums font-semibold`).
   - Nếu khoản nợ đã có đợt thanh toán (`paidTotal > 0`):
     - Hiển thị thanh tiến độ siêu mỏng (`h-1 w-16 rounded-full bg-slate-100 dark:bg-slate-800` với thanh fill màu xanh lá `bg-emerald-500`) nằm gọn gàng bên dưới số tiền (tương tự như cột số tiền trên bảng Thu–Chi).
     - Rê chuột (`title`) sẽ hiển thị chi tiết: `Đã trả: 3.000.000 ₫ (2 đợt) · Số tiền gốc: 18.000.000 ₫`.
   - **Ưu điểm**: Giữ nguyên chiều cao dòng chuẩn `h-8` (32px), giao diện cực kỳ trực quan, chuyên nghiệp, không chiếm diện tích ngang/dọc.

2. **Phương án 2 (Clean Single Line thuần túy + Native Tooltip)**:
   - Chỉ hiển thị duy nhất số tiền còn lại `15.000.000 ₫`.
   - Toàn bộ thông tin tiến độ trả nợ được gắn vào thuộc tính `title` khi hover.

---

## Proposed Changes

### Web Application (`apps/web`)

#### [MODIFY] [`debts-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/presentation/components/debts-table.tsx)

- Cập nhật cell renderer của cột `remainingAmount`:
  - Tính toán tỷ lệ % đã thanh toán: `paidPercent = Math.min(100, Math.round((paidTotal / originalAmount) * 100))`.
  - Hiển thị số tiền còn lại trên 1 dòng kèm thanh mini progress bar `h-1 w-16` (hoặc tooltip trực tiếp).
  - Loại bỏ chuỗi text dài chiếm dòng `Đã trả X ₫ (N đợt)`.

---

## Kế hoạch Kiểm Thử (Verification Plan)

### Automated Tests & Quality Gates

- `npm run typecheck`
- `npm run lint`
- `npm run test --workspace=@zalobot/api`
- `npm run agent-system:validate`

### Manual Verification

- Kiểm tra hiển thị cột Số tiền còn lại trên trang `/debts`:
  - Khoản nợ chưa trả đợt nào: Hiển thị số tiền phẳng 1 dòng.
  - Khoản nợ đã trả 1 phần: Hiển thị số tiền kèm thanh micro bar mỏng gọn gàng, hover hiện tooltip.
  - Khoản nợ đã tất toán (`0 ₫`): Hiển thị `0 ₫` phẳng, không bị vỡ layout.
