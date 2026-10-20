# Walkthrough: Modal dùng `<dialog>` native

## Đã làm
- `apps/web/src/shared/ui/modal.tsx` viết lại trên `<dialog>` + `showModal()`:
  - Bỏ `createPortal`, z-index, prop `layer`, tự bắt Tab, stack Escape.
  - Escape qua sự kiện `cancel`: luôn `preventDefault` rồi gọi `onDismiss`. Nếu trình duyệt vẫn ép đóng thì `close` gọi dismiss hoặc mở lại.
  - Panel gắn `autofocus` → mở modal không focus input.
  - Trả focus về nút đã mở modal (tự làm, vì React gỡ `<dialog>` trước cleanup khi `open` đổi trên Modal luôn được render — phát hiện lúc test).
  - Giữ: khoá cuộn trang, `--app-vvh`, bottom-sheet, sticky header/footer, cuộn input vào tầm nhìn.
- **Khác plan**: nền mờ vẫn là `div` bên trong (`backdropClassName`), `::backdrop` để trong suốt. Lý do: Tailwind chỉ sinh class `backdrop:*` khi chuỗi class có sẵn trong source, không ghép prefix lúc runtime được; giữ `div` thì API `backdropClassName` của 12 modal không đổi.
- `data-table.tsx`: bỏ `layer="top"`.
- `category-autocomplete.tsx`: portal vào `closest('dialog') ?? document.body`, z-index về `z-[100]`.
- Docs `global/web-ui-direction` (EN + VI) cập nhật.

## Kiểm chứng
- Typecheck, build web: pass. ESLint 3 file sửa: sạch. `docs-drift-check`: PASS.
- Browser (static build, modal QR `/zca`):
  - 375×812: `dialog:modal` = true, bottom-sheet như cũ, focus vào panel, body khoá cuộn.
  - Tab 7 lần: focus vẫn trong dialog.
  - 375×380: dialog cao 380px, header/footer còn thấy, giữa cuộn.
  - Escape và nút "Đóng": đóng, mở khoá cuộn, focus về "Quét mã QR đăng nhập".
  - 1280×800: căn giữa.

## Chưa kiểm / lưu ý
- iPhone/Android thật (bàn phím, top layer trên iOS Safari).
- Modal cần dữ liệu không mở được khi không có token.
- Toast hiện trong lúc modal còn mở sẽ bị che (top layer). Các luồng hiện tại đóng modal trước khi bắn toast; chưa rà từng luồng.
