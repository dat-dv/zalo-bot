# Walkthrough: Sửa tràn ngang trong modal Cấu hình (`ThreadConfigModal`)

Plan: `implementation_plan.md` (đã duyệt). File đổi: `apps/web/src/modules/zca/view/thread-config-modal.tsx`.

## Đã làm

1. **Header**: thêm `gap-3`; khối avatar + chữ và hàng tên có `min-w-0`; tên nhóm có `truncate` kèm `title`; ID có `break-all`; avatar, badge Nhóm/Cá nhân và nút ✕ có `shrink-0`.
2. **Banner Photos**: thêm `flex-wrap gap-2` (giống banner Drive), cho khối chữ `min-w-0`, cho hàng nhãn `flex-wrap`, cho `<code>` tên album `break-all`, cho nút "Mở Google Photos" `shrink-0`.
3. **Banner Drive**: cho khối chữ `min-w-0`, `<code>` `break-all`, nút `shrink-0`.
4. **8 hàng bật/tắt**: thêm `gap-3` cho hàng; khối chữ (và khối chữ lồng trong khối có icon) có `min-w-0`; `<label>` toggle có `shrink-0`. Thay đổi làm bằng script, script kiểm tra đúng 8/8/8 vị trí.
5. Hook prettier tự định dạng lại một dòng import và một `onChange` trong cùng file. Logic không đổi.

Không đổi: bo góc, màu, nội dung chữ, logic form, `Modal` dùng chung.

## Kiểm chứng

- `npm run typecheck --workspace @zalobot/web`: pass.
- `npm run lint --workspace @zalobot/web`: pass.
- Trang tĩnh trong scratchpad dùng đúng class cũ/mới (Tailwind v4 browser build), tên nhóm, ID và tên album dài, viewport 375px:
  - trước khi sửa: panel `scrollWidth` 765 so với `clientWidth` 373, tức là tràn ngang;
  - sau khi sửa: `scrollWidth` 373 bằng `clientWidth` 373, không tràn; toggle giữ đủ 28px.
- **Chưa kiểm chứng** trên dashboard thật: không có dev server web và phiên đăng nhập.

## Tài liệu

Hành vi nghiệp vụ không đổi, nhưng drift check yêu cầu cập nhật tài liệu khi code module `zca` đổi. Vì vậy đã ghi quy tắc bố cục "không tràn ngang" của `ThreadConfigModal` thành yêu cầu UI:

- `.agents/knowledge/modules/zca/README.md` (EN)
- `.agents/docs/modules/zca/README.md` (VI, mục Modal Cấu hình Kênh)

`node .claude/hooks/docs-drift-check.mjs`: PASS.
