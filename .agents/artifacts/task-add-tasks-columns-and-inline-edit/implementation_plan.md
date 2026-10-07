# Kế hoạch triển khai: Thêm cột và hỗ trợ Inline Edit cho bảng Tasks

Tài liệu này mô tả chi tiết phương án thêm các cột dữ liệu mới và tính năng chỉnh sửa trực tiếp (inline edit) trên trang **Việc cần làm (Tasks)** (`/tasks`), đồng bộ dữ liệu với Google Tasks API thông qua backend NestJS và shared contracts.

---

## 1. Mục tiêu & Yêu cầu

1. **Bổ sung các cột dữ liệu trên bảng Tasks**:
   - **Trạng thái (`status`)**: Checkbox hoàn thành nhanh / Badge trạng thái (_Cần làm_ `needsAction` hoặc _Đã xong_ `completed*).
   - **Tiêu đề (`title`)**: Hiển thị tên công việc, hỗ trợ inline edit (nhấn đúp chuột hoặc nút Sửa).
   - **Ghi chú (`notes`)**: Hiển thị nội dung chi tiết/ghi chú của task, hỗ trợ inline edit.
   - **Hạn chót (`dueAt`)**: Hiển thị ngày giờ hết hạn đã format theo locale (`vi-VN`/`en-US`), hỗ trợ inline edit chọn ngày giờ.
   - **Thời gian cập nhật (`updatedAt`)**: Hiển thị thời điểm cập nhật gần nhất.
   - **Hành động (`actions`)**: Nút Sửa, Xóa khi ở chế độ xem; Nút Lưu (✓), Hủy (✕) khi đang inline editing.

2. **Cơ chế Inline Editing chuẩn Enterprise UI**:
   - Nhấn đúp (double-click) vào hàng hoặc bấm nút Sửa trên cột Thao tác để bật chế độ chỉnh sửa.
   - Nhấn phím `Enter` để lưu thay đổi, phím `Escape` để hủy bỏ chỉnh sửa.
   - Khi hoàn tất lưu, tự động cập nhật cache TanStack Query và hiển thị Toast thông báo thành công.
   - Đánh dấu hoàn thành trực tiếp bằng checkbox mà không cần mở form chỉnh sửa.

3. **Tuân thủ triệt để các tiêu chuẩn hệ thống**:
   - **i18n**: 100% text hiển thị được định nghĩa qua translation keys (`packages/contracts/src/index.ts`) cho cả Tiếng Việt và Tiếng Anh.
   - **Strict Type Safety & Zero-Any**: Không sử dụng `any`, định nghĩa đầy đủ DTO và Interface (`ITaskListItem`, `IUpdateTaskRequest`).
   - **Strict Routes**: Sử dụng `API_ROUTES.tasks` và `APP_ROUTES.tasks`.

---

## 2. Chi tiết các thay đổi dự kiến

### 2.1. Shared Contracts (`packages/contracts`)

- **[MODIFY] [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)**:
  - Bổ sung interface `ITaskListItem` và `IUpdateTaskRequest`:
    ```typescript
    export interface ITaskListItem {
      id: string;
      title: string;
      notes?: string;
      dueAt?: string;
      status?: 'needsAction' | 'completed';
      updatedAt?: string;
      completedAt?: string;
    }

    export interface IUpdateTaskRequest {
      title?: string;
      notes?: string;
      due?: string;
      status?: 'needsAction' | 'completed';
      taskListId?: string;
    }
    ```
  - Cập nhật `IDashboardData.tasks` sang `ITaskListItem[]`.
  - Thêm các key dịch thuật mới (`vi` và `en`):
    - `tasks.columns.status`, `tasks.columns.notes`, `tasks.columns.updatedAt`
    - `tasks.status.needsAction`, `tasks.status.completed`
    - `tasks.placeholder.title`, `tasks.placeholder.notes`, `tasks.placeholder.due`
    - `tasks.actions.edit`, `tasks.actions.save`, `tasks.actions.cancel`, `tasks.actions.delete`, `tasks.actions.complete`
    - `tasks.inlineEdit.saved`, `tasks.delete.confirm`, `tasks.delete.success`
    - `tasks.filter.all`, `tasks.filter.needsAction`, `tasks.filter.completed`

---

### 2.2. Backend API (`apps/api`)

- **[MODIFY] [`apps/api/src/reports/reports.controller.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/reports/reports.controller.ts)**:
  - Cập nhật mapping dữ liệu tasks trong endpoint `GET /dashboard` để trả về đầy đủ các trường `notes`, `status`, `updatedAt`:
    ```typescript
    tasks: tasks.map((item) => ({
      id: item.id || item.title || 'task',
      title: item.title || 'Không có tiêu đề',
      notes: item.notes || undefined,
      dueAt: item.due || undefined,
      status: (item.status as 'needsAction' | 'completed') || 'needsAction',
      updatedAt: item.updated || undefined,
    })),
    ```
- **[MODIFY] [`apps/api/src/google/google-resources.controller.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/google/google-resources.controller.ts)**:
  - Đảm bảo endpoint `PATCH /tasks/:id` và `DELETE /tasks/:id` trả về định dạng chuẩn xác khi được gọi từ frontend.

---

### 2.3. Web Frontend (`apps/web`)

- **[NEW] [`apps/web/src/modules/tasks/api/tasks-api.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/tasks/api/tasks-api.ts)**:
  - Triển khai các API client method:
    - `getTasks(signal?: AbortSignal): Promise<ITaskListItem[]>`
    - `updateTask(id: string, data: IUpdateTaskRequest, signal?: AbortSignal): Promise<ITaskListItem>`
    - `deleteTask(id: string, signal?: AbortSignal): Promise<boolean>`
- **[NEW] [`apps/web/src/modules/tasks/api/tasks-query.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/tasks/api/tasks-query.ts)**:
  - Định nghĩa Query Key Factory `tasksQueryKeys`
  - React Query Hook `useTasksQuery()`
  - React Query Mutation Hook `useUpdateTaskMutation()` (tự động invalidate `tasks` và `dashboard` query keys)
  - React Query Mutation Hook `useDeleteTaskMutation()`
- **[MODIFY] [`apps/web/src/modules/dashboard/view/tasks-screen.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/tasks-screen.tsx)**:
  - Tích hợp `useTasksQuery` và `useUpdateTaskMutation`, `useDeleteTaskMutation`.
  - Quản lý state `editingId` và `editDraft` (`title`, `notes`, `due`, `status`).
  - Xây dựng cấu hình các cột `DataTableColumn<ITaskListItem>` đầy đủ:
    1. **Cột `status`**: Checkbox toggle hoàn thành trực tiếp hoặc status pill.
    2. **Cột `title`**: Text / Input inline edit.
    3. **Cột `notes`**: Text / Input inline edit ghi chú.
    4. **Cột `dueAt`**: Localized datetime / Input date-time picker.
    5. **Cột `updatedAt`**: Localized time (mặc định hiển thị hoặc ẩn tùy chọn).
    6. **Cột `actions`**: Nút Sửa, Xóa hoặc nút Lưu/Hủy khi đang edit.
  - Bổ sung bộ lọc trạng thái (Tất cả / Cần làm / Đã hoàn thành) kết hợp thanh tìm kiếm.
  - Thông báo Toast phản hồi người dùng khi cập nhật/xóa thành công.

---

## 3. Kế hoạch kiểm thử & Đảm bảo chất lượng (Verification Plan)

### Automated Verification

1. **Typecheck toàn bộ monorepo**:
   ```bash
   npm run typecheck
   ```
2. **Build test cho Shared Contracts, API và Web**:
   ```bash
   npm run build
   ```
3. **Chạy Linter**:
   ```bash
   npm run lint
   ```
4. **Hệ thống kiểm tra chất lượng Agent System**:
   ```bash
   npm run agent-system:validate
   ```

### Manual Verification

- Mở trang `/tasks`, kiểm tra hiển thị đầy đủ các cột mới: Trạng thái, Tiêu đề, Ghi chú, Hạn chót, Cập nhật, Thao tác.
- Thử nghiệm tính năng Inline Edit:
  - Nhấp đúp chuột vào ô Tiêu đề hoặc Ghi chú -> Xuất hiện input chỉnh sửa.
  - Sửa nội dung và nhấn `Enter` -> Gửi PATCH request và hiển thị Toast "Đã cập nhật công việc".
  - Nhấn `Escape` -> Hủy bỏ thay đổi và quay lại dữ liệu cũ.
- Thử nghiệm checkbox hoàn thành nhanh -> Trạng thái task chuyển đổi giữa _needsAction_ và _completed_.
- Kiểm tra tính tương thích responsive trên cả mobile và desktop.
