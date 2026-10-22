# Kế hoạch: UX mobile — dialog, bottom sheet, filter công nợ, quick links dashboard, nhớ tab lịch

Rủi ro: **MEDIUM** (nhiều file web, đổi hành vi UI mobile; không đụng API/DB/auth). Cần cập nhật knowledge + docs.

Lưu ý: `apps/web/src/styles.css` đang có thay đổi chưa commit của task `mobile-date-input-overflow` — giữ nguyên, không đụng.

---

## 1. Footer dialog toàn màn hình bị đẩy lên (Thêm khoản nợ, …)

**Nguyên nhân** (`shared/ui/modal.tsx`, `shared/ui/form-dialog.tsx`): với `phoneLayout="fullscreen"`, panel cao `h-full` và là flex column, nhưng nội dung nằm trong `<form>` là block thường. Footer chỉ `sticky bottom-0` — sticky chỉ dính đáy khi nội dung **dài hơn** màn hình; form ngắn (Thêm khoản nợ) thì footer nằm ngay sau field cuối, giữa màn hình.

**Sửa (một chỗ, áp dụng cho mọi dialog toàn màn hình)**:
- `MODAL_STICKY_FOOTER` = `sticky bottom-0 z-10 mt-auto` → footer là con trực tiếp của panel (sync-media, calendar-event-sheet) bị đẩy xuống đáy.
- Panel fullscreen thêm `max-sm:[&>form]:flex max-sm:[&>form]:flex-[1_0_auto] max-sm:[&>form]:flex-col` → form giãn hết chiều cao, footer bên trong form (FormDialog: thêm khoản nợ / việc / nhắc lịch; combine-debts, combine-contacts, debt-allocation) cũng dính đáy.
- Desktop và bottom sheet thường không đổi (panel không có chiều cao cố định nên `mt-auto` không có tác dụng). Khi form dài, footer vẫn sticky trên bàn phím như hiện tại.

## 2. Bottom sheet không khoá scroll trang

**Nguyên nhân** (`shared/hooks/use-body-scroll-lock.ts`): khoá hiện tại chỉ đặt `overflow: hidden` lên `html`/`body`. Trên iOS Safari/PWA, cử chỉ chạm trên backdrop hoặc trên sheet có nội dung không đủ dài để tự scroll vẫn bị "chain" ra trang phía sau → trang cuộn dưới sheet. (Chromium tôn trọng `overflow: hidden` nên browser pane không tái hiện được.)

**Sửa**:
- Khoá kiểu "body fixed" (cách chuẩn cho iOS) trong lần khoá đầu tiên (giữ ref-count): lưu `window.scrollY`, đặt `body { position: fixed; top: -scrollY; left: 0; right: 0; width: 100% }` + giữ `overflow: hidden`; khi mở khoá lần cuối: trả style cũ và `window.scrollTo(0, scrollY)` → trang đứng yên đúng chỗ, không nhảy về đầu.
- Backdrop của `Modal` thêm `touch-none` để chạm/kéo trên vùng tối không cuộn được gì.
- Desktop: trang không scroll ở document (`main h-dvh overflow-hidden`) nên `scrollY = 0`, không ảnh hưởng. `isDocumentScrollLocked` (pull-to-refresh) giữ nguyên.

## 3. Chữ trong select không đều với button (sheet "Thêm")

**Nguyên nhân**: footer của More sheet (`shared/ui/app-navigation.tsx`) có nút giao diện `text-xs` (12px) cạnh `<select>` ngôn ngữ cũng `text-xs`, nhưng rule chống zoom iOS trong `styles.css` ép mọi `select` trên màn cảm ứng lên **16px `!important`** → select to hơn hẳn nút. Không thể hạ select dưới 16px (iOS sẽ zoom khi chạm).

**Sửa**: thay `<select>` ngôn ngữ trong More sheet bằng nhóm 2 nút phân đoạn `Tiếng Việt | English` (lặp theo `SUPPORTED_LOCALES`, cao 40px, `text-xs` như nút giao diện, nút đang chọn tô đậm, `aria-pressed`, nhóm `aria-label={t('common.language')}`). Bỏ luôn ép kiểu `as typeof locale`. Select ngôn ngữ ở sidebar desktop giữ nguyên.

## 4. Filter công nợ trên mobile bị scroll ngang

**Hiện tại** (`modules/debts/presentation/components/debts-screen.tsx`): ≤ 640px, 3 chip trạng thái + 3 chip luồng + chip chọn tất cả dồn vào **một hàng cuộn ngang** (`MOBILE_TOOLBAR_ROW`), "Đã tất toán" thường bị khuất.

**Sửa (chỉ ≤ 640px, desktop giữ pill như cũ)**:
- Hàng 1 — **Trạng thái**: control phân đoạn `grid grid-cols-3`: `Tất cả` / `Đang mở` / `Đã tất toán`.
- Hàng 2 — **Luồng**: `grid grid-cols-3`: `Tất cả` / `Cho vay` / `Đi vay`.
- Hàng 3 — ô tìm kiếm full width (như cũ).
- Chip `Chọn tất cả` / `Đã chọn N ✕`: hàng riêng `flex flex-wrap`, không cuộn.
- Nút cao 40px, chữ 12.5px căn giữa, `rounded-[3px]` (không đổi bo góc). Trên phone dùng nhãn ngắn `table.filter.all` ("Tất cả") thay cho "Tất cả trạng thái"/"Tất cả luồng" (đã nằm trong nhóm nên đủ nghĩa); desktop giữ nhãn dài. Thêm `aria-pressed` cho các nút lọc.
- Bỏ mẹo `display: contents` + `MOBILE_TOOLBAR_ROW` ở màn này.

## 5. Quick links dashboard bị scroll ngang

**Hiện tại** (`modules/dashboard/presentation/components/dashboard-home-screen.tsx`): 8 lối tắt (Thu chi, Cân chỉnh số dư, Công nợ, Phân tích, Lịch, Việc cần làm, Nhắc nhở, Người liên quan) nằm trên một hàng cuộn ngang.

**Sửa (≤ 640px)**: lưới `grid grid-cols-4 gap-1.5` → 2 hàng × 4, không cuộn. Mỗi ô `min-h-10`, chữ 12px căn giữa, cho phép xuống 2 dòng (`whitespace-normal leading-tight`) cho nhãn dài. Skeleton đổi theo (8 ô, cùng lưới). Desktop giữ hàng pill như cũ.

## 6. Lịch: nhớ tab "Lưới tháng / Lịch trình"

**Hiện tại** (`modules/dashboard/presentation/components/calendar-screen.tsx`): `chosenViewMode` chỉ là `useState` → F5 là về mặc định (phone: Lịch trình, desktop: Lưới tháng).

**Sửa**:
- Helper thuần `modules/calendar/model/calendar-view-storage.ts`: key `zalobot:calendar-view:phone` (`agenda | month`) và `zalobot:calendar-view:desktop` (`month | list`) — tách theo layout vì hai layout có bộ tab khác nhau; `parseCalendarViewMode(value, layout)` dùng type guard (không ép kiểu), đọc/ghi bọc `try/catch` (private mode / storage bị chặn vẫn chạy bình thường với mặc định).
- Đọc bằng `useSyncExternalStore` (server snapshot = `null`) để không lệch hydration của static export và không `setState` trong effect; bấm tab → ghi localStorage + state.
- Spec `calendar-view-storage.spec.ts` cho hàm parse (giá trị hợp lệ, sai layout, rác, `null`).
- Không persist các state khác (tháng đang xem, ngày chọn, tìm kiếm).

---

## Ngoài phạm vi (hỏi trước khi làm)

Các màn khác vẫn dùng hàng chip cuộn ngang `MOBILE_TOOLBAR_ROW`: Danh bạ, Việc cần làm, Nơi chốn, Cài đặt, Zalo & Người dùng, Thu chi (`overflow-x-auto`). Kế hoạch này **không** sửa chúng; nếu anh muốn đồng bộ cùng kiểu lưới/phân đoạn thì làm task tiếp theo.

## Tài liệu (Hard Completion Gate)

- `.agents/knowledge/global/web-ui-direction.md` (EN): Mobile Dialogs (footer dính đáy ở fullscreen, khoá scroll kiểu body-fixed, backdrop `touch-none`), More sheet footer (nút phân đoạn ngôn ngữ thay select), mô tả `MOBILE_TOOLBAR_ROW`/phone toolbars (debts + dashboard không còn cuộn ngang).
- `.agents/knowledge/modules/debts/README.md`, `modules/dashboard/README.md`, `modules/calendar/README.md` (EN): toolbar phone công nợ, quick links lưới 4 cột, persist view lịch (key localStorage); bổ sung `depends_on` nếu thiếu (`calendar-view-storage.ts`).
- `.agents/docs/global/web-ui-direction.md`, `.agents/docs/modules/{debts,dashboard,calendar}/README.md` (VI) tương ứng; cập nhật `.agents/docs/README.md` nếu index thay đổi.
- `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## Kiểm tra

1. `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`, `npm run test --workspace @zalobot/web` (gồm spec mới).
2. Browser pane (`preview_start web`, preset mobile 375px):
   - Mở "Thêm khoản nợ": footer nằm sát đáy màn hình (đo `footer.getBoundingClientRect().bottom ≈ innerHeight`).
   - `/debts`, `/dashboard`: `document.documentElement.scrollWidth <= clientWidth`, filter/quick links không có phần tử nào `overflow-x` cuộn được; chụp ảnh.
   - More sheet: nút ngôn ngữ và nút giao diện cùng cỡ chữ (computed `font-size`); đổi ngôn ngữ hoạt động.
   - Mở sheet khi đang cuộn giữa trang → đóng → vị trí cuộn được giữ nguyên.
   - `/calendar`: chọn "Lưới tháng" → reload → vẫn là Lưới tháng.
3. **Giới hạn**: hiện tượng scroll xuyên sheet là của iOS Safari; browser pane là Chromium nên chỉ kiểm được cơ chế khoá (body fixed + giữ vị trí), không tái hiện được trên iPhone thật — sẽ ghi rõ trong báo cáo.
