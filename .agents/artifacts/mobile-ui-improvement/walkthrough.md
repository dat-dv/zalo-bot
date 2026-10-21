# Walkthrough: Mobile UI giai đoạn A (Thu chi)

- Plan đã duyệt: [implementation_plan.md](implementation_plan.md) · Ngày: 2026-10-21

## Đã làm

### A1. DataTable dạng danh sách (≤ 640px, opt-in)
- Mới: `shared/hooks/use-media-query.ts` (`useMediaQuery`, `MOBILE_MEDIA_QUERY`), `shared/ui/data-table-mobile.ts` (`partitionMobileColumns`, `supportsMobileList`) kèm spec, và `shared/ui/data-table-mobile-list.tsx` (dòng hai tầng + bảng trượt chi tiết).
- `data-table.tsx`:
  - Cột có thêm `mobileSlot`, `mobileCell`, `mobileHeader`. Bảng có thêm prop `mobileList` (mặc định `true`, chỉ có tác dụng khi cột khai báo slot).
  - Nhánh mobile bỏ STT/ID, cài đặt cột, resize và khung cuộn 520px. `IdExplainerDialog` dùng chung cho cả hai nhánh.
- `transactions-table.tsx`:
  - Khai báo slot: note là primary, amount là trailing, còn category · ngày · người tạo · nơi chốn là secondary.
  - Các cột có bộ lọc thêm `mobileHeader`.
  - Nút thao tác và input khi sửa cao 40px trên mobile.
  - Prop `mobileList` mặc định `false`. Chỉ `transactions-screen.tsx` bật, còn Tổng quan giữ nguyên bảng.

### A2. Gộp header
- `workspace-header.tsx`: tách hook `useWorkspaceHeader()`. `WorkspaceHeader` thêm `max-[960px]:hidden`.
- `app-navigation.tsx`:
  - Topbar mới `[☰] [tên trang] [ẩn/hiện số tiền] [làm mới]`, mỗi nút 40px; khi chưa đăng nhập hiện "Mở Zalo Bot".
  - Đăng xuất chuyển vào chân drawer.
  - Link, nút giao diện và ô chọn ngôn ngữ trong drawer cao 40px.

### A3. Vùng chạm ≥ 40px
- `transactions-screen.tsx`: chip lọc thành một hàng cuộn ngang; ô tìm kiếm và nút "Tải thêm" cao 40px.
- `period-filter-toolbar.tsx`: nút kỳ và mũi tên cao 40px, nhóm nút kỳ cuộn ngang khi thiếu chỗ.
- `column-filter-popover.tsx`: nút lọc 40px trên mobile (chỉ Thu chi dùng).
- Bo góc giữ nguyên, không thêm phần tử bo tròn.

### i18n và tài liệu
- `packages/contracts`: thêm key `table.rowDetails` (vi/en).
- Cập nhật `knowledge/global/web-ui-direction.md`, `docs/global/web-ui-direction.md`, `knowledge/modules/dashboard/README.md` và `docs/modules/dashboard/README.md`.

## Xác minh

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run typecheck` (contracts, web) | ✅ |
| `npm run test --workspace @zalobot/web` | ✅ 36/36 (gồm 4 test mới) |
| `npm run build --workspace @zalobot/web` | ✅ static export |
| ESLint các file đã sửa | ✅ |
| `npm run lint --workspace @zalobot/web` (toàn bộ) | ❌ 1 lỗi **có sẵn, không thuộc thay đổi này**: `SyncThreadMediaResponse` khai báo mà không dùng ở `modules/zca/api/zca-query.ts:25`, liên quan phần ZCA đang sửa dở trong working tree |
| `node .claude/hooks/docs-drift-check.mjs` | ✅ PASS |
| Kiểm tra trực quan 375px / desktop | ⚠️ **Chưa làm**: máy chưa chạy được API + Postgres + Redis, nên trang Thu chi không có dữ liệu để xem |

## Rủi ro còn lại
- Chưa thấy tận mắt: chiều cao thực tế, hành vi sửa trong bảng trượt khi bàn phím mở trên iOS/Android, và dải lọc cột.
- Lần render đầu trên mobile dùng nhánh desktop rồi mới chuyển sang danh sách (một frame, lúc dữ liệu vẫn đang tải).
- Nút ▶ mở rộng trong ô Ghi chú vẫn xuất hiện trong bảng trượt, dù khối chi tiết đã luôn hiện. Bấm vào không gây hại nhưng thừa.
