# Walkthrough: Tinh Giản Giao Diện Ô "Số Tiền Còn Lại" trong Bảng Công Nợ

Đã hoàn thành việc tinh giản giao diện ô **Số tiền còn lại (`remainingAmount`)** trong **Bảng Công Nợ (`DebtsTable`)** theo phong cách B2B SaaS Excel-lite phẳng, chuẩn chiều cao `h-8` (32px).

---

## 1. Những Thay Đổi Cụ Thể

### Bảng Công Nợ Chính (`DebtsTable`)

- **Hiển thị phẳng 1 dòng duy nhất**: Loại bỏ dòng chữ phụ chiếm diện tích `Đã trả X ₫ (N đợt)`.
- **Slim Micro Progress Bar (`h-1 w-16`)**:
  - Với các khoản nợ có phát sinh thanh toán dở dang (`paidTotal > 0 && remainingAmount > 0`), hiển thị thanh tiến độ siêu mỏng (`h-1 w-16 rounded-full bg-slate-100 dark:bg-slate-800` với thanh fill màu xanh lá `bg-emerald-500`) nằm gọn gàng bên dưới số tiền.
  - Tỷ lệ fill thanh bar tự động tính theo % đã trả: `Math.round((paidTotal / originalAmount) * 100)%`.
- **Tooltip Hover Toàn Diện**:
  - Thuộc tính `title` hiển thị chi tiết khi rê chuột: `Đã trả X ₫ (N đợt)`.
- **Khoản nợ đã tất toán (`0 ₫`)**:
  - Hiển thị số tiền `0 ₫` phẳng màu nhạt (`text-slate-400 dark:text-slate-500`), không chèn thanh bar thừa.

### Bảng Khoản Nợ Con trong Sub-panel (`renderExpandedRow`)

- Đồng bộ cơ chế hiển thị số tiền còn lại và micro progress bar `h-1 w-14` cho các khoản nợ con trong Sub-panel mở rộng.

---

## 2. Kết Quả Kiểm Thử & Quality Gates

1. `npm run typecheck`: **PASS** (0 errors trên toàn bộ monorepo).
2. `npm run lint`: **PASS** (0 errors, 0 warnings).
3. `npm run test --workspace=@zalobot/api`: **PASS** (74/74 unit tests passed).
4. `npm run agent-system:validate`: **PASS** (91 artifacts, 157 dependencies, 56 pairs).
