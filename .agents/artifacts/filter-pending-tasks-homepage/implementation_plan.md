# Implementation Plan - Filter Completed Tasks on Homepage

Lọc bỏ những công việc đã hoàn thành (`status === 'completed'`) khỏi danh sách "Việc cần làm" tại Trang chủ (`dashboard-home-screen.tsx`), chỉ hiển thị các công việc chưa làm xong.

## Proposed Changes

### Dashboard Module

#### [MODIFY] [dashboard-home-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-home-screen.tsx)

- Cập nhật logic `filteredTasks` trong `dashboard-home-screen.tsx`:
  - Thay vì sử dụng danh sách toàn bộ công việc `data.tasks` làm dữ liệu đầu vào cho `filteredTasks`, chuyển sang sử dụng `pendingTasks` (danh sách đã lọc `item.status !== 'completed'`).
  - Đảm bảo tìm kiếm `taskSearch` hoạt động trên danh sách công việc chưa hoàn thành `pendingTasks`.

```tsx
// Trước khi sửa:
const filteredTasks = useMemo(() => {
  if (!taskSearch.trim()) return data.tasks;
  const q = taskSearch.toLowerCase();
  return data.tasks.filter((item) => item.title.toLowerCase().includes(q));
}, [data.tasks, taskSearch]);

// Sau khi sửa:
const filteredTasks = useMemo(() => {
  if (!taskSearch.trim()) return pendingTasks;
  const q = taskSearch.toLowerCase();
  return pendingTasks.filter((item) => item.title.toLowerCase().includes(q));
}, [pendingTasks, taskSearch]);
```

## Verification Plan

### Automated Verification

- Chạy `npm run typecheck` để đảm bảo không có lỗi kiểu dữ liệu TypeScript.
- Chạy `npm run lint` để đảm bảo tuân thủ linter.

### Manual Verification

- Kiểm tra giao diện Trang chủ: Khối "Việc cần làm" chỉ hiển thị công việc có trạng thái chưa hoàn thành (`needsAction`), không còn hiển thị các việc đã làm xong (`completed`).
