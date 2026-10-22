---
metadata:
  agent-artifact:
    id: docs-global-web-ui-direction
    type: documentation
    depends_on:
      - .agents/knowledge/global/web-ui-direction.md
      - apps/web/src/styles.css
      - apps/web/src/shared/ui/data-table.tsx
      - apps/web/src/shared/ui/data-table-mobile.ts
      - apps/web/src/shared/ui/data-table-mobile-list.tsx
      - apps/web/src/shared/hooks/use-media-query.ts
      - apps/web/src/shared/ui/period-filter-toolbar.tsx
      - apps/web/src/shared/ui/workspace-header.tsx
      - apps/web/src/shared/ui/app-navigation.tsx
      - apps/web/src/shared/ui/logout-confirm-dialog.tsx
      - apps/web/src/shared/ui/confirm-dialog.tsx
      - apps/web/src/shared/store/money-visibility-store.ts
      - apps/web/src/shared/store/theme-store.ts
      - apps/web/src/shared/providers/app-providers.tsx
      - apps/web/src/shared/ui/modal.tsx
      - apps/web/src/shared/ui/ios-viewport-fix.tsx
      - apps/web/src/shared/hooks/use-body-scroll-lock.ts
      - apps/web/src/shared/hooks/use-visual-viewport.ts
      - apps/web/app/layout.tsx
      - apps/web/src/shared/ui/breakpoints.ts
      - apps/web/src/shared/ui/touch.ts
      - apps/web/src/shared/ui/mobile-action-bar.tsx
      - apps/web/src/shared/hooks/use-swipe-dismiss.ts
      - apps/web/src/shared/hooks/swipe-dismiss.ts
      - apps/web/src/shared/ui/pull-to-refresh.tsx
---

# Định hướng UI web dùng chung

Web dashboard là giao diện tác vụ cá nhân, ưu tiên dữ liệu dễ quét và thao tác gọn: một workspace phẳng, viền nhẹ, control nhỏ gọn; tránh card trang trí hoặc shadow nặng. Tailwind CSS v4 là lớp styling duy nhất cho 100% component và màn hình giao diện web: toàn bộ bố cục, data panel, bảng dữ liệu, dialog modal, form inline edit, KPI metrics, biểu đồ và các nút hành động đều dùng trực tiếp utility classes có hỗ trợ tiền tố `dark:` và responsive variants. File `apps/web/src/styles.css` chỉ gồm `@import 'tailwindcss'`, khai báo `@custom-variant dark` và một lớp CSS nền nhỏ: màu chữ/nền/font cho `:root`, màu cho `html[data-theme='dark']`, màu outline `:focus-visible` ở dark mode (`#93c5fd`), `box-sizing` và mặc định của `body`. Không có class BEM hay class component nào.

Các primitive dùng chung trong `apps/web/src/shared/ui/` chịu trách nhiệm panel/bảng tái sử dụng. Trên desktop, bảng phải phủ hết chiều ngang bên trong panel; bảng dùng HTML semantic, căn phải số liệu, có trạng thái loading, rỗng và có dữ liệu. Trên màn hình di động hẹp, bảng chưa bật chế độ danh sách (xem mục bên dưới) hỗ trợ cuộn ngang mượt mà (`min-width: max-content` kết hợp `minWidth` của từng cột) để đảm bảo các thông tin quan trọng (Số tiền, Thời gian, Badge trạng thái) không bao giờ bị bóp méo hoặc cắt cụt. Cột thao tác (`id: 'actions'`) bắt buộc khai báo `minWidth` đầy đủ (120px–150px), bọc container bằng `flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap`, và gán `shrink-0 whitespace-nowrap` cho từng nút bấm (`Sửa`, `Xóa`, `Lưu`, `Hủy`, `Trả nợ`, `Hoãn`) cùng các badge phân loại để đảm bảo không bao giờ bị rớt dòng trên mọi kích thước màn hình.

Các bảng dữ liệu nghiệp vụ bắt buộc sử dụng các thành phần Common Table dùng chung (`TransactionsTable`, `DebtsTable`, `TasksTable`, `RemindersTable`, `CalendarTable`) thay vì tự định nghĩa lại `DataTableColumn` tại từng trang riêng lẻ (`dashboard-home-screen`, `transactions-screen`, `debts-screen`, `tasks-screen`, `reminders-screen`, `calendar-screen`, `analytics-screen`). Việc gom về component dùng chung đảm bảo toàn bộ số hàng, số cột, format tiền tệ, biểu đồ thanh trực quan, tính năng autocomplete, inline editing và cài đặt ẩn/hiện cột được hiển thị đồng bộ, nhất quán 100% trên toàn ứng dụng.

Thành phần `DataTable` tích hợp sẵn nút Cài đặt cột (`TableColumnSettings`) với menu popover cho phép người dùng bật/tắt hiển thị từng cột và tự động lưu cấu hình vào `localStorage` (`zalobot:table-columns:<id>`). Mỗi dòng bắt buộc có trường `id`: `DataTable` tự thêm hai cột bắt buộc `STT` (số thứ tự theo danh sách đang hiển thị) và `ID` trước các cột nghiệp vụ; người dùng không thể ẩn hai cột này, còn ID được hiển thị dưới dạng nút bấm mono tương tác. Khi nhấp vào ô ID, hệ thống mở hộp thoại `IdExplainerDialog` giải thích thông tin bảng CSDL (`finance_transactions`, `debts`, `tasks`, `reminders`, `calendar_events`, `debt_contacts`, `finance_places`, `categories`...), cung cấp nút sao chép ID 1-click và bộ 3 câu lệnh mẫu cho AI Agent (Sửa, Xóa, Tra cứu) để người dùng dán trực tiếp vào Zalo Bot. Bảng tự sắp xếp sau khi lọc theo thời gian phát sinh nghiệp vụ: dữ liệu lịch sử ưu tiên mới nhất (`occurredAt`, rồi `paymentDate`, rồi `createdAt`), còn lịch/nhắc việc/công việc ưu tiên mốc sắp tới (`remindAt`, `startAt`, `dueAt`); dòng không có hạn nằm cuối. Mọi bảng có `id` cũng cho phép kéo mép phải của header để đổi độ rộng cột, lưu riêng theo `zalobot:table-widths:<id>` và tự khôi phục khi tải lại trang; khi cần, view có thể tắt bằng `allowColumnResize={false}`. Mỗi view tự quản lý danh sách cột nghiệp vụ, tải dữ liệu, lỗi và hành động.

## Khung giao diện trên màn hẹp: breakpoint, thanh tab, safe-area

**Vì sao cần:** trước đây trên điện thoại, dashboard chỉ là bản desktop thu nhỏ. Muốn đổi trang phải mở hamburger rồi chọn trong 11 mục. Nút chính nằm tít trên đầu trang, ngón cái khó với tới. Khi "Thêm vào màn hình chính" trên iPhone, topbar còn bị tai thỏ che. Mục tiêu là dùng trên điện thoại giống một app thật. Desktop (> 960px) giữ nguyên.

- **Hai mốc breakpoint, khai báo một chỗ** (`apps/web/src/shared/ui/breakpoints.ts`):
  - **Điện thoại (≤ 640px)**: bottom sheet, vùng chạm 40px. Trong Tailwind viết `max-sm:` / `max-[640px]:`.
  - **Màn hẹp (≤ 960px)**, gồm cả tablet dọc và điện thoại xoay ngang: topbar + thanh tab dưới đáy + chế độ danh sách của bảng. Trong Tailwind viết `max-[960px]:`.
  - Trong code dùng hook `useIsPhone()` / `useIsCompact()`. Không tự đặt thêm mốc khác.
- **Thanh tab dưới đáy** (trong `AppNavigation`, ≤ 960px):
  - 5 ô: Tổng quan, Thu chi, Công nợ, Lịch, **Thêm**. Nhãn tab "Công nợ" là bản rút gọn của "Vay & cho vay" cho vừa 1/5 bề ngang.
  - "Thêm" mở **sheet Thêm**: trượt từ dưới lên, mọi trang xếp thành lưới 3 cột (icon + nhãn), cuối sheet là đổi giao diện, ngôn ngữ và Đăng xuất. Ô "Thêm" sáng lên khi sheet đang mở hoặc khi trang hiện tại không thuộc 4 tab kia.
  - Có một vạch chỉ báo 2px **trượt ngang** sang tab được chọn; icon nảy nhẹ khi bấm.
  - Chọn 4 tab này vì đó là những trang mở nhiều nhất trên điện thoại. Muốn đổi thì sửa `TAB_BAR_PAGES`.
- **Safe-area (tai thỏ, thanh home)**:
  - Viewport đặt `viewportFit: 'cover'`.
  - Layout chừa `env(safe-area-inset-*)` ở trên, trái và phải. Ở dưới chừa thêm chiều cao thanh tab (56px).
  - Topbar dính ngay dưới vùng status bar. Có một dải màu nền che vùng status bar để nội dung cuộn qua không bị lộ.
  - Sheet Thêm dùng chung khung `Modal`, nên có sẵn safe-area, khoá cuộn nền và vuốt xuống để đóng.
- **Vì sao bỏ drawer trái**: drawer cũ rộng khoảng nửa màn hình và phải cuộn bên trong, anh test trên iPhone thấy không hợp mobile. Lưới 3 cột chứa đủ 11 trang mà không cần cuộn trên iPhone 12 trở lên. Topbar cũng bỏ nút ☰: chỉ còn một lối vào menu là tab "Thêm", giống app iOS/Android. Desktop vẫn dùng sidebar.
- **CSS cho thao tác chạm** (`styles.css`):
  - Tắt vệt xám khi chạm (`-webkit-tap-highlight-color`).
  - Đặt `touch-action: manipulation` cho nút, link và input, để bỏ độ trễ chờ double-tap. Zoom bằng hai ngón vẫn dùng được.
- **Hằng class dùng chung** (`touch.ts`). Khi làm giao diện mobile mới, dùng các hằng này thay vì tự viết lại class:
  - `TAP_CONTROL`, `TAP_INPUT`: control cao 40px trên điện thoại.
  - `MOBILE_TOOLBAR_ROW`: một hàng chip cuộn ngang.
  - `TOAST_POSITION`: góc phải dưới trên desktop; trên màn hẹp rộng hết màn và nằm trên thanh tab.
- **Toast**: đã chuyển sang `TOAST_POSITION` ở Tổng quan, Thu chi, Nơi chốn, Việc cần làm, Nhắc nhở, Lịch. Các màn còn lại chuyển khi tới lượt làm mobile cho màn đó.
- **Thanh hành động chính** (`MobileActionBar`):
  - Trên màn hẹp, nút chính *đã có sẵn* của màn hình chuyển từ toolbar trên đầu xuống một thanh cố định ngay trên thanh tab. Nút cao 40px, bo góc 3px.
  - Nút trên toolbar thêm `max-[960px]:hidden` để không hiện hai lần.
  - Hiện dùng cho Nơi chốn ("+ Tạo"; ẩn khi form tạo đang mở).
  - Chỉ dành cho thao tác dùng thường xuyên. Nút "Cân chỉnh số dư" ở Thu chi hiếm khi dùng nên vẫn để trên toolbar, không đưa xuống thanh này.
  - Không dùng thanh này để thêm tính năng mới. Không dùng nút nổi tròn (FAB).

## Chế độ danh sách trên điện thoại (DataTable, màn hẹp ≤ 960px)

**Vì sao cần:** trên màn 375px, chỉ riêng hai cột STT và ID đã chiếm gần hết chiều ngang. Bảng Thu chi rộng khoảng 1.650px nên người dùng phải cuộn ngang mới thấy số tiền. Chế độ danh sách cho mỗi giao dịch một dòng hai tầng để nhìn lướt được ngay.

**Cách bật (opt-in):**
- Danh sách chỉ hiện khi đủ ba điều kiện:
  - Màn hình ≤ 960px (`useIsCompact()`; trước khi hydrate luôn coi là desktop). Trước đây mốc là 640px; nâng lên 960px vì tablet và điện thoại xoay ngang cũng đã có thanh tab, nên bảng desktop cuộn ngang ở đó cũng khó dùng.
  - Có ít nhất một cột khai báo `mobileSlot`.
  - Không truyền `mobileList={false}`.
- Bảng chưa khai báo slot vẫn là bảng cuộn ngang như cũ, nên có thể chuyển dần từng màn.
- `TransactionsTable` bật mặc định. Các bảng khác bật bằng cách khai báo `mobileSlot` cho cột.
- Bảng chưa có slot vẫn cuộn ngang, nhưng trên màn hẹp không còn hộp cuộn lồng `max-h-[520px]` nữa (cả trang cuộn), tránh cảnh vuốt trong bảng mà trang không chạy.
- Trong bảng trượt chi tiết, ô nhập, select và nút trong giá trị, cùng mọi nút ở chân sheet, tự to lên 40px. Nhờ vậy từng bảng không phải tự thêm class. Trên cảm ứng, việc sửa đi qua nút **Sửa** ở chân sheet. Double-click chỉ còn dùng trên desktop.

**Khai báo cột:**
- `mobileSlot`:
  - `'primary'`: dòng trên, bên trái.
  - `'trailing'`: dòng trên, bên phải, thường là số tiền.
  - `'secondary'`: dòng dưới, nối bằng ` · `.
- `mobileCell`: nội dung gọn, **không có nút bấm** (vì cả dòng đã là một nút). Nếu không khai báo thì dùng `cell`.
- `mobileHeader`: đưa header của cột (ví dụ nút lọc cột) lên dải lọc cuộn ngang phía trên danh sách.
- Việc chia slot nằm ở hàm thuần `partitionMobileColumns` (`data-table-mobile.ts`), đã có unit test.

**Hành vi:**
- Trên danh sách không có STT, ID, thanh "Ẩn/hiện cột", tay kéo đổi độ rộng cột và khung cuộn 520px; trang cuộn tự nhiên.
- Chạm vào dòng sẽ mở **bảng trượt từ dưới lên** (`Modal`):
  - Hiện mọi cột dưới dạng nhãn và giá trị, dùng lại `column.cell`. Nhờ vậy khi bấm **Sửa**, các ô tự thành input và **sửa ngay trong bảng trượt**, không cần form riêng.
  - Dòng **ID** mở `IdExplainerDialog`, nên ID vẫn xem và sao chép được.
  - `renderExpandedRow` (chi tiết, ảnh hoá đơn, phân bổ nợ) luôn hiện bên dưới.
  - Cột `actions` (Sửa/Xoá hoặc Lưu/Huỷ) nằm ở chân bảng trượt, luôn thấy kể cả khi bàn phím mở.
  - Bảng trượt tự đóng khi bản ghi không còn trong danh sách (đã xoá, bị lọc).
- Lúc đang tải hiện 4 dòng skeleton cao bằng dòng thật. Danh sách rỗng hiện `emptyMessage`.

**Thu chi hiển thị gì:**
- Dòng trên: ghi chú ở trái, số tiền có dấu +/− ở phải (không có thanh tỉ lệ).
- Dòng dưới: danh mục · ngày (dd/MM) · người tạo · nơi chốn.
- Hướng, ảnh hoá đơn và số dư luỹ kế chỉ có trong bảng trượt.

## Vùng chạm trên điện thoại và bo góc

- Ở bề ngang điện thoại, mọi thứ người dùng chạm đều cao **≥ 40px**:
  - Topbar, thanh tab và sheet Thêm (≤ 960px).
  - Dòng danh sách, nút trong bảng trượt và input khi sửa.
  - Chip lọc, ô tìm kiếm và nút "Tải thêm" của Thu chi.
  - Nút kỳ và mũi tên của `PeriodFilterToolbar`.
  - Nút lọc cột.
- Desktop giữ control nhỏ 22–30px để giữ mật độ dữ liệu cao.
- Toolbar trên điện thoại dùng **một hàng chip cuộn ngang** thay vì mỗi chip một dòng. Trên điện thoại, `PeriodFilterToolbar` đổi nhóm nút Tuần/Tháng/Quý/Năm thành một ô chọn native (cao 40px), để chu kỳ và cụm ‹ nhãn kỳ › nằm trên cùng một hàng. Trước đó thanh này chiếm khoảng 88px, đẩy dữ liệu xuống thấp. Desktop vẫn giữ nhóm nút.
- **Bo góc nhỏ** (`rounded-[2px]`, `rounded-[3px]`, `rounded`): nút, link dạng nút, ô nhập, thẻ/panel và khung dialog tối đa `rounded` (4px); dashboard không dùng `rounded-lg/xl/2xl` (trang public `/about`, `/privacy`, `/terms` không áp dụng). Badge đếm/chip dùng `rounded-[2px]` chứ không bo tròn kiểu viên thuốc. `rounded-full` chỉ dành cho avatar, chấm trạng thái, công tắc bật/tắt, vòng quay tải và thanh tiến độ. Lý do: dashboard là công cụ quản trị, cạnh sắc giúp lưới bảng và form thẳng hàng, nhìn nhất quán giữa các trang. Không dùng nút nổi bo tròn.

Nút phải có focus rõ, độ tương phản đủ và lỗi phải kèm cách thử lại.

Tiêu đề không gian làm việc (`WorkspaceHeader`) được render **một lần duy nhất** trong common private layout (`apps/web/app/(private)/layout.tsx`) bằng `<WorkspaceHeader />` không truyền props — component tự động resolve title và subtitle từ `usePathname()` thông qua `ROUTE_HEADER_MAP`. Component phân biệt hai trạng thái auth: **Đã xác thực** (`hasToken && !isLoggedOut`, trong đó `isLoggedOut` lấy từ query `?status=logged_out` sau khi đăng xuất): hiển thị title/subtitle theo route, nút `Ẩn/Hiện số tiền` (`useMoneyVisibility`), nút Làm mới (`queryClient.invalidateQueries()`), và nút Đăng xuất; **Chưa xác thực / Đã đăng xuất**: hiển thị title/subtitle theo route và link "Mở Zalo Bot" (key `auth.openzaloBot`; thử mở app Zalo qua `zalo://`, không có app thì mở `https://chat.zalo.me`, xem `modules/auth/README.md`). **Các file screen trong từng module tuyệt đối không được tự render `<WorkspaceHeader>`** — layout đã cung cấp sẵn cho mọi trang.

Tiêu đề theo route, trạng thái đăng nhập, Làm mới, Đăng xuất và link Zalo Bot lấy từ hook dùng chung `useWorkspaceHeader()` (cùng file), để desktop và mobile không lặp logic.
- Ở ≤ 960px, `WorkspaceHeader` bị ẩn và **topbar mobile** trong `AppNavigation` thay thế: `[Tên trang] [icon ẩn/hiện số tiền] [icon làm mới]`, mỗi nút 40px.
- Khi chưa đăng nhập, hai icon được thay bằng nút "Mở Zalo Bot".
- Phụ đề không hiện trên mobile. **Đăng xuất nằm ở chân sheet Thêm**.
- **Đăng xuất luôn hỏi lại trước.** Nút Đăng xuất trên header desktop và ở chân sheet Thêm đều chỉ mở hộp xác nhận `LogoutConfirmDialog` (`apps/web/src/shared/ui/logout-confirm-dialog.tsx`), chưa thoát ngay. Hộp này bọc component dùng chung `ConfirmDialog` (`shared/ui/confirm-dialog.tsx`); các thao tác xoá khác như xoá sự kiện lịch cũng dùng nó thay cho `window.confirm`.
  - Hộp dựng trên `Modal` (`role="alertdialog"`): desktop là thẻ giữa màn hình; điện thoại và PWA là bottom sheet chồng lên sheet Thêm, bấm Huỷ, bấm nền hay vuốt xuống thì quay lại sheet Thêm.
  - Chỉ nút "Đăng xuất" trong hộp mới gọi `confirmLogout()`: gọi API đăng xuất, xoá token và cache, tải lại trang với `?status=logged_out`. Trong lúc chạy, hai nút bị khoá và hộp không đóng được.
  - Hook `useWorkspaceHeader()` chỉ trả `requestLogout` / `cancelLogout` / `confirmLogout`, không còn hàm đăng xuất thẳng, để sau này thêm nút mới cũng không bỏ qua được bước xác nhận.
  - Lý do: đăng xuất rồi phải xin lại link đăng nhập từ Zalo Bot, mà trên điện thoại nút này nằm sát các ô điều hướng nên rất dễ bấm nhầm. Không dùng `window.confirm` vì trên PWA nó hiện hộp hệ thống kèm tên miền và không theo dark mode.
- Lý do: trước đây trên điện thoại có hai thanh header chồng nhau, ba nút chữ ép tiêu đề bị cắt, và mất khoảng 140px trước khi tới nội dung. Mặt nạ che số tiền (key `common.maskedAmount` = `'••••••'`) áp dụng đồng bộ cho các khối KPI, bảng dữ liệu và tooltip biểu đồ. Mặc định số tiền bị ẩn (tránh lộ khi mở dashboard nơi công cộng); lựa chọn của người dùng chỉ nằm trong store Zustand `useMoneyVisibilityStore` trong bộ nhớ (`apps/web/src/shared/store/money-visibility-store.ts`, cố ý không dùng `persist` và không lưu `localStorage`) nên chuyển trang trong app vẫn giữ, còn tải lại trang (F5) thì số tiền ẩn lại; thanh tỉ lệ nhỏ dưới số tiền trong bảng Giao dịch, Chi tiêu và trong biểu đồ Cơ cấu công nợ chỉ hiện khi đang bấm hiện số tiền (độ dài thanh để lộ khoản lớn/nhỏ), còn thanh % đã trả của công nợ vẫn giữ vì chỉ thể hiện tiến độ; các ô input khi đang sửa trực tiếp trên dòng (inline edit) vẫn giữ số thực để phục vụ thao tác.

Thanh điều hướng dùng chung (`apps/web/src/shared/ui/app-navigation.tsx`) theo kiểu sidebar quản trị trên desktop: phân thành 5 nhóm nghiệp vụ (Tổng quan, Tài chính, Kế hoạch, Dữ liệu, Hệ thống — key `nav.section.*`), có ô chọn ngôn ngữ, có dấu nhận diện sản phẩm, icon đi cùng chữ và tự động nhận diện trạng thái trang đang mở theo `usePathname()`. Desktop dùng app shell giới hạn theo viewport: chỉ vùng main content được cuộn, còn sidebar luôn đứng yên bên cạnh. Khi thêm mục mới, luôn giữ nhãn chữ hiển thị qua hệ thống i18n, SVG chỉ là phần hỗ trợ quét nhanh, và đặt `aria-current="page"` cho mục active.

Trên màn hình hẹp (<= 960px), shell trở lại cơ chế cuộn trang bình thường: topbar sticky trên cùng (tên trang, icon số tiền, làm mới) và thanh tab dưới đáy. Mọi trang còn lại mở qua tab "Thêm" (sheet lưới 3 cột). Logo sản phẩm chỉ còn trên sidebar desktop.

Dark mode được kích hoạt bằng `html[data-theme='dark']`; mọi utility dark của Tailwind phải dùng đúng data attribute này thông qua `@custom-variant dark`. Toàn bộ các bề mặt giao diện — navigation desktop/mobile, workspace header, period toolbar, data panel, form edit, dialog, biểu đồ và trang public/legal — bắt buộc dùng utility classes với tiền tố `dark:` phù hợp (`dark:bg-*`, `dark:border-*`, `dark:text-*`, `dark:hover:*`, `dark:focus:*`). Giữ trạng thái mục đang chọn dễ nhận biết và focus bàn phím màu xanh nhạt, đủ tương phản.

---

## Quy chuẩn Skeleton Loading mô phỏng chính xác giao diện thực tế (Full Fidelity)

Trạng thái Skeleton Loading có nhiệm vụ giữ vững khung xương không gian và chuẩn bị mắt người dùng trước khi dữ liệu xuất hiện. Để tránh hiện tượng giật cục (layout shift) hoặc giao diện bị méo mó khi tải, bắt buộc tuân thủ 4 nguyên tắc sau:

1. **Đồng bộ đường viền ô bảng (`DataTable`)**:
   - Từng ô skeleton `td` bắt buộc phải có đầy đủ viền dọc `border-r border-r-slate-50 last:border-r-0 dark:border-r-slate-900/60` và viền đáy `border-b border-b-slate-100 dark:border-b-slate-800`.
   - Phải truyền inline style `style={{ minWidth: column.minWidth, width: getColumnWidth(column) }}` trên từng ô `td` để giữ nguyên độ rộng cột theo cấu hình.
   - Các cột có `align === 'right'` (Số tiền, Ngày giờ, Thao tác) phải thêm `ml-auto` vào thẻ span pulse để thanh nhấp nháy căn phải như dữ liệu thực.
1. **Bảo tồn toàn bộ các khối bao ngoài (Containers)**:
   - Khi trang đang tải (`isLoading === true`), không được ẩn hoặc bỏ qua các khối `DataPanel` bao quanh. Phải render đầy đủ `DataPanel` với viền `border border-slate-200`, header `border-b`, ô tìm kiếm dạng pulse và lồng bảng `DataTable loading={true}` bên trong.
   - Giữ nguyên thanh công cụ lọc kỳ (`PeriodFilterToolbar`) và thanh liên kết nhanh (`Quick Links`) có viền `border border-slate-200`.
1. **Cấm tuyệt đối Text Loading thô sơ**:
   - Không được dùng các đoạn text đơn sơ kiểu `{isLoading ? <div>Đang tải...</div> : <MainUI />}` vì sẽ làm mất toàn bộ cấu trúc trang và gây giật khung mạnh khi nạp xong.
1. **Cấm Header thừa trong View Skeleton**:
   - `WorkspaceHeader` đã được layout chung (`PrivateLayout`) cung cấp. View skeleton tuyệt đối không được tự ý sinh thêm thẻ `<header>` chứa chữ loading.

## Phản hồi khi chạm, chuyển động và cử chỉ vuốt

**Vì sao cần:** sau đợt làm mobile, app đã dùng được trên điện thoại nhưng vẫn "cứng". Chạm vào không thấy gì đổi, vì đã tắt vệt xám mặc định. Sheet hiện ra rồi biến mất tức thì. Không vuốt để đóng được. Trong app đã cài trên iPhone thì không có kéo-xuống-để-làm-mới. Nhấn giữ thì bị bôi đen chữ.

- **Trạng thái nhấn**: chỉ áp dụng trên màn cảm ứng (`@media (hover: none)`), nên desktop không đổi.
  - Nút, link, tab mờ xuống 60% khi đang nhấn. Dòng danh sách đổi nền.
  - Thanh điều hướng và nút không bị bôi đen chữ, không hiện menu hệ thống khi nhấn giữ. Ô nhập và nội dung chi tiết vẫn chọn chữ được.
- **App đã cài**: tắt hiệu ứng nảy (rubber-band) để không lộ nền phía sau.
- **Máy bật "Giảm chuyển động"**: mọi chuyển động gần như tắt hẳn.
- **Sheet/dialog**:
  - **Chuyển động**: chạy bằng Web Animations API (`motion.ts`), không dùng CSS `@starting-style` nữa, vì Safari dưới 17.5 bỏ qua `@starting-style` và anh thấy sheet chưa có cảm giác trượt.
  - Trên điện thoại, sheet chạy theo kiểu **Modal Bottom Sheet** (Material): trượt lên trong **350ms** với đường cong giảm tốc `cubic-bezier(0, 0, 0.2, 1)`, đi đều rồi chậm dần vào chỗ, không vọt. Khi đóng, sheet tăng tốc trượt xuống trong 250ms (`cubic-bezier(0.4, 0, 1, 1)`) từ đúng vị trí đang có (kể cả lúc đang vuốt dở). Nền tối mờ theo cùng thời lượng và đường cong. Màn lớn thì mờ dần và thu nhỏ nhẹ.
  - Vì sao bỏ đường cong iOS cũ: nó dồn gần hết quãng đường vào ~120ms đầu, với sheet cao như sheet Thêm thì nhìn như sheet nhảy vọt lên.
  - Vì sao sheet từng "vọt lên cao rồi rớt xuống" trên app iPhone: `<dialog>` dùng `overflow: hidden` nên vẫn cuộn được, lúc sheet còn nằm dưới mép màn hình WebKit có thể cuộn dialog tới panel đang focus rồi bị kẹp lại. Ngoài ra chiều cao dialog frame đầu là `100dvh`, frame sau mới là chiều cao thật của visual viewport. Nay dialog dùng `overflow: clip` và các biến `--app-vvh` / `--app-vv-top` được ghi ngay trước khi mở, nên khung của sheet đúng ngay từ frame đầu.
  - `Modal` giữ DOM thêm 300ms sau khi `open = false` để kịp chạy hiệu ứng đóng.
  - Nếu nơi gọi tự gỡ `Modal` (kiểu `{x && <Modal open />}`) thì không có hiệu ứng đóng, chỉ có hiệu ứng mở.
- **Vuốt để đóng** (`use-swipe-dismiss.ts`):
  - Sheet: kéo dải trên cùng (thanh kéo + tiêu đề, 64px) xuống. Kéo quá 1/4 chiều cao, hoặc vuốt nhanh, thì sheet đóng; không thì bật về chỗ cũ.
  - Chỉ vuốt được khi dialog cho phép đóng: lúc đang gửi request thì không vuốt được. Form dài mở toàn màn hình cũng không vuốt.
  - Khi kéo vượt 1/4 chiều cao, máy Android rung nhẹ một nhịp (iOS không cho web rung).
  - Dùng touch events chứ không dùng pointer events, vì iOS huỷ pointer ngay khi trang bắt đầu cuộn.
- **Kéo xuống để làm mới** (`pull-to-refresh.tsx`):
  - Chỉ bật trong app đã cài, trên màn hẹp. Trình duyệt thường đã có sẵn tính năng này.
  - Kéo ở đỉnh trang thì hiện nhãn "Kéo để làm mới", qua 64px thì đổi thành "Thả để làm mới".
  - Thả ra thì tải lại mọi dữ liệu, giống nút ↻ trên topbar, và quay tới khi tải xong.
  - Không chạy khi đang mở dialog hoặc sheet. Vòng ↻ xoay theo độ kéo, qua ngưỡng thì rung nhẹ (Android), thả ra thì bật nảy về.
- **Thanh tab**: tab vừa bấm sáng lên ngay, không chờ trang mới tải xong. Nếu mạng chậm thì có một vạch xanh nhấp nháy trên tab. Các tab được `next/link` tải trước sẵn.
- **Bộ chuyển động chung** (`src/shared/ui/motion.ts` + `@theme` trong `styles.css`): một đường cong, một bộ thời lượng cho mọi chỗ.
  - Chuyển trang: nội dung mờ dần vào (chỉ dùng opacity; nếu dùng transform thì thanh hành động và toast `fixed` sẽ bị giật).
  - Danh sách: 10 dòng đầu hiện lần lượt, mỗi dòng trễ 20ms.
  - Toast trượt lên. Thanh hành động dưới đáy trượt lên. Thanh cập nhật phiên bản trượt xuống.
  - Dải tổng thu/chi mở biểu đồ bằng cách co giãn chiều cao, mũi tên xoay. Chọn ngày khác trong Lịch thì danh sách của ngày đó hiện mượt.
  - Nút thu nhỏ còn 97% khi nhấn. Dòng danh sách đánh dấu `data-press="none"` thì chỉ đổi nền, để không bị co cả dòng.

## Modal trên mobile & bàn phím ảo

**Vì sao cần**: trước đây mỗi modal tự viết overlay `fixed inset-0` căn giữa, không giới hạn chiều cao. Trên điện thoại, khi bấm vào input, bàn phím ảo chiếm khoảng nửa màn hình nên tiêu đề và nút Lưu/Huỷ bị đẩy ra ngoài, không cuộn tới được. Ngoài ra input chữ nhỏ hơn 16px làm iOS Safari tự phóng to trang và giữ nguyên mức zoom sau khi đóng bàn phím, nên giao diện bị "vỡ".

**Quy tắc bắt buộc**:

- Mọi modal/dialog phải dùng `Modal` trong `apps/web/src/shared/ui/modal.tsx`. Không tự viết overlay `fixed inset-0` nữa (không còn ngoại lệ: menu Thêm trên mobile cũng là một `Modal`).
- `Modal` dựng trên thẻ `<dialog>` native + `showModal()`. Trình duyệt lo phần lớp hiển thị (top layer), làm trang nền "trơ" (Tab không lọt ra ngoài, screen reader không đọc nền) và gửi Escape cho dialog trên cùng qua sự kiện `cancel`. Cần Safari 15.4 trở lên, không dùng polyfill. Style mặc định của `<dialog>` (margin, max-width/height, border, padding, màu) đã được reset; nền mờ là một `div` bên trong, còn `::backdrop` để trong suốt.
- **Desktop (≥ 640px)**: panel căn giữa như cũ. **Mobile (< 640px)**: dạng *bottom-sheet*, tức panel rộng hết màn hình, dính mép dưới và chỉ bo góc trên, giống bảng "Chia sẻ" của iOS. Kiểu này giúp nút hành động nằm ngay trên bàn phím và dễ bấm bằng ngón cái.
  - Sheet có một **thanh kéo** nhỏ 36×4px ở trên cùng, để người dùng nhận ra đây là lớp nổi trên trang. Hiện thanh này chỉ để nhìn, chưa kéo được.
  - Form dài có thể dùng `phoneLayout="fullscreen"` để chiếm cả màn hình trên điện thoại (chừa safe-area phía trên).
  - Nút đóng (✕) gắn thêm `MODAL_CLOSE_TAP`, các nút ở footer gắn `MODAL_FOOTER_TAP`, để thành vùng chạm 40px trên điện thoại mà desktop không đổi.
- Overlay lấy chiều cao theo phần màn hình còn nhìn thấy (CSS var `--app-vvh`, do hook `useVisualViewportVars` cập nhật từ `window.visualViewport`). Panel tự cuộn bên trong. Header gắn `MODAL_STICKY_HEADER`, hàng nút gắn `MODAL_STICKY_FOOTER`, cả hai phải có nền đặc để nội dung cuộn bên dưới không bị lộ.
- `onDismiss` dùng cho phím Escape và cho click ra nền nếu bật `dismissOnBackdrop`. Khi đang gửi request (mutation pending) thì truyền `undefined` để người dùng không đóng nhầm. React giữ trạng thái `open`, nên sự kiện `cancel` luôn bị chặn rồi chuyển cho `onDismiss`. Nếu trình duyệt vẫn ép đóng (Chrome làm vậy khi bấm Escape liên tục), `Modal` sẽ gọi `onDismiss` hoặc mở lại để khớp với `open`.
- Khi mở modal, focus đặt vào panel (gắn `autofocus`) chứ không vào input, để bàn phím không tự bật lên. Khi đóng, focus trả về nút đã mở modal. `Modal` tự làm việc này, vì khi prop `open` chuyển sang false thì React đã gỡ `<dialog>` khỏi DOM trước lúc cleanup, nên trình duyệt không tự trả focus được. Trang nền bị khoá cuộn qua `useBodyScrollLock`. Hook này đếm tham chiếu, nên mở chồng nhiều lớp không bị mở khoá sớm; pull-to-refresh cũng đọc trạng thái này để không chạy khi đang mở dialog.
- Lớp hiển thị: dialog nằm ở top layer, cao hơn mọi z-index; dialog mở sau tự nằm trên dialog mở trước, nên không còn prop `layer`. Hệ quả: thứ gì portal ra `document.body` sẽ bị dialog che. Thành phần nổi (menu, popover) dùng trong modal phải portal vào `element.closest('dialog') ?? document.body`, như `CategoryAutocomplete`. Toast của các màn hình nằm ngoài dialog, nên sẽ bị che nếu hiện lúc modal đang mở.

**Ô nhập 16px trên màn cảm ứng**: trên màn cảm ứng (`@media (hover: none) and (pointer: coarse)`), ô nhập, select và textarea luôn dùng chữ 16px.
- **Vì sao**: iOS tự zoom vào ô nhập có chữ dưới 16px. Trước đây app giữ chữ nhỏ và chặn zoom bằng `IosViewportFix` (thêm `maximum-scale=1` trên iPhone). Khi test trên iPhone thật trong app đã cài (22/10/2026), chạm ô nhập vẫn bị zoom, nên đổi sang cách chắc chắn là chữ 16px.
- **Desktop** vẫn giữ chữ 11–13px.
- `IosViewportFix` vẫn giữ làm lớp phòng hờ.
- **Android**: không tự zoom kiểu này, viewport vẫn giữ `maximumScale: 5` và `interactiveWidget: 'resizes-content'`.

**Đơn vị chiều cao**: dùng `h-dvh` / `min-h-dvh` thay cho `h-screen` / `100vh`, vì trên iOS `100vh` không co lại theo thanh địa chỉ hay bàn phím. Toast `fixed bottom` cộng thêm `env(safe-area-inset-bottom)` để không bị thanh home của iPhone che.

**Kiểm thử thủ công**: trong Chrome DevTools, chọn thiết bị 375×812 rồi đổi chiều cao còn khoảng 380px để giả lập lúc bàn phím mở. Tiêu đề và nút phải luôn hiển thị, nội dung ở giữa cuộn được. Hiện tượng auto-zoom và bàn phím thật chỉ kiểm được trên iPhone/Android thật.

## State giao diện dùng chung (Zustand)

State thuần giao diện dùng chung cho cả app (theme sáng/tối, ẩn/hiện số tiền) được đặt trong các store Zustand ở `apps/web/src/shared/store/`, theo Tier 4 của rule quản lý state. Trước đây chúng là React Context provider lồng nhau trong `AppProviders`; chuyển sang Zustand giúp bỏ bớt lớp provider và boilerplate `createContext`/`useMemo`, đồng thời có thể đọc state ngoài component qua `getState()`.

- **Vì sao dùng store singleton (`create()`)**: web là static export, không có server runtime nên không có nguy cơ rò state giữa các request. Không cần pattern bọc store trong Context + `useRef` như ứng dụng SSR.
- **Theme**: script inline trong `app/layout.tsx` đặt `data-theme` trước khi React chạy để tránh nháy màu. Store bắt đầu ở `light` để HTML build sẵn và lần render đầu khớp nhau (tránh lệch hydration), sau đó `AppProviders` gọi `syncFromDocument()` khi mount. Mỗi lần bấm đổi theme đều được lưu vào `localStorage['zalobot-theme']`.
- **Ẩn/hiện số tiền**: store chỉ sống trong bộ nhớ, tuyệt đối không bật `persist`, nên F5 luôn ẩn lại. Hàm định dạng `money()` được tính trong hook `useMoneyFormatter()` từ trạng thái ẩn/hiện và locale, không lưu trong store.
- **Locale vẫn là Context** (`LocaleProvider`): mỗi lần đổi ngôn ngữ thì gần như toàn bộ giao diện phải render lại, nên chuyển sang Zustand không có lợi.
- Component chỉ dùng các hook công khai `useTheme()`, `useMoneyVisibility()`, `useMoneyFormatter()`. Không lưu dữ liệu từ server vào Zustand; phần đó thuộc TanStack Query.
