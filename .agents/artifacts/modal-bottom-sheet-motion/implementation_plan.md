# Kế hoạch: animation bottom sheet kiểu "Modal Bottom Sheet"

Rủi ro: THẤP (chỉ đổi motion/hiển thị của `Modal` trên điện thoại, không đụng dữ liệu/API). Plan inline, anh đã yêu cầu làm xong thì commit + push.

## Hiện trạng / nguyên nhân

Đo trên prod (375×812, sheet "Thêm"):

1. `<dialog>` dùng `overflow: hidden` nên vẫn là **scroll container**. Lúc sheet bắt đầu ở `translateY(100%)`, `scrollHeight` của dialog là 1513px (812 + 701). WebKit có thể cuộn dialog để lộ panel đang được focus (`autofocus`), rồi khi transform thu lại thì `scrollTop` bị kẹp về 0 → sheet vọt lên rồi tụt xuống.
2. `useVisualViewportVars` chỉ đặt `--app-vvh` / `--app-vv-top` trong `requestAnimationFrame` **sau** khi sheet đã bắt đầu chạy. Frame đầu dialog cao `100dvh`, frame sau mới là chiều cao visual viewport. Trên PWA iOS hai giá trị này lệch nhau, nên sheet (neo đáy) bị giật vị trí giữa chừng.
3. Đường cong `cubic-bezier(0.32, 0.72, 0, 1)` dồn phần lớn quãng đường vào ~120ms đầu, nhìn như sheet "bật" lên.

## Thay đổi

- `apps/web/src/shared/hooks/use-visual-viewport.ts`: đặt biến CSS **đồng bộ** trong `useLayoutEffect` ngay khi bật (trước paint, trước `showModal()`); rAF chỉ dùng cho các sự kiện resize/scroll sau đó.
- `apps/web/src/shared/ui/modal.tsx`: dialog dùng `overflow: clip` (fallback `hidden` khi trình duyệt không hỗ trợ) để không thể bị cuộn; backdrop/sheet dùng đường cong mới.
- `apps/web/src/shared/ui/motion.ts`: motion kiểu Material "Modal Bottom Sheet": vào 350ms `cubic-bezier(0, 0, 0.2, 1)` (decelerate, đi đều rồi chậm dần, không vọt), ra 250ms `cubic-bezier(0.4, 0, 1, 1)` (accelerate). Backdrop mờ cùng thời lượng/đường cong. Thẻ desktop giữ nguyên.
- Docs: `.agents/knowledge/global/web-ui-direction.md` + `.agents/docs/global/web-ui-direction.md` cập nhật mục Modal motion.

## Kiểm tra

- `npm run typecheck`, `npm run lint`, `npm run test` (workspace web).
- Kiểm tra hình học dialog trên prod bằng JS (dev server local không khởi động được trong sandbox). Cảm giác trên iPhone thật cần anh xác nhận sau khi deploy.
