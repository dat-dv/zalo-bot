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
      - apps/api/src/database/migrations/1724910000000-AddReminderToTasks.ts
      - apps/api/src/tasks/task-reminder-scheduler.service.ts
      - apps/api/src/database/entities/task.entity.ts
      - apps/web/src/modules/tasks/api/tasks-api.ts
      - apps/web/src/modules/tasks/api/tasks-query.ts
      - apps/web/src/modules/dashboard/presentation/components/tasks-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/tasks-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/create-task-dialog.tsx
      - apps/web/src/modules/tasks/model/task-create-form.ts
      - apps/web/src/modules/dashboard/presentation/components/task-reminder-channel-options.tsx
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
- Cần nhắc đúng giờ thì đã có **lời nhắc** qua Zalo, và nay task cũng có **nhắc việc** riêng (mục 2).
- Đồng bộ kéo theo 5 trạng thái (đã lên Google, đang đồng bộ, lỗi, chỉ trong app, ở tài khoản cũ), nút Đồng bộ lại, nhập ngược từ Google mỗi lần đọc và một lượt gọi Google mỗi lần ghi.

Lịch **vẫn giữ** bản sao Google Calendar.

**Dữ liệu cũ**: không có bước nhập riêng từ Google Tasks. Task nào đã được bản `637487f` nhập vào DB (nếu bản đó từng chạy) vẫn được giữ, chỉ đổi nguồn thành dashboard; task chỉ có trên app Google Tasks thì vẫn nằm trên app Google, việc nào còn cần thì thêm lại trên dashboard hoặc qua `/task`.

## 2. Nhắc việc

Mỗi việc có thể có **một** lần nhắc: đến giờ `remind_at`, nếu việc vẫn **cần làm**, bot gửi tin nhắc vào **kênh nhận nhắc** (`remind_chat_id`). Việc đã xong hoặc đã xoá thì không nhắc.

### Vì sao để trên bảng `tasks` chứ không dùng bảng `reminders`

- Bảng `reminders` là **nhắc cá nhân** theo `user_id`, gửi chat riêng, có lặp/hoãn/gọi điện. Còn task là **danh sách việc chung**.
- Để trên dòng task thì hoàn thành hoặc xoá việc là tự hết nhắc, không phải đồng bộ hai bảng; trang `/reminders` cũng không bị lẫn nhắc việc.
- Lần này chỉ nhắc **một lần**, chưa có lặp, hoãn hay gọi điện.

### Nhắc gửi về đâu

| Việc tạo/sửa từ | Kênh mặc định | Đổi được? |
| --- | --- | --- |
| Bot Zalo (nhóm hoặc chat riêng) | Chính cuộc trò chuyện đã nhắn bot | Sửa trên dashboard thì đổi được |
| Dashboard, người dùng có Zalo | Chat riêng với chính họ | Có, chọn ở ô **Gửi nhắc vào** |
| Dashboard, `dashboard-owner` | Không có (tài khoản này không gắn Zalo) | **Bắt buộc chọn** kênh |

- Kênh chọn mới phải là chat riêng của chính người đó, hoặc một kênh **đang listen**. Lý do: admin bỏ listen một nhóm nghĩa là không muốn bot hoạt động ở đó.
- Ô chọn lấy danh sách từ `GET /api/tasks/reminder-channels`, mở cho **mọi** người dùng dashboard (khác `/api/zca/listened-threads` chỉ dành cho admin và chỉ trả ID). Người dùng thường vì vậy thấy được **tên** các kênh đang listen; tên này vốn đã hiện ở cột "Người tạo" của task nên không lộ thêm loại dữ liệu mới.

### Quy tắc khi sửa

- Đổi giờ hoặc đổi kênh ⇒ bot **nhắc lại** theo cấu hình mới (xoá `reminded_at`).
- Xoá giờ nhắc ⇒ xoá luôn kênh và dấu đã nhắc.
- Sửa các trường khác (tiêu đề, ghi chú, hoàn thành...) **không** đụng tới nhắc. Một nhắc đã qua giờ không bị kiểm tra lại, nên vẫn sửa tiêu đề hay đánh dấu xong được bình thường.
- Giờ nhắc mới phải ở tương lai; phút hiện tại vẫn được chấp nhận vì dashboard chọn giờ theo phút.
- Mở lại việc đã xong không làm bot nhắc lại.

### Bot gửi nhắc thế nào

`TaskReminderSchedulerService` chạy mỗi 30 giây:

1. **ZCA đang đăng xuất thì bỏ qua cả lượt**: nhắc chờ tới khi đăng nhập lại mới gửi, không bị mất.
2. Lấy tối đa 50 việc đến giờ, chưa nhắc, còn cần làm.
3. Với từng việc, **đánh dấu đã nhắc trước rồi mới gửi**. Lệnh đánh dấu chỉ thành công cho người gọi đầu tiên, nên hai lượt chạy chồng nhau không bao giờ gửi trùng.
4. Kênh là nhóm đã bị bỏ listen ⇒ không gửi, ghi log cảnh báo. Chat riêng thì luôn gửi, giống lời nhắc cá nhân.
5. Gửi lỗi (ví dụ ZCA mất kết nối giữa chừng) ⇒ chỉ ghi log, không gửi lại.

Nội dung tin theo ngôn ngữ của người tạo việc:

```
⏰ Nhắc việc cần làm
━━━━━━━━━━━━━━━━━━━━
📌 Nộp báo cáo
⏳ Hạn: 23/10
📝 Quý 3
━━━━━━━━━━━━━━━━━━━━
Nhắn bot "xong Nộp báo cáo" để đánh dấu hoàn thành.
```

## 3. Ai sở hữu code nào

- Backend `apps/api/src/tasks/`: `TasksService` là nơi duy nhất đọc/ghi task; `TasksController` phục vụ `/api/tasks` (danh sách, chi tiết, tạo, sửa, xoá mềm). Module không còn phụ thuộc Google.
- Nhắc việc: `TaskReminderSchedulerService` (cron) và các hàm `listReminderChannels`, `getDueTaskReminders`, `markTaskReminded` trong `TasksService`. `TasksModule` import `UsersModule` (lấy ngôn ngữ) và `ZcaModule` (gửi tin) qua `forwardRef`, giống `RemindersModule`. Hằng `DASHBOARD_OWNER_USER_ID` được tách ra `apps/api/src/users/dashboard-owner.ts` để module tasks dùng mà không phải import `UsersService` (kéo theo ZCA).
- Bảng `tasks`: migration `CreateTasks` tạo bảng, migration `AddReminderToTasks` thêm `remind_at`, `remind_chat_id`, `reminded_at` và index `(status, remind_at)`, migration `DropTaskGoogleCopy` xoá các cột của bản sao Google (`google_task_id`, `google_account_email`, `sync_status`...) và đổi các dòng có nguồn `google` thành `dashboard`. Dùng migration mới thay vì sửa migration cũ để DB nào đã chạy bản cũ cũng về đúng cấu trúc.
- `GoogleTasksService` đã bị xoá. Đăng nhập Google **không còn xin quyền Google Tasks**; token đã cấp trước vẫn dùng bình thường.
- Tên người tạo và tên nhóm Zalo lấy qua `loadRecordOriginLookups` trong `apps/api/src/google/google-copy.util.ts` (dùng chung với lịch, gọi không kèm Google).
- Web `apps/web/src/modules/tasks/api/`: `getTasks`, `createTask`, `updateTask`, `deleteTask` và các hook TanStack Query tương ứng. Mọi mutation làm mới cache `tasks` và `dashboard`.
- Web `apps/web/src/modules/tasks/model/task-create-form.ts`: hàm thuần (có unit test) kiểm tra và dựng request cho form thêm việc.
- Màn hình, bảng và hộp thoại thêm việc nằm ở module dashboard: `TasksScreen`, `TasksTable`, `CreateTaskDialog`.

## 4. Màn hình Việc cần làm

- **Thêm việc**: nút `+ Thêm việc` trên toolbar (desktop) hoặc ở thanh hành động dưới cùng (điện thoại) mở hộp thoại gồm tiêu đề (bắt buộc), ghi chú, hạn chót, **Nhắc lúc** (tuỳ chọn).
  - Có giờ nhắc thì hiện thêm ô **Gửi nhắc vào**: người dùng có Zalo được chọn sẵn "Chat riêng với tôi"; `dashboard-owner` phải tự chọn. Chưa có kênh nào đang listen thì ô báo rõ.
  - Giờ đã qua báo lỗi ngay dưới ô; lỗi từ API (kênh không hợp lệ...) hiện đúng thông điệp của API trong hộp thoại.
  - Hạn chót lưu theo cùng quy ước với khi sửa trực tiếp (cuối ngày, giờ UTC).
  - Nếu đang lọc "Đã xong", màn hình tự chuyển về "Cần làm" sau khi thêm để người dùng thấy ngay việc vừa tạo.
- **Lọc theo kỳ** (mặc định Tháng), **thẻ tổng quan**: tổng, cần làm, đã xong, quá hạn.
- **Lọc trạng thái** Tất cả / Cần làm (mặc định) / Đã xong; tìm theo tiêu đề và ghi chú.
- **Cột bảng**: Trạng thái, Tiêu đề, Ghi chú, Hạn chót, **Nhắc lúc** (🔔 giờ + tên kênh; mờ đi kèm "Đã nhắc" khi đã gửi), Cập nhật, **Người tạo** (tên hoặc nguồn, kèm nhóm Zalo), Thao tác.
- Sửa trực tiếp như cũ; xoá trống ô ghi chú, hạn chót hoặc giờ nhắc rồi lưu thì trường đó được xoá. Ô Nhắc lúc khi sửa có thêm ô chọn kênh. Màn hình chỉ gửi trường nhắc khi người dùng thật sự sửa nó, để nhắc cũ đã qua giờ không bị báo "phải ở tương lai". Lưu lỗi thì toast hiện lý do và giữ nguyên chế độ sửa. Xoá task dùng hộp xác nhận trong app (thay `window.confirm`).
- Trang Tổng quan dùng bảng rút gọn (không có cột Người tạo).

## 5. Kiểm thử

1. `npm run typecheck`, `npm run lint`, `npm run test --workspace @zalobot/api` (có `tasks.service.spec.ts`, `task.mapper.spec.ts`, `task-reminder-scheduler.service.spec.ts`) và `npm run test --workspace @zalobot/web` (có `task-create-form.spec.ts`).
2. `npm run build --workspace @zalobot/contracts` trước (web và API đọc kiểu từ `dist`), rồi `npm run build --workspace @zalobot/web`.
3. Sau khi deploy (migration `CreateTasks` và `DropTaskGoogleCopy` tự chạy): tạo (bằng nút **+ Thêm việc**)/sửa/hoàn thành/xoá một task trên `/tasks`, khi chưa kết nối Google cũng phải làm được; gõ `/task mua sữa` trên Zalo rồi `/tasks`.
4. Nhắc việc (migration `AddReminderToTasks` tự chạy): đặt nhắc 2 phút nữa vào một nhóm đang listen, chờ tin nhắc; đổi giờ thì phải nhắc lại; đánh dấu xong trước giờ thì không nhắc. Nhắn bot "thêm việc gọi khách, 10 phút nữa nhắc tôi" và kiểm tra thẻ xác nhận có dòng **Nhắc lúc**.
