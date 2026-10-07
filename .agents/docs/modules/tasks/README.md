---
metadata:
  agent-artifact:
    id: docs-module-tasks
    type: documentation
    depends_on:
      - .agents/knowledge/modules/tasks/README.md
---

# Module công việc Google Tasks (Web)

`apps/web/src/modules/tasks` quản lý tương tác API, trạng thái server-state và bảng dữ liệu hỗ trợ chỉnh sửa trực tiếp (inline edit) cho Google Tasks trên giao diện Web Dashboard.

## Tổng quan tính năng & Cấu trúc cột bảng

Bảng dữ liệu công việc (`TasksScreen`) được xây dựng 100% bằng Tailwind CSS utility classes (hỗ trợ dark mode `dark:`) và cung cấp đầy đủ các cột dữ liệu và tính năng tương tác chuẩn Enterprise UI:

1. **Cột Trạng thái (`status`)**:
   - Checkbox đánh dấu hoàn thành/chưa hoàn thành nhanh chóng.
   - Badge trạng thái trực quan (_Cần làm_ `needsAction` hoặc _Đã xong_ `completed`).
2. **Cột Tiêu đề (`title`)**:
   - Hiển thị tên công việc (gạch ngang khi đã hoàn thành).
   - Nhấn đúp chuột hoặc bấm nút Sửa để mở input chỉnh sửa trực tiếp.
3. **Cột Ghi chú (`notes`)**:
   - Hiển thị ghi chú chi tiết của công việc.
   - Hỗ trợ chỉnh sửa inline bằng input text.
4. **Cột Hạn chót (`dueAt`)**:
   - Hiển thị ngày giờ hết hạn đã format theo ngôn ngữ (`vi-VN` hoặc `en-US`).
   - Hỗ trợ chọn ngày hạn chót trực tiếp trong chế độ edit.
5. **Cột Cập nhật (`updatedAt`)**:
   - Hiển thị thời điểm cập nhật công việc gần nhất.
6. **Cột Thao tác (`actions`)**:
   - Chế độ xem: Nút Sửa (✎) và Xóa (🗑).
   - Chế độ chỉnh sửa: Nút Lưu (✓) và Hủy (✕).

## Tương tác & Phím tắt (Inline Editing)

- **Kích hoạt chỉnh sửa**: Nhấp đúp chuột (double-click) vào bất kỳ ô nào trên hàng hoặc bấm nút Sửa.
- **Phím tắt**:
  - `Enter`: Lưu thay đổi tức thì.
  - `Escape`: Hủy bỏ chỉnh sửa và khôi phục dữ liệu ban đầu.
- **Bộ lọc & Tìm kiếm**:
  - Thanh công cụ lọc kỳ thời gian đa cấp độ (`PeriodFilterToolbar` & `usePeriodFilter`): Ngày (`day`), Tuần (`week`), Tháng (`month`), Quý (`quarter`), Năm (`year`), Tất cả (`all`).
  - Dải nút lọc trạng thái kèm số đếm thời gian thực: Tất cả (`all`), Cần làm (`needsAction` - mặc định), Đã xong (`completed`).
  - Ô tìm kiếm tức thì theo tiêu đề và nội dung ghi chú.
- **Thông báo phản hồi**: Toast notification xuất hiện khi lưu hoặc xóa công việc thành công.

## Cấu trúc mã nguồn & Tích hợp Backend

- `tasks-api.ts`: Triển khai `getTasks`, `updateTask`, `deleteTask` trỏ đến endpoint `API_ROUTES.tasks` (`/api/tasks`).
- `tasks-query.ts`: Cung cấp Query Key Factory `tasksQueryKeys` cùng các hooks `useTasksQuery`, `useUpdateTaskMutation`, `useDeleteTaskMutation` tự động đồng bộ cache.
- `tasks-screen.tsx`: Giao diện hiển thị bảng DataTable tích hợp chỉnh sửa trực tiếp, bộ lọc thời gian và trạng thái.
- `GoogleResourcesController` (`apps/api`): Tự động nạp cả task đang làm và đã hoàn thành (`showCompleted: true`, `showHidden: true`), đồng thời chuẩn hóa dữ liệu từ Google Tasks API sang `ITaskListItem` (`dueAt`, `updatedAt`, `completedAt`).

## Quy trình kiểm thử

1. Chạy `npm run typecheck` và `npm run lint` để kiểm tra an toàn kiểu và chuẩn mã nguồn.
2. Chạy `npm run test --workspace @zalobot/api` để chạy test backend.
3. Chạy `npm run build` để kiểm tra build toàn bộ monorepo.
4. Kiểm tra các thao tác sửa inline, chuyển đổi các tab thời gian (Ngày, Tuần, Tháng, Quý, Năm, Tất cả) và lọc trạng thái (Đã xong, Cần làm) trên trình duyệt.
