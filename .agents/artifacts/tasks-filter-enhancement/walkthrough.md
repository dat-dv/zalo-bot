# Walkthrough: Sửa lỗi bộ lọc trạng thái và bổ sung bộ lọc thời gian cho Tasks

Đã hoàn thành khắc phục lỗi bộ lọc trạng thái ("Đã xong", "Tất cả") và nâng cấp bộ lọc thời gian đa cấp độ cho danh sách công việc Google Tasks trên giao diện Web Dashboard.

---

## 1. Các thay đổi đã thực hiện

### 1.1. Packages / Shared Contracts (`@zalobot/contracts`)

- **Đa ngôn ngữ (i18n)**:
  - Bổ sung translation keys cho `period.day`, `period.all`, `period.label.day`, `period.label.all` cho cả tiếng Việt (`vi`) và tiếng Anh (`en`).
  - Bổ sung translation keys cho thống kê tasks: `tasks.stats.total`, `tasks.stats.pending`, `tasks.stats.completed`, `tasks.stats.overdue`.

### 1.2. Backend API (`apps/api`)

- **`GoogleTasksService`**:
  - Cập nhật `listTasks` để tự động bật `showHidden: true` khi `showCompleted: true`, đảm bảo Google Tasks API không ẩn các công việc đã hoàn thành.
- **`GoogleResourcesController`**:
  - Cập nhật endpoint `GET /api/tasks` mặc định lấy toàn bộ task (`showCompleted: true`, `showHidden: true`).
  - Chuẩn hóa toàn bộ schema trả về từ Google Tasks (`due`, `updated`, `completed`) sang đúng interface `ITaskListItem` (`dueAt`, `updatedAt`, `completedAt`).
- **`ReportsController`**:
  - Nâng cấp `getTasks` cho Dashboard Overview nạp tối đa 50 tasks bao gồm cả tasks đã hoàn thành.

### 1.3. Frontend Shared & UI (`apps/web/src/shared`)

- **`usePeriodFilter`**:
  - Mở rộng `PeriodGrain` hỗ trợ `'day' | 'week' | 'month' | 'quarter' | 'year' | 'all'`.
  - Cập nhật logic tính toán ngày bắt đầu/kết thúc cho grain `'day'` (00:00:00 - 23:59:59) và `'all'` (toàn bộ thời gian).
- **`PeriodFilterToolbar`**:
  - Hỗ trợ prop `grains?: PeriodGrain[]` để tùy chỉnh linh hoạt các nút kỳ thời gian trên từng trang.
  - Tự động điều chỉnh thanh điều hướng ẩn/vô hiệu hóa khi chọn chế độ `'all'`.

### 1.4. Frontend Tasks Screen (`apps/web/src/modules/dashboard/view/tasks-screen.tsx`)

- Tích hợp `PeriodFilterToolbar` hỗ trợ 6 cấp độ lọc: **Ngày (`day`)**, **Tuần (`week`)**, **Tháng (`month`)**, **Quý (`quarter`)**, **Năm (`year`)**, **Tất cả (`all`)**.
- Bổ sung huy hiệu số lượng thời gian thực (real-time badge count) trên các nút lọc trạng thái:
  - `Tất cả (count)`
  - `Cần làm (count)`
  - `Đã xong (count)`
- Lọc 3 chiều mượt mà: Kỳ thời gian (`item.dueAt || item.updatedAt`) -> Trạng thái (`statusFilter`) -> Tìm kiếm từ khóa (`title` / `notes`).

---

## 2. Kết quả xác thực (Verification Results)

### Kiểm tra tự động

- **Typecheck**: `npm run typecheck` ➜ Passed (0 lỗi).
- **Unit Tests**: `npm run test --workspace @zalobot/api` ➜ 5/5 tests passed.
- **Web Build**: `npm run build:web` ➜ Compiled & Generated static pages successfully.
- **API Build**: `npm run build:api` ➜ Nest build successful.
- **Agent System Validation**: `npm run agent-system:validate` ➜ 85 artifacts, 149 dependencies, 0 cyclic groups passed.

---

## 3. Hướng dẫn kiểm tra thủ công (Manual Verification)

1. Mở trang `/tasks`:
   - Kiểm tra thanh công cụ kỳ thời gian hiển thị: `[Ngày] [Tuần] [Tháng] [Quý] [Năm] [Tất cả]`.
   - Bấm vào tab **Đã xong** ➜ Danh sách hiển thị chính xác các task đã hoàn thành có gạch ngang tiêu đề.
   - Bấm vào tab **Cần làm** ➜ Danh sách hiển thị các task đang chờ xử lý.
   - Bấm vào tab **Tất cả** ➜ Danh sách hiển thị đầy đủ cả 2 trạng thái kèm số đếm tổng.
2. Thử chuyển đổi các kỳ:
   - Chọn **Ngày** và bấm nút `‹` / `›` để xem task từng ngày.
   - Chọn **Tuần** / **Tháng** / **Quý** / **Tất cả** để theo dõi công việc theo khoảng thời gian mong muốn.
