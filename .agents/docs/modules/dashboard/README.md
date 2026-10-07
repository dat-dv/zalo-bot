---
metadata:
  agent-artifact:
    id: docs-module-dashboard
    type: documentation
    depends_on:
      - .agents/knowledge/modules/dashboard/README.md
---

# Module dashboard

`apps/web/src/modules/dashboard` hiển thị trang Tổng quan và Thống kê từ payload dashboard đã xác thực.

- API/cache: `getDashboard` gọi `API_ROUTES.dashboard`; `useDashboardQuery` là nguồn query key duy nhất, chấp nhận tùy chọn `{ enabled?: boolean }` để kiểm soát thời điểm kích hoạt truy vấn. Nút Làm mới phải invalidate key này và key `['finance-analytics']`.
- UI & Skeleton Loading: Chuẩn **Flat Enterprise + Data-Dense B2B SaaS + Excel-lite interaction**, xây dựng 100% bằng Tailwind CSS utility classes, mở rộng 100% Fullscreen (không giới hạn container max-width), bo góc tối giản 2px–4px. Toàn bộ liên kết ngoài (như link sự kiện Google Calendar, tài liệu ngoại vi) mở trong tab mới an toàn (`target="_blank" rel="noopener noreferrer"`). Tiêu đề các bảng tác nghiệp trên trang chủ (`Việc cần làm`, `Nhắc nhở`, `Lịch sự kiện`, `Giao dịch gần đây`, `Công nợ đang theo dõi`) là liên kết điều hướng (`titleHref` trên `DataPanel`) chuyển thẳng đến trang quản trị tương ứng (`/tasks`, `/reminders`, `/calendar`, `/transactions`, `/debts`) kèm hiệu ứng hover và icon mũi tên `→`. Trạng thái Skeleton Loading (`DashboardHomeSkeleton`, `AnalyticsSkeleton`) bắt buộc tuân thủ nguyên tắc **Full Fidelity (mô phỏng 1:1)**: giữ nguyên toàn bộ các khối `DataPanel` bao ngoài (`border border-slate-200` và header `border-b`), thanh liên kết nhanh Quick Links (khung hộp `border border-slate-200` chứa 7 nút có viền), thanh lọc kỳ `PeriodFilterToolbar`, khung biểu đồ Cashflow Trend 220px, và các ô bảng `DataTable` với đầy đủ viền ngăn cách `border-r`, `border-b` và thuộc tính cố định độ rộng cột. Tuyệt đối không tự sinh thêm thẻ `<header>` thừa trong skeleton của view. Luôn giữ trạng thái rỗng rõ ràng, cảnh báo có nút thử lại khi lỗi (sử dụng component `SessionStateScreen` với các nút Mở lại zalo Bot, Xóa phiên & Thử lại hoặc Đóng zalo Mini App), và các bảng dữ liệu dày khi thành công với header dính (`sticky table header`).
- Trang Báo cáo & Phân tích trực quan (`/analytics` - `AnalyticsScreen`):
  - Tinh gọn thành **1 màn hình Single-Page Dashboard phân tích liền mạch** từ trên xuống dưới, loại bỏ các sub-tabs rời rạc và các bảng CRUD dư thừa:
    - **Kết quả trong kỳ**: 4 thẻ (Tổng thu, Tổng chi, Tiết kiệm ròng, % Tích lũy) luôn đổi đúng theo bộ lọc thời gian.
    - **Tình hình tài chính hiện tại**: panel riêng, không bị bộ lọc tác động, gồm Số dư dòng tiền theo sổ (toàn bộ thu trừ chi), Phải thu còn lại, Phải trả còn lại và Tài sản ròng (`số dư dòng tiền + phải thu - phải trả`). Đây không phải số dư ngân hàng/ví thực tế vì hệ thống chưa quản lý số dư đầu kỳ của từng tài khoản.
    - **Chuẩn Common UI**: cả hai nhóm KPI dùng `MetricGrid` dùng chung; các nút filter/khu vực đổi Biểu đồ–Bảng dùng primitive `Button` dùng chung. Không dùng thẻ tương tác HTML raw trong feature Analytics. Class layout, màu, spacing và responsive giữ nguyên; chỉ bổ sung focus ring khi điều hướng bằng bàn phím.
    - **Khu vực Xu hướng dòng tiền (Full-width)**: Biểu đồ `CashflowTrendChart` (Composed Bar/Line Chart Recharts) trực quan hóa Thu vào, Chi ra và Đường Biến động số dư ví tích lũy theo thời gian; có nút chuyển đổi linh hoạt trên toolbar giữa xem Biểu đồ (`chart`) và Bảng số liệu chi tiết theo kỳ (`table` qua `DataTable` với các cột Thu vào, Chi ra, Dòng tiền thuần và Số dư tích lũy).
    - **Lưới phân rã 2 cột**:
      - Cột trái: `CategoryDonutChart` (Donut Pie Chart Recharts) phân bổ tỷ trọng chi tiêu từng danh mục (Top 5 danh mục + nhóm Khác) kèm thanh tiến độ tỷ lệ % và số tiền.
      - Cột phải: `DebtStructureChart` hiển thị thanh tỷ lệ đối sánh Phải thu vs Phải trả và danh sách Top đối tác nợ lớn nhất.
  - Tách bạch hoàn toàn bảng CRUD: Các thao tác thêm/sửa/xóa/inline-edit chi tiết tập trung tại các trang chuyên biệt (`/transactions` và `/debts`), giúp trang Analytics nhẹ, tập trung 100% vào phân tích và insight.
  - Tích hợp bộ lọc thời gian đa tầng `PeriodFilterToolbar` với `usePeriodFilter` (`day`, `week`, `month`, `quarter`, `year`, `all`), đồng bộ URL query parameters (`?period=...&ref=...`).
  - Gọi API `GET /api/finance/analytics` qua hook `useFinanceAnalyticsQuery({ startAt, endAt, grain })`: `summary` là số liệu trong kỳ, `currentPosition` là toàn bộ lịch sử đến hiện tại, còn `debts` phục vụ cơ cấu công nợ hiện tại.
  - Hệ thống biểu đồ **Recharts** hiện đại: Tự động responsive theo màn hình, hỗ trợ Dark/Light mode của Tailwind, animation mượt mà khi đổi kỳ và tooltip đẹp mắt.
- Tất cả bảng dữ liệu tác nghiệp—bao gồm Thu chi (`TransactionsScreen` và `TransactionsTable` tích hợp badge Thu/Chi chuẩn màu sắc emerald/amber và cột Số dư sau GD lũy kế theo thời gian), Công việc (`TasksScreen`), Lịch (`CalendarScreen`), Nhắc nhở (`RemindersScreen`), và Công nợ (`DebtsScreen`)—đều sử dụng các component **Common Table dùng chung** (`TransactionsTable`, `DebtsTable`, `TasksTable`, `RemindersTable`, `CalendarTable`) để đảm bảo tính nhất quán và hiển thị đầy đủ số hàng, số cột trên mọi trang. Các bảng hỗ trợ chỉnh sửa trực tiếp trên dòng (`inline row editing`) khi nhấp đúp chuột hoặc bấm nút Sửa (✎), tích hợp menu gợi ý danh mục tự động (`<datalist>` thông minh kết hợp danh mục cấu hình người dùng từ `useCategoriesQuery()` và lịch sử giao dịch thích ứng theo Loại giao dịch: Thu/Chi), đi kèm cột thao tác (`actions` có `minWidth: 130px`, `flex-nowrap whitespace-nowrap` và nút bấm `shrink-0` chống rớt dòng), nút Lưu/Hủy/Xóa/Trả nợ nhanh, phím tắt `Enter`/`Escape` và thông báo toast phản hồi thao tác. Màn hình Lịch (`CalendarScreen`) hỗ trợ nút chuyển đổi chế độ xem linh hoạt giữa ma trận Lịch tháng trực quan (`CalendarGrid` với huy hiệu sự kiện, chọn ngày nhanh, sửa/xóa sự kiện tại chỗ) và dạng bảng cô đọng (`CalendarTable`), đi kèm cụm điều hướng tháng (Trước/Sau/Hôm nay) và tìm kiếm tức thì. Ở dạng bảng, cột **Mô tả** mặc định gọn, tự xuống hàng; người dùng kéo mép header để đổi độ rộng cột và mỗi bảng ghi nhớ độ rộng theo `DataTable` id trên trình duyệt. Khi đổi tháng, màn hình lấy trực tiếp toàn bộ khoảng dữ liệu của lưới tháng đang xem; không dùng dữ liệu lịch tóm tắt từ dashboard làm dự phòng. Nút làm mới phải xóa mọi biến thể cache lịch theo khoảng thời gian và cache dashboard để dữ liệu không bị cũ. Tất cả bảng dữ liệu đều có thanh công cụ tìm kiếm nhanh (Search toolbar), bộ lọc tức thì và hỗ trợ cấu hình ẩn/hiện cột có ghi nhớ trạng thái (Column visibility persistence với `id="transactions"`, `id="debts"` và `id="tasks"`), độ rộng tối thiểu cột `minWidth` và thanh tiến độ trực quan theo tỷ lệ tiền tệ. Số liệu tài chính định dạng `tabular-nums`. Trên desktop, thanh điều hướng là Sidebar quản trị cố định bên trái; trên màn hình nhỏ (<= 960px), giao diện chuyển đổi linh hoạt thành Mobile Topbar dính trên đầu cùng nút Hamburger Button mở rộng Navigation Drawer trượt từ bên trái với Backdrop làm mờ nền. Không hiển thị nhãn trạng thái kết nối Google cố định ở sidebar hoặc tiêu đề; trạng thái này chỉ dùng để chọn thông điệp rỗng phù hợp cho Lịch và Việc cần làm. Màu xanh/vàng/đỏ chỉ biểu thị số liệu tốt/cần theo dõi/âm. Cuối sidebar/drawer có nút đổi giao diện sáng/tối và chuyển đổi ngôn ngữ (Tiếng Việt/English); lựa chọn được lưu trong trình duyệt, lần đầu sẽ theo cài đặt hệ thống.
- Ẩn/hiện số tiền nhạy cảm toàn ứng dụng: Component `WorkspaceHeader` được render **một lần duy nhất** trong common private layout (`apps/web/app/(private)/layout.tsx`), tích hợp nút `Ẩn số tiền` / `Hiện số tiền` (`MoneyVisibilityProvider`). **Các screen file trong từng module tuyệt đối không tự render `<WorkspaceHeader>` riêng.** Trạng thái mặc định là **Ẩn (`false`)** khi mới truy cập để bảo vệ quyền riêng tư, và tùy chọn của người dùng được lưu trong `localStorage` (`zalobot-money-visibility`). Khi bật chế độ ẩn, các số tiền ở thẻ KPI, cột bảng, footer tổng kết và tooltip biểu đồ được che bằng mặt nạ `'••••••'`; riêng các ô input khi đang sửa trực tiếp (inline edit) vẫn giữ số thực để người dùng thao tác bình thường.
- Đăng xuất: gọi API logout, xóa token qua module `auth`, xóa cache query rồi chuyển hướng về `${APP_ROUTES.home}?status=logged_out` để hiển thị màn hình Đã đăng xuất thành công qua `SessionStateScreen`.

## Nơi chốn trong bảng Thu chi & Trang Quản lý Nơi chốn (/places)

- **Cột Nơi chốn trên bảng Thu chi**: Bảng Thu chi có cột **Nơi chốn** để hiển thị quán ăn, cửa hàng hoặc địa điểm của phát sinh. Trường sửa nhanh dùng combobox lấy danh sách `/api/places`, vẫn cho phép gõ tên mới để backend tạo/tái sử dụng nơi chốn. Tìm kiếm bảng bao gồm cả tên nơi chốn. Khi xóa nội dung trường này rồi lưu, client gửi `placeId: null` để chỉ gỡ liên kết, không xóa giao dịch hay lịch sử nơi chốn.
- **Trang Quản lý Nơi chốn & Địa điểm (`/places` - `PlacesScreen`)**:
  - Cung cấp màn hình quản lý độc lập cho danh mục địa điểm, quán ăn, cửa hàng và bệnh viện.
  - Bảng dữ liệu sử dụng `DataTable` (`id="places"`), tự động tích hợp 2 cột hệ thống bắt buộc `STT` và `ID`, đi cùng các cột nghiệp vụ: `Tên nơi chốn / Địa điểm` (hỗ trợ double-click inline edit, phím tắt `Enter`/`Escape`), `Thời gian tạo`, `Hoạt động` (Sửa, Xóa).
  - Hỗ trợ thêm nhanh nơi chốn mới qua nút `+ Thêm nơi chốn` trên toolbar, tìm kiếm theo thời gian thực và xác nhận xóa an toàn 2 bước inline.
  - Tích hợp vào thanh điều hướng Sidebar dưới mục **DỮ LIỆU** (`nav.section.data`) với icon định vị chuẩn.
- **Xóa Giao dịch & Modal Cảnh báo Biến động Số dư (`DeleteTransactionModal`)**:
  - Khi người dùng bấm nút Xóa (✕) trên bảng Thu chi, thay vì sử dụng popup `window.confirm` thô sơ của trình duyệt, hệ thống mở modal chuyên nghiệp `DeleteTransactionModal`.
  - Modal hiển thị thông tin chi tiết giao dịch (Loại Thu/Chi, Danh mục, Nơi chốn, Số tiền, Thời gian, Ghi chú) kèm khối cảnh báo trực quan về tác động số dư dòng tiền:
    - Với khoản **Chi**: Cảnh báo màu xanh ngọc: _Cộng hoàn lại vào số dư ví: `+amount`_ (vì khoản tiền không còn bị chi ra, số dư thực tế tăng lên).
    - Với khoản **Thu**: Cảnh báo màu hổ phách/đỏ: _Khấu trừ giảm khỏi số dư ví: `-amount`_ (vì khoản tiền thu vào bị hủy, số dư thực tế giảm đi).
    - Với giao dịch có phân bổ công nợ: Hiển thị cảnh báo màu đỏ về việc khôi phục số nợ chưa trả cho các khoản nợ liên quan.
  - Hỗ trợ phím tắt `Escape`, bấm backdrop để đóng an toàn và hiển thị loading spinner khi đang gọi API xóa.
- **Modal Cân chỉnh & Bù trừ Số dư ví (`AdjustBalanceModal`)**:
  - Cung cấp giao diện cân chỉnh số dư ví nhanh chóng, truy cập được từ nút `Cân chỉnh số dư` (⚖️) trên thanh Quick Links trang chủ, thanh công cụ DataPanel của Sổ giao dịch (`/transactions`) và tab Tùy chọn trong Cài đặt (`/settings`).
  - Người dùng nhập số dư thực tế hiện tại trong tài khoản/ví. Hệ thống tự động đối soát với số dư lũy kế trên sổ:
    - **Chênh lệch tăng (`diff > 0`)**: Tự động sinh giao dịch `income` danh mục `Điều chỉnh số dư` (`category.balanceAdjustment`).
    - **Chênh lệch giảm (`diff < 0`)**: Tự động sinh giao dịch `expense` danh mục `Điều chỉnh số dư`.
  - Tự động tạo ghi chú mô tả trực quan (`Cân chỉnh số dư ví: {current} ➔ {target}`) cho phép chỉnh sửa, chọn ngày giờ áp dụng và tự động invalidate toàn bộ cache React Query liên quan (`dashboardQueryKeys.detail()`, `['transactions']`, `['expenses']`, `['finance-analytics']`).
- **Phân bổ Giao dịch vào Công nợ & Mở rộng Hàng con Inline (`DebtAllocationModal` & `TransactionsTable`)**:
  - Trên bảng giao dịch thu chi (`TransactionsTable`), các giao dịch có phân bổ công nợ hiển thị icon nút bấm Chevron xoay (`▶ / ▼` với `rotate-90`) bên cạnh huy hiệu phân bổ (`🔗 N phân bổ`).
  - Khi bấm mở rộng, hệ thống hiển thị Sub-panel thụt lề 1 cấp (`renderExpandedRow`, `colSpan={columns.length}`) ngay dưới giao dịch cha, hiển thị bảng mini các khoản phân bổ (Đối tác nợ, số tiền phân bổ, ghi chú) và nút sửa phân bổ trực tiếp.
  - Cửa sổ `DebtAllocationModal` (`apps/web/src/modules/dashboard/presentation/components/debt-allocation-modal.tsx`) tải danh sách các khoản nợ khả dụng của liên hệ tương ứng qua `useDebtAllocationCandidatesQuery`, cho phép phân bổ số tiền giao dịch vào một hoặc nhiều khoản nợ, gọi `POST /api/debts/allocations` qua `useAllocateTransactionMutation`.
  - Toàn bộ callbacks (`onClose`, `onSuccess`) và các action handlers trên `TransactionsScreen` đều được bọc trong `useCallback` để đảm bảo tính ổn định của tham chiếu.

## Cơ chế chống treo render & Tối ưu hiệu năng Bảng dữ liệu

- **Chống vòng lặp re-render vô tận trong `DataTable`**: `DataTable` (`src/shared/ui/data-table.tsx`) sử dụng chuỗi khóa `allColumnsKey` làm dependency cho `useEffect` thay vì mảng đối tượng `allColumns`. Đồng thời tích hợp cơ chế so sánh giá trị cũ/mới (equality guard) trước khi cập nhật state `setVisibleColumnIds` và `setColumnWidths` từ `localStorage`. Trạng thái chỉ được ghi nhận lại khi có sự thay đổi thực sự, triệt tiêu 100% hiện tượng re-render vô tận làm đơ chuột hay khóa giao diện trên trang `/transactions`.
- **Tối ưu hóa `usePeriodFilter`**: Object trả về của `usePeriodFilter` được bọc trong `useMemo` để giữ nguyên tham chiếu giữa các lượt render khi khoảng thời gian lọc không đổi.
- **Ổn định tham chiếu fallback trong `DebtAllocationModal`**: `DebtAllocationModal` (`apps/web/src/modules/dashboard/presentation/components/debt-allocation-modal.tsx`) sử dụng các hằng số mảng tĩnh `EMPTY_CANDIDATE_DEBTS` và `EMPTY_ALLOCATIONS` làm fallback cho `useCandidateDebtsQuery` và `useTransactionAllocationsQuery`, loại bỏ hoàn toàn việc tạo mảng mới `[]` trên mỗi render khiến component bị render loop hoặc re-render dư thừa khi dữ liệu đang tải.

## Cấu hình production

## Combobox Danh mục Thu chi

Khi sửa trực tiếp một giao dịch, trường **Danh mục** dùng combobox autocomplete thay cho `<datalist>`. Click hoặc focus để mở danh sách; gõ để lọc; dùng `ArrowUp`/`ArrowDown` và `Enter` để chọn. `Escape` đầu tiên đóng danh sách, `Escape` tiếp theo hủy sửa dòng. Danh sách lấy danh mục mặc định theo Thu/Chi, danh mục do người dùng cấu hình và lịch sử giao dịch; vẫn cho phép nhập danh mục mới. Menu được render nổi để không bị cắt bởi vùng cuộn của bảng.

- `NEXT_PUBLIC_API_URL=https://zalobot.datintech.site`, không thêm `/api`, vì hằng `API_ROUTES` đã có tiền tố này.
- Static export không có API route của Next.js. Nginx phải chuyển `https://zalobot.datintech.site/api/*` sang NestJS và trả `apps/web/out` cho mọi route khác.
- Khi thay đổi `NEXT_PUBLIC_API_URL`, build lại image/web bundle vì biến này được đóng gói tại build-time.
- Nút Dashboard trong `/help` và `/start` là callback: mỗi lần bấm, bot cấp link dùng một lần mới trong tin nhắn phản hồi. Người dùng bấm link mới để mở dashboard; không bấm lại URL cũ.

## Chạy local và xử lý lỗi link

- Chạy đồng thời `npm run dev:api` (cổng `3000`) và `npm run dev:web` (cổng `5173`). Khi dev, Next chuyển `/api/*` từ `http://localhost:5173` sang `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:3000`), nên link Dashboard local có thể dùng cùng origin `5173`.
- Link exchange hợp lệ redirect sang `/` (kèm `#dashboard_token=...`). Link thiếu token, hết hạn hoặc đã dùng trả trang HTML tiếng Việt với HTTP `401`, hướng dẫn bấm lại nút Dashboard trên zalo.
- Nếu API cổng `3000` đang tắt, Next rewrite không thể tự dựng trang `503`; hãy khởi động `npm run dev:api`. Production dùng Nginx để proxy API và không dùng rewrite của Next.

Khi dữ liệu dashboard sai hoặc rỗng, kiểm tra DTO/API trước khi sửa cột hiển thị. Các bảng dùng primitive trong `src/shared/ui`, không tạo lại primitive riêng trong module.
