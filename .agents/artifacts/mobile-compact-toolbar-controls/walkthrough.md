# Walkthrough: Thu gọn nút tab / filter / điều hướng trên điện thoại

Plan đã duyệt: chip 32px, ô tìm kiếm/ô chọn 36px, giữ nguyên thanh tab đáy 56px.

## Đã làm

- `shared/ui/touch.ts`: thêm `PHONE_CHIP` (32px, chữ 12px), `PHONE_ICON_CHIP` (32×32), `PHONE_TOOLBAR_INPUT` (36px, full width). `TAP_CONTROL`/`TAP_INPUT` (40px) giữ cho nút thao tác.
- `PeriodFilterToolbar`: ô chọn kỳ 36px, ‹ › 32×32.
- `AppNavigation`: icon topbar mobile và link "Mở Zalo Bot" 36px. Thanh tab đáy không đổi.
- `column-filter-popover`: nút phễu 32×32; nội dung panel vẫn 40px.
- Các màn: Thu chi, Công nợ, Việc cần làm, Lời nhắc, Người liên quan, Nơi chốn, Cài đặt, Zalo & Người dùng, Phân tích, Lịch: chip/tab → `PHONE_CHIP`, ô tìm kiếm → `PHONE_TOOLBAR_INPUT`. Bỏ các bản sao `PHONE_CHIP` cục bộ (debts, settings).
- ZCA: nút phân trang "← Trước / Sau →" dùng `PHONE_CHIP` (có chữ nên không dùng nút vuông 32×32); ô sắp xếp trong hàng chip cao 32px.
- Giữ 40px: form thêm nhanh (Nơi chốn, Cài đặt), nút Tải thêm, nút trong tab Tuỳ chọn, nút Làm mới/Đăng xuất ở header ZCA, banner cảnh báo, dialog/sheet.

## Tài liệu

- Knowledge (EN) + docs (VI): `global/web-ui-direction.md` mô tả 2 tầng kích thước; cập nhật module `dashboard`, `debts`, `contacts`, `zca`, `settings`, `calendar`.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Kiểm tra

- `npm run typecheck --workspace @zalobot/web`: pass.
- `npm run lint --workspace @zalobot/web`: pass.
- Prettier check các file đổi: pass.
- `npm run test --workspace @zalobot/web`: 116/116 pass.
- `npm run build --workspace @zalobot/web`: pass; CSS build có đủ class mới (`max-[640px]:h-8`, `size-8`, `h-9`, `text-[12px]`…).
- **Chưa xem trực quan**: không chạy được API local an toàn (Postgres/Redis đang chạy thuộc project khác) nên chưa xem giao diện thật ở 375px. Cần xem lại trên prod sau khi deploy.
