# Kế Hoạch Đồng Bộ & Chuẩn Hoá Giao Diện Skeleton Loading với Giao Diện Thực Tế

Tài liệu này tổng hợp phân tích chi tiết các điểm sai lệch giữa Skeleton Loading và Giao diện Thực tế (Real UI) trong ứng dụng Web, đặc biệt là các thành phần bị thiếu đường viền (`border`), cấu trúc ô bảng (`td`), và các khối `DataPanel` bị khuyết khi tải dữ liệu.

---

## 1. Phân Tích Hiện Trạng & Các Điểm Lệch Cấu Trúc (Discrepancies)

Qua rà soát toàn bộ mã nguồn giao diện (`apps/web/src`), phát hiện 4 khu vực chính có sự sai lệch giữa Skeleton và Real UI:

### 1.1. Bảng Dữ Liệu Dùng Chung (`DataTable` trong `apps/web/src/shared/ui/data-table.tsx`)

- **Giao diện thực tế**:
  - Mỗi ô `td` có đầy đủ đường viền ngăn cách dọc và đáy: `border-r border-b border-r-slate-50 border-b-slate-100 last:border-r-0 dark:border-r-slate-900/60 dark:border-b-slate-800`.
  - Mỗi ô `td` áp dụng `style={{ minWidth: column.minWidth, width: getColumnWidth(column) }}` để cố định độ rộng cột.
  - Căn lề số tiền / ngày tháng (`align === 'right'`).
- **Skeleton hiện tại**:
  - Ô `td` chỉ có `h-8 px-2 py-1 align-middle`, **hoàn toàn thiếu đường viền ngăn cách dọc `border-r` và viền đáy `border-b` ở cấp độ cell**.
  - Không truyền `style` độ rộng cột (`minWidth`, `width`), khiến các cột bị co cụm hoặc nhảy layout khi chuyển từ skeleton sang dữ liệu thật.
  - Khối `animate-pulse` luôn căn trái `w-3/4`, không căn phải đối với các cột số tiền/thao tác.

### 1.2. Màn Hình Trang Chủ Dashboard (`DashboardHomeScreen` & `DashboardHomeSkeleton`)

- **Giao diện thực tế**:
  - 6 thẻ KPI Metric có `rounded-[3px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60`.
  - Thanh liên kết nhanh Quick Links: `<section className="flex flex-wrap gap-1.5 rounded border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">` chứa 7 nút bấm bo góc có viền `border border-slate-300 bg-slate-50`.
  - Lưới 2 cột chứa 6 `DataPanel` (Công việc, Nhắc việc, Lịch sự kiện, Thu chi, Công nợ, Nhật ký) có đầy đủ viền khung `border border-slate-200`, header `border-b`, ô tìm kiếm và bảng dữ liệu.
- **Skeleton hiện tại**:
  - Thừa một thẻ `<header>` với viền đáy `border-b` ghi chữ _"zalobot · Đang tải dữ liệu..."_ (trong khi giao diện thật không hề có header này vì `PrivateLayout` đã có sẵn `WorkspaceHeader`).
  - **Thiếu toàn bộ thanh Quick Links** (khối hộp có `border border-slate-200`).
  - **Thiếu toàn bộ 6 khối `DataPanel` phía dưới**, dẫn đến 80% màn hình bị trống trơn khi đang tải, sau đó đột ngột giật khung khi dữ liệu về.

### 1.3. Màn Hình Thống Kê & Phân Tích (`AnalyticsScreen` trong `analytics-screen.tsx`)

- **Giao diện thực tế**:
  - Thanh công cụ lọc kỳ `PeriodFilterToolbar` với viền `border border-slate-200 bg-slate-50`.
  - 5 thẻ KPI Metric (`border border-slate-200`).
  - `DataPanel` Xu hướng dòng tiền (Cashflow Trend) với khung `border border-slate-200`, header `border-b` và vùng biểu đồ.
  - Lưới 2 `DataPanel` bên dưới: Cơ cấu chi tiêu (Donut Chart) và Cơ cấu công nợ (Debt Structure).
- **Skeleton hiện tại**:
  - Chỉ render 5 ô KPI nhỏ, **bỏ qua toàn bộ thanh PeriodFilterToolbar và 3 khối `DataPanel` biểu đồ** (không có border và khung bao).

### 1.4. Màn Hình Sổ Thu Chi (`TransactionsScreen` trong `transactions-screen.tsx`)

- **Hiện trạng**:
  - Khi `dashboard.isLoading`, component hiển thị dòng text thô: `<div className="p-4 text-xs text-slate-500">{t('common.loadingDashboard')}</div>` thay vì render cấu trúc layout với `PeriodFilterToolbar`, `TrendSummaryStrip`, `DataPanel` và `DataTable loading={true}`.

---

## 2. Các Thay Đổi Cụ Thể Đề Xuất

### [Component 1] Shared UI Data Table

#### [MODIFY] [data-table.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/data-table.tsx)

- Cập nhật dòng skeleton `td` trong `DataTable` để bổ sung:
  - Viền dọc và viền đáy đồng bộ với dòng thật: `border-r border-b border-r-slate-50 border-b-slate-100 last:border-r-0 dark:border-r-slate-900/60 dark:border-b-slate-800`.
  - Thuộc tính inline style: `style={{ minWidth: column.minWidth, width: getColumnWidth(column) }}`.
  - Căn chỉnh vạch `animate-pulse` sang phải (`ml-auto`) khi `column.align === 'right'`.

---

### [Component 2] Dashboard Home View

#### [MODIFY] [dashboard-home-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx)

- Viết lại `DashboardHomeSkeleton`:
  - Loại bỏ thẻ `<header>` thừa gây giật layout.
  - Bổ sung thanh Quick Links skeleton với viền khung `border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900` và 7 nút pill pulse.
  - Bổ sung 6 `DataPanel` skeleton trong lưới 2 cột (`grid grid-cols-2 gap-3 max-[960px]:grid-cols-1`) đại diện cho Tasks, Reminders, Calendar, Transactions, Debts, Activity. Mỗi panel có `border border-slate-200`, header `border-b`, ô tìm kiếm skeleton và `DataTable loading={true}`.

---

### [Component 3] Analytics View

#### [MODIFY] [analytics-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/analytics-screen.tsx)

- Bổ sung `AnalyticsSkeleton` hoàn chỉnh:
  - Khung `PeriodFilterToolbar` skeleton.
  - 5 thẻ KPI metric skeleton (`border border-slate-200`).
  - `DataPanel` Xu hướng dòng tiền skeleton với viền `border border-slate-200`, header `border-b` và vùng biểu đồ skeleton (220px) với các thanh pulse dạng cột.
  - 2 khối `DataPanel` (Cơ cấu chi tiêu & Cơ cấu công nợ) với viền `border border-slate-200`, header `border-b` và vòng tròn/thanh pulse giả lập chart.

---

### [Component 4] Transactions View

#### [MODIFY] [transactions-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/transactions-screen.tsx)

- Loại bỏ đoạn render text `common.loadingDashboard` thô sơ.
- Render đầy đủ cấu trúc khung trang bao gồm `PeriodFilterToolbar`, `TrendSummaryStrip`, `DataPanel` và `TransactionsTable loading={dashboard.isLoading}` để tận dụng bảng skeleton có đầy đủ viền cột.

---

## 3. Kế Hoạch Kiểm Thử & Xác Minh (Verification Plan)

### Kiểm thử Tự động (Automated Verification)

- Chạy `npm run typecheck` trên toàn bộ monorepo để đảm bảo không phát sinh lỗi kiểu TypeScript.
- Chạy `npm run lint` để kiểm tra quy chuẩn mã nguồn và formatting.
- Chạy `npm run agent-system:validate` để xác nhận tính toàn vẹn hệ thống quy tắc.

### Kiểm thử Thủ công (Manual Visual Verification)

1. **Kiểm tra bảng `DataTable`**: Bật cờ `loading={true}` ở các bảng và kiểm tra viền ô (`border-r`, `border-b`) sắc nét, đồng đều giữa các ô, độ rộng cột giữ nguyên không bị co giật khi chuyển trạng thái.
2. **Kiểm tra Dashboard Home**: Tải trang Home, xác nhận xuất hiện đầy đủ 6 thẻ KPI + thanh liên kết Quick Links + 6 DataPanels với đường viền ngoài và viền header `border-b`.
3. **Kiểm tra Analytics**: Tải trang Thống kê, xác nhận có đủ thanh bộ lọc kỳ + 5 KPI cards + 3 DataPanels biểu đồ với viền bao quanh.
4. **Kiểm tra chế độ Sáng / Tối (Light / Dark mode)**: Đảm bảo các viền `border-slate-200` và `dark:border-slate-800` hiển thị chuẩn xác, không bị chói hoặc biến mất trong Dark mode.
