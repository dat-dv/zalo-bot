---
metadata:
  agent-artifact:
    id: docs-module-tasks
    type: documentation
    depends_on:
      - .agents/knowledge/modules/tasks/README.md
      - apps/api/src/tasks/tasks.service.ts
      - apps/api/src/tasks/tasks.controller.ts
      - apps/api/src/database/migrations/1724890000000-DropTaskGoogleCopy.ts
      - apps/api/src/database/entities/task.entity.ts
      - apps/web/src/modules/tasks/api/tasks-api.ts
      - apps/web/src/modules/tasks/api/tasks-query.ts
      - apps/web/src/modules/dashboard/presentation/components/tasks-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/tasks-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/create-task-dialog.tsx
      - apps/web/src/modules/tasks/model/task-create-form.ts
---

# Module Việc cần làm (tasks)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/tasks/README.md). Quy tắc tạo việc từ chat, xác nhận và cảnh báo trùng xem ở [`global/google-tasks.md`](../../global/google-tasks.md).

## 1. Nghiệp vụ: việc cần làm chỉ lưu trong zalobot

- Task lưu trong bảng `tasks` của zalobot. Dashboard, bot và trang Tổng quan đều đọc và ghi vào đây.
- **Dùng chung như sổ chung**: ai cũng thấy mọi task. Người tạo và nhóm Zalo nguồn chỉ để hiển thị, không dùng để lọc.
- **Không đồng bộ với Google Tasks**, không cần kết nối Google để tạo, xem hay sửa việc.

### Vì sao bỏ đồng bộ Google Tasks

Commit `637487f` từng sao chép task lên Google Tasks (giống lịch); bản này bỏ đồng bộ đó vì:

- API Google Tasks **chỉ giữ ngày** của hạn chót, bỏ phần giờ, nên bản sao không nhắc đúng giờ trên điện thoại. Đây vốn là lý do chính để giữ bản sao Google ở **lịch**.
- Danh sách việc là chung, nhưng bản sao chỉ nằm trong **một** tài khoản Google, nên người khác không thấy được trên Google.
- Cần nhắc đúng giờ thì đã có **lời nhắc** qua Zalo.
- Đồng bộ kéo theo 5 trạng thái (đã lên Google, đang đồng bộ, lỗi, chỉ trong app, ở tài khoản cũ), nút Đồng bộ lại, nhập ngược từ Google mỗi lần đọc và một lượt gọi Google mỗi lần ghi.

Lịch **vẫn giữ** bản sao Google Calendar.

**Dữ liệu cũ**: không có bước nhập riêng từ Google Tasks. Task nào đã được bản `637487f` nhập vào DB (nếu bản đó từng chạy) vẫn được giữ, chỉ đổi nguồn thành dashboard; task chỉ có trên app Google Tasks thì vẫn nằm trên app Google, việc nào còn cần thì thêm lại trên dashboard hoặc qua `/task`.

## 2. Ai sở hữu code nào

- Backend `apps/api/src/tasks/`: `TasksService` là nơi duy nhất đọc/ghi task; `TasksController` phục vụ `/api/tasks` (danh sách, chi tiết, tạo, sửa, xoá mềm). Module không còn phụ thuộc Google.
- Bảng `tasks`: migration `CreateTasks` tạo bảng, migration `DropTaskGoogleCopy` xoá các cột của bản sao Google (`google_task_id`, `google_account_email`, `sync_status`...) và đổi các dòng có nguồn `google` thành `dashboard`. Dùng migration mới thay vì sửa migration cũ để DB nào đã chạy bản cũ cũng về đúng cấu trúc.
- `GoogleTasksService` đã bị xoá. Đăng nhập Google **không còn xin quyền Google Tasks**; token đã cấp trước vẫn dùng bình thường.
- Tên người tạo và tên nhóm Zalo lấy qua `loadRecordOriginLookups` trong `apps/api/src/google/google-copy.util.ts` (dùng chung với lịch, gọi không kèm Google).
- Web `apps/web/src/modules/tasks/api/`: `getTasks`, `createTask`, `updateTask`, `deleteTask` và các hook TanStack Query tương ứng. Mọi mutation làm mới cache `tasks` và `dashboard`.
- Web `apps/web/src/modules/tasks/model/task-create-form.ts`: hàm thuần (có unit test) kiểm tra và dựng request cho form thêm việc.
- Màn hình, bảng và hộp thoại thêm việc nằm ở module dashboard: `TasksScreen`, `TasksTable`, `CreateTaskDialog`.

## 3. Màn hình Việc cần làm

- **Thêm việc**: nút `+ Thêm việc` trên toolbar (desktop) hoặc ở thanh hành động dưới cùng (điện thoại) mở hộp thoại gồm tiêu đề (bắt buộc), ghi chú, hạn chót.
  - Hạn chót lưu theo cùng quy ước với khi sửa trực tiếp (cuối ngày, giờ UTC).
  - Nếu đang lọc "Đã xong", màn hình tự chuyển về "Cần làm" sau khi thêm để người dùng thấy ngay việc vừa tạo.
- **Lọc theo kỳ** (mặc định Tháng), **thẻ tổng quan**: tổng, cần làm, đã xong, quá hạn.
- **Lọc trạng thái** Tất cả / Cần làm (mặc định) / Đã xong; tìm theo tiêu đề và ghi chú.
- **Cột bảng**: Trạng thái, Tiêu đề, Ghi chú, Hạn chót, Cập nhật, **Người tạo** (tên hoặc nguồn, kèm nhóm Zalo), Thao tác.
- Sửa trực tiếp như cũ; xoá trống ô ghi chú hoặc hạn chót rồi lưu thì trường đó được xoá. Xoá task dùng hộp xác nhận trong app (thay `window.confirm`).
- Trang Tổng quan dùng bảng rút gọn (không có cột Người tạo).

## 4. Kiểm thử

1. `npm run typecheck`, `npm run lint`, `npm run test --workspace @zalobot/api` (có `tasks.service.spec.ts`, `task.mapper.spec.ts`).
2. `npm run build --workspace @zalobot/contracts` trước (web và API đọc kiểu từ `dist`), rồi `npm run build --workspace @zalobot/web`.
3. Sau khi deploy (migration `CreateTasks` và `DropTaskGoogleCopy` tự chạy): tạo (bằng nút **+ Thêm việc**)/sửa/hoàn thành/xoá một task trên `/tasks`, khi chưa kết nối Google cũng phải làm được; gõ `/task mua sữa` trên Zalo rồi `/tasks`.
