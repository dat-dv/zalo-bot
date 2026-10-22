# Implementation plan: Sửa tràn ngang trong modal Cấu hình (`ThreadConfigModal`)

- Route: implement · Phase 1 (chờ duyệt)
- Rủi ro: **THẤP–TRUNG BÌNH**: chỉ đổi class Tailwind trong 1 file, không đụng logic, API, contracts hay dữ liệu.
- File: `apps/web/src/modules/zca/view/thread-config-modal.tsx` (duy nhất)
- Bối cảnh: xem `investigation.md` (phần đính chính).

## Nguyên nhân chung

Panel của `Modal` có `overflow-y-auto`, nên chiều ngang cũng thành `auto`: con nào rộng hơn panel sẽ làm panel hiện thanh cuộn ngang. Nhiều hàng `flex justify-between` trong modal:

- khối chữ không có `min-w-0`: flex item mặc định `min-width: auto`, nên không co nhỏ hơn chuỗi dài nhất không ngắt được;
- `<code>` và ID dài (tên nhóm, ID số) không có điểm ngắt dòng;
- nút gạt (toggle) và nút hành động không có `shrink-0`, nên bị ép méo khi chữ dài.

## Thay đổi

### 1. Header (dòng ~152–185)

| Phần tử | Hiện tại | Sửa thành |
| --- | --- | --- |
| Hàng ngoài | `flex items-center justify-between … p-4` | thêm `gap-3` |
| Khối avatar + chữ (153) | `flex items-center gap-3` | thêm `min-w-0` |
| Avatar (154) | `flex size-10 …` | thêm `shrink-0` |
| Khối chữ (157) | `<div>` | `<div className="min-w-0">` |
| Hàng tên + badge (158) | `flex items-center gap-2` | thêm `min-w-0` |
| `<h3>` tên (159) | `text-base font-bold …` | thêm `truncate` và `title={threadName}` |
| Badge Nhóm/Cá nhân | `inline-flex …` | thêm `shrink-0` |
| ID (172) | `text-xs font-mono text-slate-400` | thêm `break-all` |
| Nút ✕ | `rounded p-1 …` | thêm `shrink-0` |

### 2. Banner Album Google Photos (dòng ~398–420)

Làm cho giống banner Drive ngay phía trên (đã có `flex-wrap`):

| Phần tử | Hiện tại | Sửa thành |
| --- | --- | --- |
| Hàng ngoài (398) | `flex items-center justify-between …` | thêm `flex-wrap gap-2` |
| Khối icon + chữ (399) | `flex items-center gap-2.5` | thêm `min-w-0` |
| Khối chữ (401) | `<div>` | `<div className="min-w-0">` |
| Hàng nhãn (402) | `flex items-center gap-2` | thêm `flex-wrap` |
| `<code>` tên album (406) | không ngắt | thêm `break-all` |
| Nút "Mở Google Photos" | `inline-flex …` | thêm `shrink-0` |

Banner Drive (369–395): chỉ thêm `min-w-0` cho khối 370/372 và `break-all` cho `<code>` 377. Nhãn này gồm đường dẫn `zalobot/<channelId>`, nên dài khi ID dài.

### 3. Các hàng bật/tắt (8 hàng)

Áp dụng cho các hàng tại dòng **190** (Master), **213** (Tương tác trực tiếp), **255** (Chit-chat), **285** (Self-listen), **335** (Drive), **503**, **610**, **698** (các nhóm tính năng còn lại):

- Hàng ngoài `flex items-center justify-between`: thêm `gap-3`.
- Khối chữ bên trái (`<div>` hoặc `flex items-center gap-2`): thêm `min-w-0`; với khối có icon thì `<div>` chữ bên trong cũng thêm `min-w-0`.
- `<label className="relative inline-flex …">` chứa toggle: thêm `shrink-0`.

Mô tả dài sẽ tự xuống dòng thay vì đẩy toggle ra mép hoặc làm méo toggle.

### Không thay đổi

- Không đổi bo góc (giữ `rounded-xl`, `rounded-lg`, `rounded`, theo memory "keep small radius": không tăng, không đồng bộ lại).
- Không đổi màu, nội dung, logic form, `Modal` dùng chung, hay các modal khác.
- Không cần cập nhật `.agents/knowledge` hay `.agents/docs`: đây là sửa lỗi hiển thị, hành vi nghiệp vụ không đổi.

## Kiểm chứng

1. `npm run typecheck --workspace @zalobot/web`
2. `npm run lint --workspace @zalobot/web`
3. Thủ công (cần dev server web và phiên đăng nhập của anh): `/zca`, mở **Cấu hình** cho một nhóm có tên dài và ID dài, bật Drive và các tính năng con:
   - desktop (≥ 640px) và mobile 375px (bottom sheet): không có thanh cuộn ngang trong panel;
   - tên dài bị cắt `…` ở header, nút ✕ luôn hiện;
   - nhãn album/thư mục xuống dòng, nút "Mở Google Photos/Drive" xuống hàng khi thiếu chỗ;
   - toggle giữ kích thước, mô tả tự xuống dòng.
   - Kiểm tra nhanh trong console: `panel.scrollWidth <= panel.clientWidth`.

Nếu không có phiên đăng nhập, tôi chỉ chạy được bước 1–2 và sẽ ghi rõ là bước 3 chưa kiểm chứng.

## Rollback

Revert 1 commit; chỉ có thay đổi class CSS.
