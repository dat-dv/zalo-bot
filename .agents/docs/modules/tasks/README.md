---
metadata:
  agent-artifact:
    id: docs-module-tasks
    type: documentation
    depends_on:
      - .agents/knowledge/modules/tasks/README.md
      - apps/api/src/tasks/tasks.service.ts
      - apps/api/src/tasks/tasks.controller.ts
      - apps/api/src/database/entities/task.entity.ts
      - apps/web/src/modules/tasks/api/tasks-api.ts
      - apps/web/src/modules/tasks/api/tasks-query.ts
      - apps/web/src/modules/dashboard/presentation/components/tasks-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/tasks-table.tsx
---

# Module Việc cần làm (tasks)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/tasks/README.md). Quy tắc tạo việc từ chat, xác nhận và cảnh báo trùng xem ở [`global/google-tasks.md`](../../global/google-tasks.md).

## 1. Nghiệp vụ: vì sao lưu task trong DB

Trước đây hệ thống **không lưu việc cần làm**: mọi thao tác đi thẳng vào Google Tasks của tài khoản đang kết nối (phần lớn là tài khoản Google dùng chung của admin). Đổi tài khoản Google là task cũ "biến mất" khỏi dashboard và bot.

Bây giờ làm giống **lịch chung**:

- Task lưu trong bảng `tasks` của zalobot. Đây là bản gốc; dashboard, bot và trang Tổng quan đều đọc từ đây.
- Google Tasks chỉ giữ **bản sao**, để vẫn xem được trên app Google. Mỗi task nhớ bản sao nằm ở tài khoản nào (`google_account_email` + `google_task_id`).
- **Dùng chung như sổ chung**: ai cũng thấy mọi task. Người tạo và nhóm Zalo nguồn chỉ để hiển thị, không dùng để lọc.
- **Không cần kết nối Google**: chưa kết nối thì task vẫn lưu, gắn nhãn "Chỉ lưu trong app".

## 2. Đồng bộ với Google

| Tình huống | Hệ thống làm gì |
| --- | --- |
| Tạo task, có Google | Lưu DB rồi đẩy bản sao vào danh sách mặc định của Google. Google lỗi thì task vẫn lưu, nhãn "Lỗi đồng bộ Google". |
| Sửa / hoàn thành / mở lại / xoá | Sửa DB trước. Bản sao ở tài khoản đang kết nối thì sửa/xoá luôn trên Google. Ở tài khoản cũ thì chỉ đổi DB. |
| Đổi tài khoản Google | Task cũ vẫn còn, nhãn "Ở tài khoản Google cũ". Sửa task hoặc bấm **Đồng bộ lại** thì bản sao được tạo lại ở tài khoản hiện tại. |
| Tạo task thẳng trên app Google | Được **nhập vào DB** khi mở `/tasks`, trang Tổng quan, hoặc gõ `/tasks`, `/today`, `/week` (mỗi tài khoản tối đa 5 phút một lần). Nhập **mọi danh sách** task của tài khoản đó. |
| Xoá task trên app Google | Lần nhập kế tiếp sẽ xoá mềm task đó trong zalobot. |
| Xoá task trong zalobot | Xoá mềm (`deleted_at`). Lần nhập sau không đưa nó quay lại. |

Lưu ý khi nhập: task đang có thay đổi chưa lên được Google (`pending`/`failed`) sẽ không bị bản trên Google ghi đè. Google chỉ giữ **ngày** của hạn chót, nên hệ thống so hạn theo ngày, không theo giờ.

**Dữ liệu cũ**: task nằm ở tài khoản Google mà hệ thống không còn token thì không tự lấy lại được. Muốn giữ chúng: đăng nhập lại tài khoản đó một lần (để hệ thống nhập vào DB) rồi đổi về.

## 3. Ai sở hữu code nào

- Backend `apps/api/src/tasks/`: `TasksService` là nơi duy nhất đọc/ghi task; `TasksController` giữ nguyên đường dẫn `/api/tasks` và thêm `POST /api/tasks/:id/resync`. `GoogleTasksService` (`apps/api/src/google/`) chỉ còn là client Google mỏng.
- Phần dùng chung với lịch nằm ở `apps/api/src/google/google-copy.util.ts` (tìm lại tài khoản giữ bản sao, tên người tạo, trạng thái đồng bộ).
- Web `apps/web/src/modules/tasks/api/`: `getTasks`, `updateTask`, `deleteTask`, `resyncTask` và các hook TanStack Query tương ứng. Mọi mutation làm mới cache `tasks` và `dashboard`.
- Màn hình và bảng nằm ở module dashboard: `TasksScreen`, `TasksTable`. Nhãn/màu đồng bộ dùng chung với lịch ở `apps/web/src/shared/ui/google-sync.ts`.

## 4. Màn hình Việc cần làm

- Luôn hiện task từ DB, kể cả khi chưa kết nối Google (khi đó chỉ có dòng gợi ý nhỏ).
- **Lọc theo kỳ** (mặc định Tháng), **thẻ tổng quan**: tổng, cần làm, đã xong, quá hạn, **Chưa lên Google**. Bấm thẻ cuối để chỉ xem task chưa lên Google (chip màu cam trên thanh lọc, bấm ✕ để bỏ).
- **Lọc trạng thái** Tất cả / Cần làm (mặc định) / Đã xong; tìm theo tiêu đề và ghi chú.
- **Cột bảng**: Trạng thái, Tiêu đề, Ghi chú, Hạn chót, Cập nhật, **Người tạo** (tên hoặc nguồn, kèm nhóm Zalo), **Google Tasks** (nhãn đồng bộ, rê chuột xem tài khoản; nút **Đồng bộ lại** khi chưa đồng bộ), Thao tác.
- Trên điện thoại, nhãn đồng bộ chỉ hiện ở dòng phụ khi task **chưa** lên Google, để danh sách gọn.
- Sửa trực tiếp như cũ; xoá trống ô ghi chú hoặc hạn chót rồi lưu thì trường đó được xoá. Xoá task dùng hộp xác nhận trong app (thay `window.confirm`).
- Trang Tổng quan vẫn dùng bảng rút gọn (không có cột Người tạo/Google Tasks) và không còn dòng "Kết nối Google để xem dữ liệu" ở khung Việc cần làm.

## 5. Kiểm thử

1. `npm run typecheck`, `npm run lint`, `npm run test --workspace @zalobot/api` (có `tasks.service.spec.ts`, `task.mapper.spec.ts`).
2. `npm run build --workspace @zalobot/web`.
3. Sau khi deploy (migration `CreateTasks` tự chạy): mở `/tasks` để nhập task của tài khoản Google đang kết nối; tạo/sửa/hoàn thành/xoá một task và kiểm tra trên app Google Tasks; gõ `/task mua sữa` trên Zalo.
