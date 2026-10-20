# Kế hoạch: Chuyển `Modal` dùng chung sang HTML5 `<dialog>` + `showModal()`

- Route: `implement` · Phase 1 (Planning) · Rủi ro: **MEDIUM** (đổi primitive dùng chung cho 12 modal, không đụng API/schema/auth)
- Tiếp nối task `mobile-modal-keyboard-responsive` (commit `136b305`).

## 1. Hiện trạng

`apps/web/src/shared/ui/modal.tsx` render `div[role=dialog]` qua `createPortal(document.body)` và tự làm mọi thứ:

| Việc | Đang tự làm bằng tay |
|---|---|
| Thứ tự lớp | z-index `z-[900]` / `z-[950]` (prop `layer`) |
| Chặn tương tác nền | Không chặn thật: phần nền vẫn focus/đọc được bằng screen reader, chỉ có nền mờ phủ lên |
| Giữ focus | Tự bắt phím Tab (`FOCUSABLE_SELECTOR`) |
| Escape | Lắng nghe `keydown` toàn document + stack `openStack` |
| Nền mờ | `div` absolute riêng |
| Trả focus | Tự lưu `previouslyFocused` |

12 modal đều đi qua `Modal`, nên chỉ cần đổi `modal.tsx`, **không phải sửa 12 file gọi**.

## 2. Thiết kế mới

### 2.1 Cấu trúc
```tsx
<dialog
  ref={dialogRef}
  aria-labelledby / aria-describedby / aria-label
  role={role === 'alertdialog' ? 'alertdialog' : undefined}
  onCancel={handleCancel}        // Escape
  onClick={handleBackdropClick}  // click ra nền (target === dialog)
  className="... reset UA styles ... sheet/center layout ..."
>
  <div ref={panelRef} className={`... ${panelClassName}`}>{children}</div>
</dialog>
```
- Mở/đóng: `useEffect` theo `open` → `dialog.showModal()` / `dialog.close()`. Không render khi `!open` (giữ hành vi unmount hiện tại để state form reset như cũ).
- **Bỏ `createPortal`**: `showModal()` đưa dialog lên *top layer* nên không bị `overflow`/`transform` của cha cắt và luôn nằm trên mọi z-index.

### 2.2 Native thay thế phần tự viết
| Bỏ | Thay bằng |
|---|---|
| Prop `layer`, `LAYER_CLASS`, z-index | Top layer: dialog mở sau tự nằm trên dialog mở trước (IdExplainer chồng lên modal khác vẫn đúng) |
| Tự bắt Tab + `FOCUSABLE_SELECTOR` | `showModal()` làm phần còn lại của trang trơ (`inert`), Tab không lọt ra ngoài |
| `keydown` Escape + `openStack` | Sự kiện `cancel` (chỉ dialog trên cùng nhận). Nếu không có `onDismiss` (đang submit) thì `event.preventDefault()` để không đóng |
| `div` nền mờ | `::backdrop` (Tailwind `backdrop:` variant), `backdropClassName` → map sang class `backdrop:*` |
| Trả focus thủ công | Trình duyệt tự trả focus về phần tử đã mở khi `close()` |

### 2.3 Giữ nguyên (native không lo)
- `useBodyScrollLock`: `<dialog>` không khoá cuộn trang, đặc biệt trên iOS.
- `useVisualViewportVars` + `--app-vvh` / `--app-vv-top`: dialog vẫn phải co theo phần màn hình phía trên bàn phím ảo.
- Bottom-sheet < 640px, sticky header/footer (`MODAL_STICKY_HEADER` / `MODAL_STICKY_FOOTER`), panel tự cuộn, tự cuộn input vào tầm nhìn sau 300ms.
- Focus vào panel (không vào input) khi mở: `showModal()` mặc định focus phần tử focusable đầu tiên, **có thể là input → bật bàn phím**. Xử lý: đặt `autoFocus` lên panel (`tabIndex={-1}`), hoặc focus panel ngay sau `showModal()`.

### 2.4 Reset style mặc định của `<dialog>`
UA stylesheet có `margin:auto`, `max-width/max-height: calc(100% - 2em - 6px)`, `border`, `padding`, `background`, `color`, `inset`. Dialog sẽ dùng:
`fixed inset-x-0 top-[var(--app-vv-top,0px)] m-0 h-[var(--app-vvh,100dvh)] max-h-none w-full max-w-none border-0 bg-transparent p-4 text-inherit flex items-center justify-center max-sm:items-end max-sm:p-0 max-sm:pt-6`
(chỉ áp `flex` khi `[open]`, vì UA đặt `dialog:not([open]) { display:none }` — dùng `open:flex`).
- Click vào vùng padding trong suốt quanh panel = click lên chính `<dialog>` → coi là click ra nền.
- Dark mode: kiểm `color-scheme` không làm nền dialog chuyển trắng.

### 2.5 API `Modal` thay đổi
- **Bỏ** prop `layer` (chỉ `data-table.tsx` dùng `layer="top"` → xoá prop đó ở 1 chỗ).
- Giữ nguyên các prop còn lại (`open`, `onDismiss`, `dismissOnBackdrop`, `labelledBy`, `describedBy`, `ariaLabel`, `role`, `panelClassName`, `backdropClassName`, `children`) → 11 file còn lại không đổi.

### 2.6 Các thành phần nổi khác bị ảnh hưởng bởi top layer
Top layer nằm trên mọi z-index, nên thứ gì portal ra `body` sẽ bị dialog che:
- **`CategoryAutocomplete`** (`createPortal(document.body)`, `z-[1000]`): hiện chỉ dùng trong `transactions-table.tsx` (sửa inline, không trong modal) nên chưa lỗi. Vẫn sửa để an toàn về sau: portal vào `inputRef.current.closest('dialog') ?? document.body`. Menu `position: fixed` bên trong dialog vẫn đúng toạ độ viewport. Hạ z-index về lại `z-[100]`.
- **Toast** (`fixed z-50` / `z-[1000]` ở 9 màn): nếu toast hiện *trong lúc* modal còn mở sẽ bị che. Rà lúc làm: các luồng hiện tại bắn toast sau khi modal đóng (`onSuccess` → `onClose`). Nếu có chỗ toast hiện khi modal còn mở, ghi vào báo cáo, **không sửa trong task này** (cần một toast system dùng chung — ngoài phạm vi).
- `chat-row-menu.tsx` (`fixed z-40`): không nằm trong modal, không ảnh hưởng.

## 3. Các bước
1. Viết lại `src/shared/ui/modal.tsx` theo 2.1–2.5 (giữ `MODAL_STICKY_*`, hai hook).
2. Xoá `layer="top"` trong `src/shared/ui/data-table.tsx`.
3. `src/shared/ui/category-autocomplete.tsx`: portal vào dialog gần nhất, z-index về `z-[100]`.
4. Docs: cập nhật mục "Mobile Dialogs & On-Screen Keyboard" trong `.agents/knowledge/global/web-ui-direction.md` (EN) và mục tương ứng trong `.agents/docs/global/web-ui-direction.md` (VI): native `<dialog>`/top layer, bỏ `layer`, quy tắc portal vào dialog.

## 4. Kiểm chứng
- `npm run typecheck`, `npm run build` (workspace web), ESLint các file sửa.
- `node .claude/hooks/docs-drift-check.mjs` = 0.
- Browser với static build, modal QR ở `/zca`:
  - 375×812: bottom-sheet; 375×380: header/footer còn thấy, giữa cuộn; 1280×800: căn giữa.
  - Escape đóng; Tab không thoát ra trang nền; focus trở về nút "Quét mã QR" khi đóng; mở modal không tự focus input.
  - Kiểm `document.querySelector('dialog').matches(':modal')` và phần nền có thuộc tính trơ.
- **Hạn chế**: bàn phím thật / iOS chỉ test được trên máy thật. Các modal cần dữ liệu không mở được khi không có token.

## 5. Rủi ro
- **Trình duyệt**: `<dialog>`/`showModal()` cần Safari ≥ 15.4 (03/2022), Chrome ≥ 37. Máy iOS cũ hơn modal sẽ không mở. Không thêm polyfill.
- **iOS Safari + bàn phím trong top layer**: dialog `position: fixed` trong top layer có thể bị Safari đẩy khi bàn phím mở. Nếu test thấy nhảy layout, vẫn dùng `--app-vv-top` để bù như hiện tại.
- Rollback dễ: chỉ 3 file code, revert một commit.

## 6. Ngoài phạm vi
- Không xây toast system dùng chung, không đổi nội dung 12 modal.
