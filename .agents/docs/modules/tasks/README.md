---
metadata:
  agent-artifact:
    id: docs-module-tasks
    type: documentation
    depends_on:
      - .agents/knowledge/modules/tasks/README.md
      - apps/web/src/modules/tasks/api/tasks-api.ts
      - apps/web/src/modules/tasks/api/tasks-query.ts
      - apps/web/src/modules/dashboard/presentation/components/tasks-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/tasks-table.tsx
      - apps/api/src/google/google-resources.controller.ts
---

# Module công việc Google Tasks (Web)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/tasks/README.md). Quy tắc backend (tạo task từ chat, xác nhận, cảnh báo trùng, tạo hàng loạt) xem ở [`global/google-tasks.md`](../../global/google-tasks.md).

## 1. Nghiệp vụ

Người dùng tạo việc cần làm bằng cách chat với bot; việc được lưu thẳng vào Google Tasks của họ. Dashboard cho phép xem lại, đánh dấu xong, sửa và xoá các việc đó mà không cần mở ứng dụng Google.

## 2. Ai sở hữu code nào

- `apps/web/src/modules/tasks` **chỉ có thư mục `api/`**:
  - `tasks-api.ts`: `getTasks`, `updateTask`, `deleteTask`, gọi `API_ROUTES.tasks` (`/api/tasks`).
  - `tasks-query.ts`: query key `['tasks']` và các hook `useTasksQuery`, `useUpdateTaskMutation`, `useDeleteTaskMutation`. Sửa/xoá thành công thì làm mới cache `tasks` và `dashboard`.
- **Màn hình và bảng nằm ở module dashboard**: `TasksScreen` và `TasksTable` trong `apps/web/src/modules/dashboard/presentation/components/`. Trang `/tasks` import từ `@/modules/dashboard/view/tasks-screen`.

## 3. Màn hình Việc cần làm

- **Nguồn dữ liệu**: `useTasksQuery`. Nếu API trả danh sách rỗng, màn hình dùng tạm `tasks` trong dữ liệu dashboard. Nếu chưa kết nối Google, bảng hiện gợi ý kết nối.
- **Lọc theo kỳ**: thanh `PeriodFilterToolbar` với Ngày, Tuần, Tháng, Quý, Năm, Tất cả; **mặc định là Tháng**. Một việc thuộc kỳ theo hạn chót (`dueAt`), nếu không có hạn thì theo thời điểm cập nhật.
- **Thẻ tổng quan** cho kỳ đang chọn: tổng số, chưa xong, đã xong, quá hạn (chưa xong và hạn đã qua).
- **Lọc trạng thái**: Tất cả / Cần làm (mặc định) / Đã xong. Các nút này không hiển thị số đếm; số đếm nằm ở thẻ tổng quan.
- **Tìm kiếm** tức thì theo tiêu đề và ghi chú.
- **Cột bảng**:
  1. Trạng thái: checkbox đổi nhanh giữa Cần làm và Đã xong, kèm badge.
  2. Tiêu đề.
  3. Ghi chú.
  4. Hạn chót: hiển thị theo ngôn ngữ; ở chế độ sửa là ô chọn ngày.
  5. Cập nhật lúc.
  6. Thao tác: Sửa, Xoá; khi đang sửa thì Lưu, Huỷ.
- **Sửa trực tiếp**: nhấp đúp vào ô hoặc bấm Sửa. `Enter` lưu, `Escape` huỷ.
- Xoá có hộp thoại xác nhận; lưu/xoá thành công hiện toast. Khi lỗi hiện dải cảnh báo với nút Thử lại.

## 4. Tích hợp backend

- `GoogleResourcesController` (`apps/api/src/google/google-resources.controller.ts`) cung cấp `GET/POST /api/tasks` và `GET/PATCH/DELETE /api/tasks/:id`, gọi `GoogleTasksService`.
- `GET /api/tasks` mặc định lấy cả việc đã xong (`showCompleted=true`, `showHidden` theo `showCompleted`), nên bộ lọc "Đã xong" trên web có dữ liệu.
- Dữ liệu Google (`due`, `updated`, `completed`) được đổi tên thành `dueAt`, `updatedAt`, `completedAt` trong `ITaskListItem`.

## 5. Kiểm thử

1. `npm run typecheck` và `npm run lint`.
2. `npm run test --workspace @zalobot/api` cho backend.
3. `npm run build` cho toàn monorepo.
4. Thử tay trên trình duyệt: sửa inline, đổi kỳ thời gian, lọc trạng thái, tick hoàn thành và xoá.
