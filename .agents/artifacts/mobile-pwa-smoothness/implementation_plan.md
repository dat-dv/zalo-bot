# Kế hoạch: Làm mượt trải nghiệm mobile / PWA

- Route: `implement` — Phase 1 (Planning), Authority: `inspect-and-plan`
- Rủi ro: **MEDIUM** (chạm các component dùng chung `Modal`, `AppNavigation`, `DataTable` mobile list, `PwaStatusStack`, `styles.css`; không đổi API/DB)
- Skills: `enterprise-ui`, `frontend-orchestration`, `nextjs-static`
- Trạng thái: **chờ duyệt**, chưa sửa code

## 1. Kết quả test trên prod (22/10/2026, bản `v1.0.130`)

Đã đạt:
- **Khổ 375px và 768px**: 11/11 trang không tràn ngang, có thanh tab, dùng danh sách thay cho bảng.
- **Các trang xem tận mắt**: hồ sơ người liên quan, trang cấu hình thread ZCA, dialog Cân chỉnh số dư (bottom sheet, không tự bật bàn phím).
- **Cập nhật PWA**: bấm "Tải lại" thì service worker mới bật và banner biến mất.

Chưa mượt / lỗi phát hiện:

| # | Vấn đề | Bằng chứng |
|---|---|---|
| 1 | **Chạm không có phản hồi**: đã tắt vệt xám khi chạm (`tap-highlight` transparent) nhưng dòng danh sách, tab, chip, nút ở thanh đáy chỉ có `hover:`, không có `active:` | grep `active:` trong `data-table-mobile-list.tsx`, `app-navigation.tsx` = 0 |
| 2 | **Sheet/dialog bật tắt "giật"**: hiện ra và biến mất ngay, không có chuyển động trượt; drawer thì có | `modal.tsx` không có transition/animation |
| 3 | **Không vuốt được**: sheet không vuốt xuống để đóng, drawer không vuốt để đóng | chưa có xử lý pointer |
| 4 | **App đã cài (standalone) không kéo xuống để làm mới được**: iOS standalone không có pull-to-refresh, chỉ còn nút ↻ trên topbar | hành vi nền tảng |
| 5 | **Nhấn giữ bị chọn chữ / hiện menu hệ thống** trên tab bar, dòng danh sách; trang bị nảy (rubber-band) để lộ nền | không có `user-select`/`touch-callout`/`overscroll-behavior` cho chrome |
| 6 | **Thẻ "Đã có phiên bản mới" che nội dung đầu trang** (thanh chọn kỳ, tab Cài đặt) trên mọi trang cho tới khi bấm | ảnh chụp Phân tích / Việc cần làm / Cài đặt |
| 7 | **Sau "Tải lại", URL nhảy về `/`** thay vì ở lại trang đang xem (thấy 1 lần ở `/settings`, cần tái hiện) | URL sau reload = gốc |
| 8 | **Lộ số dư**: đang ẩn số tiền nhưng ô "Số dư thực tế mới" trong Cân chỉnh số dư điền sẵn số dư thật | ảnh chụp dialog |
| 9 | Chuyển tab: bấm tab không có trạng thái "đang tải" khi route chunk chưa tải xong | cảm nhận khi mạng chậm |

## 2. Nguyên tắc (giữ nguyên)

- Bo góc nhỏ (`rounded-[3px]`), không pill, không FAB tròn. Desktop (> 960px) không đổi.
- Chuyển động ngắn (150–220ms), dùng `transform`/`opacity`, tôn trọng `prefers-reduced-motion` (tắt hết chuyển động).
- Không thêm thư viện (không framer-motion): CSS + pointer events thuần.
- Số tiền ẩn mặc định, không persist.

## 3. Các bước

### Bước 1. Phản hồi khi chạm (vấn đề 1, 5)
- Thêm trạng thái nhấn `active:` dùng chung (`touch.ts`: `TAP_FEEDBACK` = nền đậm hơn một bậc + `active:scale-[.98]` cho nút; dòng danh sách chỉ đổi nền).
- Áp cho: dòng mobile list, tab bar, chip toolbar (qua các hằng đã có), `MOBILE_ACTION_BUTTON`, nút trong sheet footer, dòng ZCA.
- `styles.css`: `-webkit-touch-callout: none` + `user-select: none` cho `nav`, `button`, `[role=tab]`, dòng list (giữ chọn chữ được trong ô nhập và nội dung chi tiết); `overscroll-behavior-y: none` cho `html` **khi chạy standalone** (`@media (display-mode: standalone)`) để hết nảy lộ nền.

### Bước 2. Chuyển động cho sheet và dialog (vấn đề 2)
- `Modal`: thêm trạng thái `closing` (giữ DOM ~200ms rồi mới unmount).
  - Mở: phone trượt từ dưới lên (`translate-y-full` → 0), nền mờ dần.
  - Đóng: chạy ngược lại.
  - Desktop: fade + scale nhẹ.
- Dùng `@starting-style` (đã hỗ trợ Safari 17.5+/Chrome 117+), trình duyệt cũ hơn thì không có chuyển động nhưng vẫn chạy đúng.
- Giữ nguyên hành vi focus, Escape, khóa cuộn.

### Bước 3. Vuốt để đóng (vấn đề 3)
- **Sheet**: kéo thanh kéo/header xuống: panel đi theo ngón tay. Thả quá 25% chiều cao hoặc vuốt nhanh thì đóng, không thì bật lại. Chỉ khi `onDismiss` có (dialog đang gửi request thì không vuốt được). Không bắt đầu kéo khi nội dung panel đang cuộn giữa chừng.
- **Drawer**: vuốt sang trái để đóng (theo ngón tay, ngưỡng 30% hoặc vuốt nhanh).
- Hook dùng chung `useSwipeDismiss` (pure math tách riêng + unit test).

### Bước 4. Kéo xuống để làm mới, chỉ trong app đã cài (vấn đề 4, Q1)
- Component `PullToRefresh` trong private layout, chỉ bật khi `display-mode: standalone` và màn hẹp (≤ 960px). Trình duyệt thường đã có pull-to-refresh riêng nên không bật ở đó.
- Kéo tại đỉnh trang (`scrollY = 0`): hiện vòng ↻ dưới topbar. Thả quá 64px thì gọi đúng `handleRefresh` của topbar (`invalidateQueries`), giữ vòng quay tới khi các query xong.
- Không kích hoạt khi có dialog/drawer đang mở.

### Bước 5. Thẻ cập nhật phiên bản & reload (vấn đề 6, 7, Q2)
- Thẻ cập nhật thành một thanh mảnh 40px ngay dưới topbar, đẩy nội dung xuống thay vì đè lên. Có nút "Tải lại" và ✕.
- **Q2 (đề xuất)**: nếu người dùng chưa bấm, tự áp dụng bản mới ở **lần chuyển trang kế tiếp** (gửi `SKIP_WAITING` trước khi điều hướng), không mất dữ liệu đang nhập vì không ở giữa form.
- Tái hiện và sửa lỗi reload về `/`: reload phải giữ `location.href` hiện tại (kiểm tra luồng `controllerchange` và fallback điều hướng của service worker).

### Bước 6. Chuyển tab có phản hồi tức thì (vấn đề 9)
- Tab được bấm sáng ngay (trạng thái pending qua `useLinkStatus` của Next), kèm vạch tiến trình mảnh 2px dưới topbar khi route đang tải.
- Prefetch các route của 4 tab chính khi app rảnh.

### Bước 7. Sửa lộ số dư (vấn đề 8, Q3)
- **Q3 (đề xuất)**: khi đang ẩn số tiền, ô "Số dư thực tế mới" để trống (placeholder `••••••`), không điền số dư thật. Khi đang hiện số tiền thì giữ như cũ.

## 4. File dự kiến chạm

- Shared: `src/shared/ui/{modal,app-navigation,data-table-mobile-list,mobile-action-bar,touch,pwa-status-stack,workspace-header}.tsx|ts`, `src/styles.css`, `app/(private)/layout.tsx`, `src/shared/pwa/pwa-registrar.tsx`.
- Mới: `src/shared/hooks/use-swipe-dismiss.ts` (+ spec), `src/shared/ui/pull-to-refresh.tsx`, `src/shared/ui/route-progress.tsx`.
- Module: `dashboard/presentation/components/adjust-balance-modal.tsx`, `zca/presentation/components/chat-list-row.tsx` (tap feedback).
- i18n: `pull.refreshing`, `pull.release` (vi + en).
- Không chạm API, DB, nginx.

## 5. Kiểm tra

- Tự động: typecheck, lint, test (thêm spec cho toán vuốt), build.
- Prod (sau khi Coolify deploy), dùng phiên trình duyệt hiện có (không xoá):
  - Khổ 375px: bấm thấy phản hồi; sheet trượt lên/xuống; vuốt đóng sheet/drawer bằng `left_click_drag`; Escape vẫn chạy.
  - `prefers-reduced-motion` tắt chuyển động.
  - Thẻ cập nhật không che nội dung; reload giữ URL.
  - Ô số dư trống khi đang ẩn số tiền.
- **Không giả lập được** (ghi rõ khi báo cáo): pull-to-refresh trong app đã cài thật trên iPhone/Android, cảm giác vuốt bằng ngón tay thật, haptic. Cần anh thử trên điện thoại.

## 6. Tài liệu

- `.agents/knowledge/global/web-ui-direction.md` + `pwa.md` (EN) và `.agents/docs/global/` tương ứng (VI): chuyển động, vuốt, pull-to-refresh, tap feedback, thẻ cập nhật.
- `modules/dashboard` docs: quy tắc ô số dư khi ẩn số tiền.

## 7. Câu hỏi cần anh chốt

- **Q1 – Pull-to-refresh**: chỉ trong app đã cài (đề xuất, vì trình duyệt đã có sẵn) hay cả trong trình duyệt?
- **Q2 – Bản mới**: tự áp dụng ở lần chuyển trang kế tiếp (đề xuất), hay luôn chờ người dùng bấm "Tải lại"?
- **Q3 – Ô số dư khi ẩn số tiền**: để trống (đề xuất), hay vẫn điền số thật?
- **Q4 – Phạm vi**: làm cả 7 bước (đề xuất), hay bỏ bước nào?
