# Kế hoạch: Dashboard web thân thiện với điện thoại (cảm giác như app, không phải "web co lại")

- Route: `implement` — Phase 1 (Planning), Authority: `inspect-and-plan`
- Rủi ro: **HIGH** (chạm shared shell + ~20 màn hình/dialog của `apps/web`, không đổi API/DB)
- Skills: `enterprise-ui`, `frontend-orchestration`, `nextjs-static`
- Trạng thái: **chờ duyệt** — chưa sửa dòng code nào

## 1. Hiện trạng (audit code, chưa chạy trên trình duyệt)

Đã có sẵn, giữ nguyên:
- Topbar mobile + drawer trượt trái (≤ 960px), nút 40px.
- `Modal` thành bottom sheet dưới 640px, chiều cao theo visual viewport, header/footer sticky.
- `DataTable` có chế độ **mobile list** (hàng 2 dòng 52px + sheet chi tiết) — nhưng **chỉ `/transactions` bật**.
- `PeriodFilterToolbar` và toolbar Transactions đã có nút 40px, chip cuộn ngang.

Vì sao vẫn giống "web co lại":

| # | Vấn đề | Ví dụ |
|---|---|---|
| 1 | Chỉ đổi trang được qua hamburger, 11 mục | không có tab bar dưới đáy |
| 2 | 6/7 màn hình dữ liệu vẫn là bảng desktop cuộn ngang, có thêm hộp cuộn trong `max-h-[520px]` | Debts (~1.300px), Contacts, Places, Expenses, Tasks, Reminders, Calendar table, Settings, ZCA, toàn bộ widget ở Home |
| 3 | Sửa bằng **double-click** — không dùng được trên cảm ứng | Debts, Contacts, Places, Expenses, Tasks, Reminders, Calendar |
| 4 | Nút 22–28px, chữ 9.5–11px ngoài Transactions | nút hàng `h-[22px]`, toggle `h-6`, nút đóng dialog `p-1`, footer dialog ~28px |
| 5 | Lịch dạng tháng `grid-cols-7` không đọc được ở 375px | ô ~47px, chip sự kiện 11px bị cắt |
| 6 | Popover kiểu desktop | menu `⋯` của ZCA, column-filter: không backdrop, đóng bằng `mousedown` |
| 7 | Hộp cuộn lồng trong sheet | combine-contacts `max-h-[75vh]`, debt-allocation `max-h-72`, bảng payments trong Debts |
| 8 | Thiếu chi tiết nền tảng | không có `viewportFit: cover`/safe-area cho topbar/drawer/cuối trang dù đã khai báo status bar `black-translucent`; không có `tap-highlight`/`touch-action`; drawer ẩn vẫn nằm trong thứ tự Tab |
| 9 | Breakpoint lệch: shell 960px, bảng/sheet 640px | 641–960px: nav mobile + bảng desktop + modal giữa màn hình |
| 10 | Toast lúc trên lúc dưới; `adjust-balance-modal` tự `autoFocus` bật bàn phím; tiêu đề trang ZCA lặp với topbar | |

## 2. Nguyên tắc thiết kế (ràng buộc đã có, không phá)

- Vẫn là B2B dense: hàng phẳng `border-b`, **không** card/shadow mỗi dòng.
- **Bo góc giữ nhỏ** (`rounded-[3px]`/`rounded`): không pill, không FAB tròn, không "thống nhất radius".
- Desktop (> 960px) **không đổi gì** về giao diện.
- Font control nhỏ là chủ ý; iOS chặn zoom-on-focus bằng `IosViewportFix` (đã ghi trong knowledge) → **không** tăng input lên 16px (xem câu hỏi Q4).
- Số tiền vẫn ẩn mặc định, không persist.
- Route/endpoint qua `APP_ROUTES`, chuỗi qua i18n catalog, không `any`.

## 3. Kế hoạch theo giai đoạn

Mỗi giai đoạn là một commit riêng, typecheck/lint/test xanh trước khi sang giai đoạn sau.

### Giai đoạn A — Nền tảng chung (shared)

1. **Một nguồn breakpoint**: `src/shared/ui/breakpoints.ts` (`PHONE_MAX = 640`, `COMPACT_MAX = 960`, media query tương ứng). `use-media-query.ts`, `data-table`, `modal` dùng chung. Giữ hai tầng nhưng có tên, có tài liệu; dải 641–960 dùng mobile list cho bảng (xem Q2).
2. **Bottom tab bar** (`src/shared/ui/mobile-tab-bar.tsx`, ≤ 960px): 4 tab + "Thêm" (mở drawer hiện tại). Icon + nhãn 10.5–11px, cao 56px + `env(safe-area-inset-bottom)`, trạng thái active giữ `aria-current`. Dùng lại `navSections`/icon của `app-navigation.tsx` để không trùng dữ liệu. Tab mặc định đề xuất: **Tổng quan · Thu chi · Công nợ · Lịch** (Q1).
3. **Safe-area & touch CSS**: `viewportFit: 'cover'`; topbar `pt-[env(safe-area-inset-top)]`; drawer và layout chừa top/bottom inset; vùng nội dung chừa chiều cao tab bar. `styles.css` base: `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation` cho button/a/input (bỏ delay double-tap).
4. **Drawer**: `inert` khi đóng; nút đóng/khóa cuộn giữ nguyên. (Vuốt để đóng: xem giai đoạn E.)
5. **Modal**: thêm thanh kéo trực quan (chỉ hiển thị, 36×4px) trên sheet; export hằng `MODAL_CLOSE_BUTTON` (40px trên phone) và `MODAL_FOOTER_BUTTON` (`max-[640px]:h-10 flex-1`) để mọi dialog dùng chung; tùy chọn `fullScreenOnPhone` cho dialog dài (thread config, sync media, combine).
6. **Hằng touch-size dùng chung** (`src/shared/ui/touch.ts`): `TAP_CONTROL` = `max-[640px]:h-10 max-[640px]:min-w-10`, `TAP_TEXT`, `MOBILE_TOOLBAR_ROW` = `max-[640px]:flex-nowrap max-[640px]:overflow-x-auto`. Đây là cách áp 40px cho hàng loạt control mà không đổi desktop.
7. **Toast**: một vị trí trên phone — đáy, trên tab bar + safe-area. Gom các toast `top-4` (Places, Expenses, Settings) về cùng component/class.
8. **Popover → sheet trên phone**: helper `useIsPhone()` + `column-filter-popover` và `chat-row-menu` render qua `Modal` (bottom sheet có danh sách hành động 48px) khi ở phone; desktop giữ popover.
9. **Thanh hành động chính** (`MobileActionBar`): hàng cố định trên tab bar, nút vuông góc 3px full-width, chỉ dùng ở màn có hành động tạo thật (Places "+ Tạo", ZCA "+ Thêm người dùng"/QR, Transactions "Điều chỉnh số dư"). **Không thêm tính năng tạo mới** ở các màn chưa có.

### Giai đoạn B — Mobile list cho mọi bảng

Khai `mobileSlot` (primary / secondary / trailing) cho từng bảng; sheet chi tiết đã hỗ trợ sửa inline + footer hành động sẵn.

| Bảng | primary | trailing | secondary |
|---|---|---|---|
| `DebtsTable` | người liên quan | số còn lại (±) | hướng · trạng thái · hạn · % đã trả |
| Contacts | tên (biệt danh) | số dư nợ | SĐT · tài khoản liên kết |
| Places | tên | số giao dịch | ngày dùng gần nhất |
| Expenses | ghi chú | số tiền | danh mục · ngày |
| `TasksTable` | tiêu đề | hạn | trạng thái · danh sách |
| `RemindersTable` | nội dung | giờ nhắc | lặp lại · kênh |
| `CalendarTable` | tiêu đề | giờ bắt đầu | địa điểm · lịch |
| Settings (2 bảng danh mục/…) | tên | — | loại · số lần dùng |
| Analytics cashflow breakdown | danh mục | số tiền | % |
| Home: mọi widget | như bảng gốc | | |

- `TransactionsTable`: đổi mặc định `mobileList` thành bật, bỏ prop thủ công ở `/transactions`.
- **Double-click trên phone**: không dùng; sửa qua nút "Sửa" trong footer sheet (đã có cơ chế `editingId`). Desktop giữ double-click.
- Chọn nhiều (Places/Contacts/Debts để gộp): trên phone chuyển sang "chế độ chọn" — nút "Chọn" trên toolbar, mỗi hàng hiện ô chọn 40px, thanh hành động dưới hiện "Gộp (n)".
- Bảng payments lồng trong Debts → danh sách dọc trong sheet chi tiết, nút xóa 40px.
- **ZCA** (bảng tự viết, không qua `DataTable`): thêm nhánh list cho phone — hàng 2 dòng (tên kênh + trạng thái listen / loại · ID rút gọn), chạm mở sheet chứa các toggle và các mục của menu `⋯`.
- Bỏ hộp cuộn trong `max-h-[520px]` khi bảng còn ở chế độ table trên dải compact.

### Giai đoạn C — Bố cục theo màn hình

- **Home**: trên phone, mỗi widget là một section phẳng hiển thị 5 bản ghi mới nhất ở dạng list + link "Xem tất cả" sang trang tương ứng; bỏ 6 ô search riêng trên phone; quick links thành một hàng chip 40px cuộn ngang.
- **Transactions**: gộp period toolbar + trend strip để hàng đầu tiên xuất hiện sớm hơn (trend strip thu gọn thành 1 dòng tổng thu/chi/số dư, chạm để mở rộng).
- **Debts / Contacts / Places / Expenses / Tasks / Reminders**: toolbar phone = ô search full width 40px + một hàng chip cuộn ngang (`MOBILE_TOOLBAR_ROW`); Debts gộp 3 chip trạng thái + 3 chip hướng vào cùng hàng.
- **Calendar**: trên phone mặc định **agenda** (danh sách theo ngày, nhóm theo tiêu đề ngày) + dải tuần 7 ô để nhảy ngày; month grid chỉ còn là tùy chọn và hiện chấm thay vì chip chữ. Nút trước/sau 40px.
- **Analytics**: toggle Chart/Table 40px; chart full width.
- **Settings**: tab thành hàng chip 40px cuộn ngang; bảng dùng mobile list.
- **ZCA**: bỏ h1 trùng topbar trên phone; ô search full width; nhóm nút hành động vào `MobileActionBar`/sheet; phân trang 40px.

### Giai đoạn D — Dialog

Áp `MODAL_CLOSE_BUTTON`/`MODAL_FOOTER_BUTTON` cho: adjust-balance, debt-allocation, delete-transaction, transaction-receipt, combine-debts/contacts/places, thread-config, sync-media, thread-storage-links, user-form, linked-contacts, merge-user.
- Bỏ hộp cuộn lồng (combine-contacts, debt-allocation) trên phone — để panel của Modal cuộn.
- Bỏ `autoFocus` trong adjust-balance-modal.
- Toggle 20×36 trong thread-config → vùng chạm 40px (giữ hình toggle).
- `fullScreenOnPhone` cho thread-config và sync-media.
- Nhân tiện sửa chuỗi tiếng Việt hardcode trong debt-allocation-modal sang i18n (bắt buộc theo quy tắc i18n khi đã chạm file).

### Giai đoạn E — Tùy chọn (chỉ làm nếu duyệt, Q5)

- Vuốt từ mép trái mở drawer / vuốt xuống đóng sheet.
- Pull-to-refresh (gọi cùng `invalidateQueries` như nút refresh).
- PWA manifest `display: standalone` để "Thêm vào màn hình chính" mở như app.

## 4. File dự kiến chạm

- Shared: `app/layout.tsx`, `app/(private)/layout.tsx`, `src/styles.css`, `src/shared/ui/{app-navigation,modal,data-table,data-table-mobile-list,period-filter-toolbar,trend-summary-strip}.tsx`, `src/shared/hooks/use-media-query.ts`; mới: `breakpoints.ts`, `touch.ts`, `mobile-tab-bar.tsx`, `mobile-action-bar.tsx`.
- Modules: `dashboard/presentation/components/*` (home, transactions, analytics, places, tasks, reminders, calendar, các modal), `debts/presentation/components/*`, `expenses/…/expenses-screen.tsx`, `contacts/…/*`, `calendar/…/calendar-grid.tsx`, `settings/…/settings-screen.tsx`, `zca/view/*`, `zca/presentation/components/*`, `users/presentation/components/*`.
- `packages/contracts`: chỉ thêm khóa i18n (nhãn tab bar, "Xem tất cả", "Chọn", …).
- **Không** chạm `apps/api`, schema, endpoint.
- Lưu ý: `zca/model/thread-config-form.ts` và `packages/contracts/src/index.ts` đang có thay đổi chưa commit của task khác (`zca-thread-config-page`) — sẽ không đụng vào phần đó; nếu task kia chưa merge khi bắt đầu giai đoạn B/D ZCA, làm ZCA sau cùng.

## 5. Kiểm tra

- Tự động: `npm run typecheck`, `npm run lint`, `npm run test --workspace @zalobot/web` (thêm unit test cho `partitionMobileColumns` mapping mới và helper breakpoint), `npm run build --workspace @zalobot/web`.
- Trực quan: chạy `npm run dev`, mở bằng built-in browser preset **mobile 375×812** (và 768 cho dải compact, desktop để chắc không đổi), chụp màn mỗi trang: list, sheet chi tiết, sửa trong sheet, toolbar, dialog với bàn phím (không giả lập được bàn phím iOS thật → ghi rõ là chưa kiểm).
- Checklist: không cuộn ngang ở body tại 375px; mọi control chạm ≥ 40px; tab bar không che nội dung/toast; desktop screenshot không đổi.

## 6. Tài liệu (Hard Completion Gate)

- `.agents/knowledge/global/web-ui-direction.md` (EN) + `.agents/docs/global/web-ui-direction.md` (VI): breakpoint, tab bar, safe-area, touch constants, popover→sheet, quy tắc "không double-click trên phone", agenda calendar.
- Module knowledge/docs: `dashboard`, `debts`, `contacts`, `calendar`, `settings`, `zca`, `users` (phần mô tả UI mobile của từng màn) + `.agents/docs/README.md`.
- `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 7. Câu hỏi cần anh chốt

- **Q1 – Tab bar**: 4 tab đề xuất **Tổng quan · Thu chi · Công nợ · Lịch** + "Thêm". Anh muốn thay tab nào (ví dụ Nhắc nhở, Zalo & Users)?
- **Q2 – Dải 641–960px** (tablet dọc, điện thoại ngang): dùng mobile list như phone (đề xuất) hay giữ bảng desktop?
- **Q3 – Home trên phone**: chỉ 5 bản ghi mỗi section + "Xem tất cả" (đề xuất), hay giữ đầy đủ?
- **Q4 – Input 16px trên phone**: giữ quyết định hiện tại (font nhỏ + `IosViewportFix`, đề xuất) hay đổi sang input 16px rồi bỏ fix?
- **Q5 – Giai đoạn E** (vuốt, pull-to-refresh, PWA): làm luôn, để sau, hay bỏ?
- **Q6 – Thứ tự**: làm A → B → C → D → (E), mỗi giai đoạn một commit; hay anh muốn ưu tiên trang nào trước?
