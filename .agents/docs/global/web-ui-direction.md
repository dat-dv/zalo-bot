---
metadata:
  agent-artifact:
    id: docs-global-web-ui-direction
    type: documentation
    depends_on:
      - .agents/knowledge/global/web-ui-direction.md
      - apps/web/src/styles.css
      - apps/web/src/shared/ui/data-table.tsx
      - apps/web/src/shared/ui/workspace-header.tsx
      - apps/web/src/shared/ui/app-navigation.tsx
      - apps/web/src/shared/providers/money-visibility-provider.tsx
      - apps/web/src/shared/ui/modal.tsx
      - apps/web/src/shared/ui/ios-viewport-fix.tsx
      - apps/web/src/shared/hooks/use-body-scroll-lock.ts
      - apps/web/src/shared/hooks/use-visual-viewport.ts
      - apps/web/app/layout.tsx
---

# Định hướng UI web dùng chung

Web dashboard là giao diện tác vụ cá nhân, ưu tiên dữ liệu dễ quét và thao tác gọn: một workspace phẳng, viền nhẹ, control nhỏ gọn; tránh card trang trí hoặc shadow nặng. Tailwind CSS v4 là lớp styling duy nhất cho 100% component và màn hình giao diện web: toàn bộ bố cục, data panel, bảng dữ liệu, dialog modal, form inline edit, KPI metrics, biểu đồ và các nút hành động đều dùng trực tiếp utility classes có hỗ trợ tiền tố `dark:` và responsive variants. File `apps/web/src/styles.css` chỉ gồm `@import 'tailwindcss'`, khai báo `@custom-variant dark` và một lớp CSS nền nhỏ: màu chữ/nền/font cho `:root`, màu cho `html[data-theme='dark']`, màu outline `:focus-visible` ở dark mode (`#93c5fd`), `box-sizing` và mặc định của `body`. Không có class BEM hay class component nào.

Các primitive dùng chung trong `apps/web/src/shared/ui/` chịu trách nhiệm panel/bảng tái sử dụng. Trên desktop, bảng phải phủ hết chiều ngang bên trong panel; bảng dùng HTML semantic, căn phải số liệu, có trạng thái loading, rỗng và có dữ liệu. Trên màn hình di động hẹp, bảng hỗ trợ cuộn ngang mượt mà (`min-width: max-content` kết hợp `minWidth` của từng cột) để đảm bảo các thông tin quan trọng (Số tiền, Thời gian, Badge trạng thái) không bao giờ bị bóp méo hoặc cắt cụt. Cột thao tác (`id: 'actions'`) bắt buộc khai báo `minWidth` đầy đủ (120px–150px), bọc container bằng `flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap`, và gán `shrink-0 whitespace-nowrap` cho từng nút bấm (`Sửa`, `Xóa`, `Lưu`, `Hủy`, `Trả nợ`, `Hoãn`) cùng các badge phân loại để đảm bảo không bao giờ bị rớt dòng trên mọi kích thước màn hình.

Các bảng dữ liệu nghiệp vụ bắt buộc sử dụng các thành phần Common Table dùng chung (`TransactionsTable`, `DebtsTable`, `TasksTable`, `RemindersTable`, `CalendarTable`) thay vì tự định nghĩa lại `DataTableColumn` tại từng trang riêng lẻ (`dashboard-home-screen`, `transactions-screen`, `debts-screen`, `tasks-screen`, `reminders-screen`, `calendar-screen`, `analytics-screen`). Việc gom về component dùng chung đảm bảo toàn bộ số hàng, số cột, format tiền tệ, biểu đồ thanh trực quan, tính năng autocomplete, inline editing và cài đặt ẩn/hiện cột được hiển thị đồng bộ, nhất quán 100% trên toàn ứng dụng.

Thành phần `DataTable` tích hợp sẵn nút Cài đặt cột (`TableColumnSettings`) với menu popover cho phép người dùng bật/tắt hiển thị từng cột và tự động lưu cấu hình vào `localStorage` (`zalobot:table-columns:<id>`). Mỗi dòng bắt buộc có trường `id`: `DataTable` tự thêm hai cột bắt buộc `STT` (số thứ tự theo danh sách đang hiển thị) và `ID` trước các cột nghiệp vụ; người dùng không thể ẩn hai cột này, còn ID được hiển thị dưới dạng nút bấm mono tương tác. Khi nhấp vào ô ID, hệ thống mở hộp thoại `IdExplainerDialog` giải thích thông tin bảng CSDL (`finance_transactions`, `debts`, `tasks`, `reminders`, `calendar_events`, `debt_contacts`, `finance_places`, `categories`...), cung cấp nút sao chép ID 1-click và bộ 3 câu lệnh mẫu cho AI Agent (Sửa, Xóa, Tra cứu) để người dùng dán trực tiếp vào Zalo Bot. Bảng tự sắp xếp sau khi lọc theo thời gian phát sinh nghiệp vụ: dữ liệu lịch sử ưu tiên mới nhất (`occurredAt`, rồi `paymentDate`, rồi `createdAt`), còn lịch/nhắc việc/công việc ưu tiên mốc sắp tới (`remindAt`, `startAt`, `dueAt`); dòng không có hạn nằm cuối. Mọi bảng có `id` cũng cho phép kéo mép phải của header để đổi độ rộng cột, lưu riêng theo `zalobot:table-widths:<id>` và tự khôi phục khi tải lại trang; khi cần, view có thể tắt bằng `allowColumnResize={false}`. Mỗi view tự quản lý danh sách cột nghiệp vụ, tải dữ liệu, lỗi và hành động.

Nút phải có focus rõ, độ tương phản đủ và lỗi phải kèm cách thử lại.

Tiêu đề không gian làm việc (`WorkspaceHeader`) được render **một lần duy nhất** trong common private layout (`apps/web/app/(private)/layout.tsx`) bằng `<WorkspaceHeader />` không truyền props — component tự động resolve title và subtitle từ `usePathname()` thông qua `ROUTE_HEADER_MAP`. Component phân biệt hai trạng thái auth: **Đã xác thực** (`hasToken && !isLoggedOut`, trong đó `isLoggedOut` lấy từ query `?status=logged_out` sau khi đăng xuất): hiển thị title/subtitle theo route, nút `Ẩn/Hiện số tiền` (`useMoneyVisibility`), nút Làm mới (`queryClient.invalidateQueries()`), và nút Đăng xuất; **Chưa xác thực / Đã đăng xuất**: hiển thị title/subtitle theo route và link "Mở Zalo Bot" (key `auth.openzaloBot`, URL lấy từ `NEXT_PUBLIC_ZALO_BOT_URL` hoặc `NEXT_PUBLIC_ZALO_BOT_USERNAME`, mặc định `https://zalo.me`). **Các file screen trong từng module tuyệt đối không được tự render `<WorkspaceHeader>`** — layout đã cung cấp sẵn cho mọi trang. Mặt nạ che số tiền (key `common.maskedAmount` = `'••••••'`) áp dụng đồng bộ cho các khối KPI, bảng dữ liệu và tooltip biểu đồ. Mặc định số tiền bị ẩn (tránh lộ khi mở dashboard nơi công cộng); lựa chọn của người dùng được lưu trong `localStorage` key `zalobot-money-visibility`; các ô input khi đang sửa trực tiếp trên dòng (inline edit) vẫn giữ số thực để phục vụ thao tác.

Thanh điều hướng dùng chung (`apps/web/src/shared/ui/app-navigation.tsx`) theo kiểu sidebar quản trị trên desktop: phân thành 5 nhóm nghiệp vụ (Tổng quan, Tài chính, Kế hoạch, Dữ liệu, Hệ thống — key `nav.section.*`), có ô chọn ngôn ngữ, có dấu nhận diện sản phẩm, icon đi cùng chữ và tự động nhận diện trạng thái trang đang mở theo `usePathname()`. Desktop dùng app shell giới hạn theo viewport: chỉ vùng main content được cuộn, còn sidebar luôn đứng yên bên cạnh. Khi thêm mục mới, luôn giữ nhãn chữ hiển thị qua hệ thống i18n, SVG chỉ là phần hỗ trợ quét nhanh, và đặt `aria-current="page"` cho mục active.

Trên màn hình hẹp (<= 960px), shell trở lại cơ chế cuộn trang bình thường và giao diện tự động chuyển đổi thành Mobile Topbar sticky trên cùng kết hợp nút Hamburger Button. Khi bấm vào, Drawer Menu điều hướng trượt mượt mà từ bên trái kèm Backdrop làm mờ nền; tự động đóng khi chọn link, bấm backdrop hoặc bấm Escape.

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

## Modal trên mobile & bàn phím ảo

**Vì sao cần**: trước đây mỗi modal tự viết overlay `fixed inset-0` căn giữa, không giới hạn chiều cao. Trên điện thoại, khi bấm vào input, bàn phím ảo chiếm khoảng nửa màn hình nên tiêu đề và nút Lưu/Huỷ bị đẩy ra ngoài, không cuộn tới được. Ngoài ra input chữ nhỏ hơn 16px làm iOS Safari tự phóng to trang và giữ nguyên mức zoom sau khi đóng bàn phím, nên giao diện bị "vỡ".

**Quy tắc bắt buộc**:

- Mọi modal/dialog phải dùng `Modal` trong `apps/web/src/shared/ui/modal.tsx`. Không tự viết overlay `fixed inset-0` nữa (ngoại lệ duy nhất là lớp nền của drawer menu mobile).
- **Desktop (≥ 640px)**: panel căn giữa như cũ. **Mobile (< 640px)**: dạng *bottom-sheet*, tức panel rộng hết màn hình, dính mép dưới và chỉ bo góc trên, giống bảng "Chia sẻ" của iOS. Kiểu này giúp nút hành động nằm ngay trên bàn phím và dễ bấm bằng ngón cái.
- Overlay lấy chiều cao theo phần màn hình còn nhìn thấy (CSS var `--app-vvh`, do hook `useVisualViewportVars` cập nhật từ `window.visualViewport`). Panel tự cuộn bên trong. Header gắn `MODAL_STICKY_HEADER`, hàng nút gắn `MODAL_STICKY_FOOTER`, cả hai phải có nền đặc để nội dung cuộn bên dưới không bị lộ.
- `onDismiss` dùng cho phím Escape và cho click ra nền nếu bật `dismissOnBackdrop`. Khi đang gửi request (mutation pending) thì truyền `undefined` để người dùng không đóng nhầm.
- Khi mở modal, focus đặt vào panel chứ không vào input, để bàn phím không tự bật lên. Trang nền bị khoá cuộn qua `useBodyScrollLock`. Hook này đếm tham chiếu và dùng chung với drawer menu, nên mở chồng nhiều lớp không bị mở khoá sớm.
- z-index: modal thường dùng `z-[900]`, modal mở chồng lên modal khác (giải thích ID trong DataTable) dùng `layer="top"` (`z-[950]`), menu gợi ý danh mục dùng `z-[1000]`.

**Vì sao không tăng cỡ chữ input lên 16px**: dashboard cố ý dùng control nhỏ gọn (11–13px) để hiển thị được nhiều dữ liệu. Thay vào đó, `IosViewportFix` (gắn trong `AppProviders`) chỉ thêm `maximum-scale=1` trên iPhone/iPad. Từ iOS 10, Safari vẫn cho người dùng zoom bằng hai ngón nhưng không tự zoom khi focus input nữa. Android không có hiện tượng auto-zoom này nên vẫn giữ `maximumScale: 5`, và nhờ `interactiveWidget: 'resizes-content'` trong viewport, Android Chrome tự co layout khi bàn phím mở.

**Đơn vị chiều cao**: dùng `h-dvh` / `min-h-dvh` thay cho `h-screen` / `100vh`, vì trên iOS `100vh` không co lại theo thanh địa chỉ hay bàn phím. Toast `fixed bottom` cộng thêm `env(safe-area-inset-bottom)` để không bị thanh home của iPhone che.

**Kiểm thử thủ công**: trong Chrome DevTools, chọn thiết bị 375×812 rồi đổi chiều cao còn khoảng 380px để giả lập lúc bàn phím mở. Tiêu đề và nút phải luôn hiển thị, nội dung ở giữa cuộn được. Hiện tượng auto-zoom và bàn phím thật chỉ kiểm được trên iPhone/Android thật.
