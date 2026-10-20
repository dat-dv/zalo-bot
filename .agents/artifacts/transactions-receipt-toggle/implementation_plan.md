# Implementation Plan: Nút bật/tắt hiển thị ảnh hoá đơn ở header cột "Ảnh" (trang Transactions)

Trạng thái: **đã duyệt & đã thực hiện** (chưa kiểm tra trên trình duyệt, chưa commit) · Rủi ro: **MEDIUM** (UI nhiều file, không đổi API/schema)

## 1. Hiện trạng
- `transactions-table.tsx` cột `receipt` (header `dashboard.columns.receipt`, `minWidth 60px`) render `ReceiptThumbnail` (`transaction-receipt.tsx`): mỗi dòng có hoá đơn hiển thị một ô ảnh **32×32 crop** (`object-cover`), bấm mở modal xem ảnh lớn.
- Vấn đề: ô 32px cắt ảnh hoá đơn (ảnh dọc, nhiều chữ) nên nhìn không ra gì, làm bảng lổn nhổn; đồng thời **mỗi dòng đều tải ảnh** qua proxy `GET /api/transactions/:id/receipt` (Drive/CDN) dù người dùng không cần xem.

## 2. Đề xuất (theo ý anh)
- **Mặc định (tắt)**: ô của dòng có hoá đơn chỉ là một nút icon nhỏ gọn (🧾, có `title`/`aria-label` "Xem ảnh hoá đơn"), **không tải ảnh**; bấm vẫn mở modal xem ảnh như hiện nay. Dòng không có hoá đơn để trống ("—" mờ như cũ).
- **Header cột "Ảnh"**: thêm nút bật/tắt cạnh chữ "Ảnh" (icon 🖼 / 👁, `aria-pressed`, tooltip "Hiện ảnh" / "Ẩn ảnh").
- **Bật**: mọi dòng có hoá đơn hiển thị ảnh xem trước **không crop** (`object-contain`, cao ~64px, rộng tối đa ~96px, nền xám nhạt), bấm vào mở modal ảnh lớn. Cột tự rộng ra (`minWidth` ~110px khi bật).
- Trạng thái bật/tắt **không lưu** qua F5 (giống nút ẩn/hiện số tiền): mỗi lần tải trang mặc định tắt để không tự tải hàng loạt ảnh.
- Bấm nút header không kích hoạt sort/chọn dòng (`stopPropagation`).

## 3. Thay đổi file
1. `apps/web/src/modules/dashboard/presentation/components/transaction-receipt.tsx`
   - Tách modal hiện có thành `ReceiptDialog` dùng chung.
   - `ReceiptThumbnail` nhận prop `showPreview: boolean`: `false` → nút icon; `true` → ảnh xem trước `object-contain` (dùng `ReceiptImage`, lazy, có trạng thái lỗi sẵn có).
   - Thêm `ReceiptColumnHeader({ showPreview, onToggle })`: chữ "Ảnh" + nút toggle.
2. `apps/web/src/modules/dashboard/presentation/components/transactions-table.tsx`
   - `useState(false)` cho `showReceiptPreview`; cột `receipt` dùng `header: <ReceiptColumnHeader …/>`, `label: t('dashboard.columns.receipt')` (để menu ẩn/hiện cột vẫn có tên), `minWidth` theo trạng thái; thêm state vào deps của `useMemo` columns.
3. `packages/contracts/src/index.ts`: i18n (vi + en) `transactions.receipt.showAll` ("Hiện ảnh hoá đơn" / "Show receipt images"), `transactions.receipt.hideAll` ("Ẩn ảnh hoá đơn" / "Hide receipt images").
4. Tài liệu: `.agents/knowledge/modules/dashboard/README.md` (EN) + `.agents/docs/modules/dashboard/README.md` (VI) mô tả hành vi cột Ảnh mới.

## 4. Ngoài phạm vi
- Panel chi tiết (Master-Detail) vẫn hiển thị ảnh như cũ.
- Không đổi API proxy ảnh.

## 5. Kiểm chứng
- `npm run typecheck`, `npm run lint --workspace @zalobot/web`, `npm run test --workspace @zalobot/web`, `npm run build --workspace @zalobot/web`.
- Chạy web local, kiểm tra trên trình duyệt: mặc định không có request `/receipt`; bật → ảnh hiện không crop, bấm mở modal; tắt → về icon; mobile 375px không tràn ngang; dark mode.
- `node .claude/hooks/docs-drift-check.mjs` → PASS.
