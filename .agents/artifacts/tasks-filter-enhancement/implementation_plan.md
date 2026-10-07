# Kế hoạch cải tiến và sửa lỗi bộ lọc danh sách Tasks (Google Tasks)

## Tổng quan & Bối cảnh

Người dùng phản ánh 2 vấn đề lớn trên màn hình quản lý công việc (Tasks):

1. **Lỗi bộ lọc trạng thái**: Filter "Đã xong" không hiển thị dữ liệu và filter "Tất cả" không thấy các task đã hoàn thành.
2. **Thiếu bộ lọc thời gian**: Chưa có khả năng lọc công việc theo Ngày, Tuần, Tháng, Quý như các màn hình giao dịch và chi tiêu.

## Phân tích nguyên nhân gốc rễ (Root Cause Analysis)

1. **Nguyên nhân lỗi bộ lọc trạng thái**:
   - Endpoint `GET /api/tasks` trên backend (`GoogleResourcesController`) kiểm tra `showCompleted: query.showCompleted === 'true'`. Khi frontend gọi `getTasks()` không truyền tham số này, backend gửi `showCompleted: false` sang Google Tasks API.
   - Google Tasks API khi nhận `showCompleted: false` sẽ loại bỏ toàn bộ task đã hoàn thành. Ngoài ra, trong Google Tasks, các task hoàn thành thường có cờ `hidden: true`, nên cần truyền cả `showCompleted: true` và `showHidden: true` để lấy toàn bộ dữ liệu.
   - Khi frontend lọc trên mảng `rawList`, do danh sách tải về từ API ban đầu chỉ có các task `needsAction`, nên khi bấm filter "Đã xong" mảng kết quả luôn rỗng (`[]`), và "Tất cả" cũng chỉ có task chưa xong.
   - Đồng thời, `GoogleResourcesController.listTasks` trả về trực tiếp schema Google Task (`due`, `updated`, `completed`) thay vì ánh xạ sang đúng contract `ITaskListItem` (`dueAt`, `updatedAt`, `completedAt`), làm sai lệch hiển thị ngày tháng.

2. **Thiếu bộ lọc thời gian**:
   - `TasksScreen` chưa tích hợp thanh công cụ `PeriodFilterToolbar` và hook `usePeriodFilter`.
   - Hook `usePeriodFilter` hiện tại mới chỉ hỗ trợ `week`, `month`, `quarter`, `year`; chưa hỗ trợ `day` (theo ngày/hôm nay) và `all` (toàn bộ thời gian).

---

## User Review Required

> [!NOTE]
> Mặc định bộ lọc thời gian cho Tasks sẽ đặt là `all` (hoặc `month`) để người dùng thấy đầy đủ các việc trước mắt. Người dùng có thể dễ dàng chuyển đổi nhanh giữa: **Ngày**, **Tuần**, **Tháng**, **Quý**, **Năm**, **Tất cả**.

> [!IMPORTANT]
> Toàn bộ văn bản hiển thị và nhãn bộ lọc mới tuân thủ nghiêm ngặt chuẩn đa ngôn ngữ i18n (`packages/contracts/src/index.ts`) cho cả tiếng Việt và tiếng Anh.

---

## Thay đổi đề xuất (Proposed Changes)

### 1. Packages / Shared Contracts (`packages/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung translation keys cho `period.day`, `period.all`, `period.label.day`, `period.label.all` cho cả hai ngôn ngữ `vi` và `en`.
- Bổ sung translation keys cho thống kê tasks: `tasks.stats.total`, `tasks.stats.pending`, `tasks.stats.completed`, `tasks.stats.overdue`.

---

### 2. Backend Module (`apps/api`)

#### [MODIFY] [google-tasks.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/google/google-tasks.service.ts)

- Điều chỉnh `listTasks` để mặc định lấy đầy đủ task (`showCompleted: true` và `showHidden: true`) khi không có yêu cầu lọc ngược lại.

#### [MODIFY] [google-resources.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/google/google-resources.controller.ts)

- Chuẩn hoá `listTasks`, `createTask`, `updateTask` để ánh xạ chính xác schema Google Task sang contract `ITaskListItem` (`due -> dueAt`, `updated -> updatedAt`, `completed -> completedAt`).
- Cho phép nhận `showCompleted` và `showHidden` linh hoạt từ query params với giá trị mặc định là `true`.

#### [MODIFY] [reports.controller.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/reports/reports.controller.ts)

- Đảm bảo hàm `getTasks` khi nạp dữ liệu cho Dashboard Overview cũng lấy đủ cả task đã hoàn thành và chưa hoàn thành.

---

### 3. Frontend Shared (`apps/web/src/shared`)

#### [MODIFY] [use-period-filter.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/hooks/use-period-filter.ts)

- Cập nhật kiểu `PeriodGrain = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all'`.
- Thêm logic tính toán mốc thời gian cho `'day'` (00:00:00 đến 23:59:59 của ngày tham chiếu) và `'all'` (toàn bộ khoảng thời gian).
- Cập nhật hàm `isItemInPeriod`:
  - Khi grain là `'all'`: trả về `true` cho mọi item.
  - Khi grain khác: kiểm tra `itemDate >= startDate && itemDate <= endDate`.

#### [MODIFY] [period-filter-toolbar.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/period-filter-toolbar.tsx)

- Bổ sung prop `grains?: PeriodGrain[]` để tuỳ chỉnh danh sách nút bấm theo nhu cầu từng màn hình (mặc định vẫn giữ nguyên tương thích ngược với các trang khác).
- Render các nút Ngày (`day`), Tuần (`week`), Tháng (`month`), Quý (`quarter`), Năm (`year`), Tất cả (`all`).
- Ẩn/vô hiệu hoá nút chuyển tiến/lùi khi đang ở chế độ `'all'`.

---

### 4. Frontend Tasks Module (`apps/web/src/modules/dashboard/view/tasks-screen.tsx`)

#### [MODIFY] [tasks-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/tasks-screen.tsx)

- Tích hợp `usePeriodFilter('month')` và `PeriodFilterToolbar` vào giao diện.
- Bổ sung dải thống kê tóm tắt nhanh (Strip metrics): Tổng việc, Cần làm, Đã xong, Quá hạn.
- Cập nhật logic lọc 3 chiều:
  1. Lọc theo khoảng thời gian được chọn: `periodFilter.isItemInPeriod(item.dueAt || item.updatedAt)`.
  2. Lọc theo trạng thái: Tất cả (`all`), Cần làm (`needsAction`), Đã xong (`completed`).
  3. Lọc theo từ khóa tìm kiếm: Tiêu đề (`title`) hoặc Ghi chú (`notes`).
- Cập nhật `refresh` để tự động làm mới cả `tasksQuery` và `dashboardQuery`.

---

## Kế hoạch kiểm thử & Xác thực (Verification Plan)

### Automated Tests

1. **Kiểm tra kiểu dữ liệu toàn hệ thống**:
   ```bash
   npm run typecheck
   ```
2. **Kiểm tra unit tests backend**:
   ```bash
   npm run test --workspace @zalobot/api
   ```
3. **Kiểm tra tính toàn vẹn hệ thống Agent**:
   ```bash
   npm run agent-system:validate
   ```

### Manual Verification

1. Mở trang `/tasks`:
   - Kiểm tra tab "Tất cả" hiển thị đầy đủ cả việc cần làm và việc đã hoàn thành.
   - Bấm vào tab "Đã xong" -> Kiểm tra danh sách hiển thị chính xác các việc có trạng thái Completed kèm gạch ngang tiêu đề.
   - Bấm vào tab "Cần làm" -> Kiểm tra danh sách hiển thị chính xác các việc Pending.
2. Kiểm tra bộ lọc thời gian:
   - Chọn "Ngày": Điều hướng xem các task trong từng ngày cụ thể (tiến/lùi ngày).
   - Chọn "Tuần": Hiển thị các task trong tuần hiện tại (tiến/lùi tuần).
   - Chọn "Tháng": Hiển thị các task trong tháng hiện tại (tiến/lùi tháng).
   - Chọn "Quý": Hiển thị các task trong quý hiện tại (tiến/lùi quý).
   - Chọn "Tất cả": Hiển thị toàn bộ công việc không giới hạn thời gian.
3. Thao tác inline:
   - Check/uncheck checkbox hoàn thành -> Trạng thái cập nhật ngay lập tức và lọc lại chính xác.
   - Sửa inline tiêu đề/ngày hạn -> Dữ liệu lưu thành công.
