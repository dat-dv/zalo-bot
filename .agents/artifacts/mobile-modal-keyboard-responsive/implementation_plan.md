# Kế hoạch: Responsive cho modal & xử lý bàn phím ảo trên mobile

- Route: `implement` · Phase 1 (Planning) · Rủi ro: **MEDIUM** (nhiều file UI, không đụng API/schema/auth)
- Phạm vi: `apps/web` (shared UI, layout, global CSS, 12 modal ở các module)

## 1. Hiện trạng & nguyên nhân gốc

| # | Vấn đề | Bằng chứng | Hậu quả trên mobile |
|---|---|---|---|
| 1 | Input/select/textarea dùng cỡ chữ < 16px (`text-xs`, `text-[11px]`, body `13px`) | ~230 lần `text-xs`, 177 lần `text-[11px]` | **iOS Safari tự zoom khi focus input**, sau khi đóng bàn phím trang vẫn bị phóng to → UI "vỡ", tràn ngang |
| 2 | Overlay modal dùng `fixed inset-0 flex items-center` và panel **không có `max-height` / vùng cuộn nội bộ** | 11/12 modal (chỉ `merge-user-dialog` có `max-h-[90vh]`) | Khi bàn phím bật, viewport còn ~50% → phần đầu/cuối modal (tiêu đề, nút Lưu) bị đẩy ra ngoài màn hình, không cuộn tới được |
| 3 | Dùng `100vh` / `h-screen` | `styles.css` (`body min-height:100vh`), `app/(private)/layout.tsx` (`h-screen`), drawer nav `max-[960px]:h-screen`, `90vh` | Trên iOS `100vh` = viewport khi thanh địa chỉ ẩn, không co theo bàn phím → nhảy layout |
| 4 | Không khoá cuộn body khi mở modal | Chỉ `app-navigation.tsx` set `body.style.overflow` | Trang nền cuộn theo khi vuốt trong modal / khi bàn phím đẩy |
| 5 | Viewport chưa khai báo hành vi bàn phím | `app/layout.tsx` `viewport` thiếu `interactiveWidget` | Android Chrome chỉ resize visual viewport, `fixed` bottom bị bàn phím che |
| 6 | Mỗi modal tự viết overlay riêng (z-index lẫn lộn `z-50`, `z-[900]`, `z-[950]`), Escape/focus không đồng nhất | 12 file | Khó sửa tập trung, lỗi lặp lại |

Danh sách modal cần chuyển:
`shared/ui/data-table.tsx` (IdExplainerDialog), `zca/view/sync-media-modal.tsx`, `zca/view/thread-config-modal.tsx`, `zca/view/zca-screen.tsx` (modal inline ~L747), `zca/presentation/components/user-form-dialog.tsx`, `debts/presentation/components/combine-debts-dialog.tsx`, `contacts/presentation/components/combine-contacts-dialog.tsx`, `dashboard/presentation/components/{delete-transaction-modal, combine-places-dialog, adjust-balance-modal, debt-allocation-modal}.tsx`, `users/presentation/components/merge-user-dialog.tsx`.

## 2. Giải pháp đề xuất

### Bước 1 — Nền tảng viewport & CSS toàn cục
- `app/layout.tsx`: thêm `interactiveWidget: 'resizes-content'` vào `viewport` (Android Chrome co layout viewport khi bàn phím mở). **Giữ `maximumScale: 5`** — không dùng `maximum-scale=1` để chặn zoom vì vi phạm accessibility.
- `src/styles.css` (base layer, vẫn đúng quy ước "không có component class"):
  - `body { min-height: 100dvh; }` (giữ `100vh` làm fallback).
  - ~~Tăng input lên 16px ở mobile~~ — **anh không đồng ý, bỏ.** Giữ nguyên cỡ chữ hiện tại.
  - `html { -webkit-text-size-adjust: 100%; }` tránh iOS phóng chữ khi xoay ngang.
- **Chống iOS auto-zoom (thay thế)**: component client nhỏ `src/shared/ui/ios-viewport-fix.tsx` gắn trong `AppProviders`. Chỉ khi phát hiện iOS/iPadOS mới đổi thẻ `<meta name="viewport">` sang thêm `maximum-scale=1`.
  - iOS Safari (từ iOS 10) vẫn cho người dùng **pinch-zoom bằng tay** dù có `maximum-scale=1`, nhưng **không tự zoom khi focus input nữa** → giữ cỡ chữ nhỏ mà UI không vỡ.
  - Android/desktop không bị ảnh hưởng (vẫn `maximumScale: 5`); Android vốn không auto-zoom khi focus input.
- `app/(private)/layout.tsx`, drawer trong `app-navigation.tsx`: `h-screen` → `h-dvh`, `min-h-screen` → `min-h-dvh`.

### Bước 2 — Hook `useVisualViewportHeight` (`src/shared/hooks/use-visual-viewport.ts`)
- Lắng nghe `window.visualViewport` `resize`/`scroll`, ghi CSS var `--app-vvh` (chiều cao thật phần nhìn thấy, đã trừ bàn phím) và `--app-vv-top` lên `document.documentElement`. Fallback khi không có `visualViewport`: không set → CSS dùng `100dvh`.
- Cần cho iOS Safari (không hỗ trợ `interactive-widget`).

### Bước 3 — Primitive dùng chung `Modal` (`src/shared/ui/modal.tsx`)
API dự kiến (type tường minh, không `any`):
```tsx
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;          // vùng nút hành động, luôn dính đáy
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  closeOnBackdrop?: boolean;   // mặc định true; false khi đang submit
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;         // nội dung cuộn
}
```
Hành vi:
- Render qua `createPortal(document.body)`, một z-index thống nhất (`z-[900]`; IdExplainer trong DataTable vẫn phải nổi trên modal khác → cho prop `layer?: 'base' | 'top'`).
- Overlay: `fixed inset-x-0 top-[var(--app-vv-top,0px)] h-[var(--app-vvh,100dvh)]` → overlay luôn khớp phần nhìn thấy phía trên bàn phím.
- **Mobile (≤ 640px): bottom-sheet** — `items-end`, panel full-width, `rounded-t-xl`, `pb-[env(safe-area-inset-bottom)]`. **Desktop**: căn giữa như hiện tại.
- Panel: `flex max-h-full flex-col`; header & footer `shrink-0`; body `min-h-0 flex-1 overflow-y-auto overscroll-contain` → nút Lưu/Huỷ luôn thấy được kể cả khi bàn phím mở.
- Khi một input trong modal được focus: sau ~300ms (chờ bàn phím mở) gọi `scrollIntoView({ block: 'nearest' })` trong vùng body.
- Khoá cuộn body có đếm tham chiếu (modal lồng nhau / cùng drawer nav không mở khoá nhầm) — tách helper `lockBodyScroll()` và cho `app-navigation.tsx` dùng chung.
- Escape để đóng, `role="dialog"`, `aria-modal`, `aria-labelledby`/`aria-describedby`, trả focus về phần tử mở modal khi đóng, focus trap cơ bản (Tab vòng trong panel).

### Bước 4 — Chuyển 12 modal sang `Modal`
- Mỗi modal: thay khối overlay + header tự viết bằng `<Modal>`, chuyển nút hành động vào `footer`. **Giữ nguyên logic, state, mutation, i18n key, nội dung form** — chỉ đổi khung.
- Form dài (`thread-config-modal`, `debt-allocation-modal`, `sync-media-modal`): bỏ `my-8 overflow-y-auto` trên overlay, để body của `Modal` cuộn.
- Grid nhiều cột bên trong modal: thêm `max-sm:grid-cols-1` nơi đang tràn ngang (rà lúc chuyển).

### Bước 5 — Phần tử `fixed bottom` khác
- Toast `fixed bottom-4 right-4` ở 6 screen: thêm `bottom-[calc(1rem+env(safe-area-inset-bottom))]` và `max-sm:left-4` để không tràn/che bởi home indicator. (Không gom thành component toast — ngoài phạm vi.)

### Bước 6 — Tài liệu (Hard Completion Gate)
- `.agents/knowledge/global/web-ui-direction.md` (EN): thêm mục "Mobile dialogs & on-screen keyboard": bắt buộc dùng `shared/ui/modal.tsx`, quy tắc input ≥16px trên mobile, `dvh`/`--app-vvh`, bottom-sheet ≤640px, body scroll lock.
- `.agents/docs/global/web-ui-direction.md` (VI): giải thích lý do (iOS auto-zoom, visual viewport, vì sao không chặn zoom).
- Cập nhật `depends_on` thêm `apps/web/src/shared/ui/modal.tsx`, hook mới; cập nhật `.agents/docs/README.md` nếu cần.
- Chạy `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 3. Kiểm chứng
1. `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`, `npm run build --workspace @zalobot/web`.
2. Chạy dev server, dùng browser pane ở preset mobile (375×812): mở từng modal, kiểm tra không tràn ngang, header/footer hiển thị, body cuộn, Escape/backdrop đóng, trang nền không cuộn.
3. **Hạn chế**: browser pane không mô phỏng được bàn phím ảo iOS/Android thật & auto-zoom. Mô phỏng bằng cách thu chiều cao viewport (375×420) để kiểm layout; **anh cần test lại trên iPhone/Android thật** — em sẽ báo rõ phần chưa kiểm được.

## 4. Ngoài phạm vi
- Không đổi thiết kế/màu, không đổi nội dung form, không đụng API/contracts.
- Không responsive lại DataTable (đã có cuộn ngang) trừ khi phát hiện lỗi trực tiếp liên quan modal.
- Không thêm thư viện (Radix/Headless UI) — tự viết primitive nhỏ, đúng quy ước Tailwind-only hiện tại.

## 5. Quyết định & câu hỏi còn mở
1. ⏳ **Kiểu hiển thị modal trên mobile**: bottom-sheet (dính đáy, full-width, bo góc trên) hay căn giữa có cuộn nội bộ — chờ anh chọn sau khi đã giải thích.
2. ✅ Không tăng font input lên 16px → dùng cách chặn auto-zoom chỉ trên iOS (xem Bước 1).
3. ✅ Phạm vi chỉ gồm modal + bàn phím ảo; không thêm màn khác.
