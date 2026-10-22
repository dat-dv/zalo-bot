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
      - apps/api/src/tasks/task-reminder.processor.ts
      - apps/api/src/database/migrations/1724940000000-CreateReminderTimes.ts
      - apps/web/src/modules/dashboard/presentation/components/reminder-times-field.tsx
      - apps/api/src/database/entities/task.entity.ts
      - apps/web/src/modules/tasks/api/tasks-api.ts
      - apps/web/src/modules/tasks/api/tasks-query.ts
      - apps/web/src/modules/dashboard/presentation/components/tasks-screen.tsx
      - apps/web/src/modules/dashboard/presentation/components/tasks-table.tsx
      - apps/web/src/modules/dashboard/presentation/components/create-task-dialog.tsx
      - apps/web/src/modules/tasks/model/task-create-form.ts
      - apps/web/src/modules/dashboard/presentation/components/reminder-target-fields.tsx
      - apps/api/src/reminders/reminder-target.service.ts
      - apps/api/src/database/migrations/1724930000000-AddReminderTargets.ts
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

Mỗi việc có thể có **một hoặc nhiều lần nhắc** (tối đa 10, ví dụ 8h và 14h, hoặc hôm trước và sáng hôm hạn chót). Đến mỗi giờ, nếu việc vẫn **cần làm**, bot gửi tin nhắc tới **đích nhắc** của việc (một đích chung cho mọi lần nhắc): **kênh nhận nhắc** (`remind_chat_id`), **người được nhắc** (`remind_users`) và **cách nhắc** (`remind_mode`: tag trong nhóm hoặc nhắn riêng). Việc đã xong hoặc đã xoá thì không nhắc.

Phần đích nhắc dùng chung với lời nhắc cá nhân, giải thích đầy đủ ở [`reminders/README.md`](../reminders/README.md#2-đích-nhắc-dùng-chung-với-nhắc-việc). Mục này chỉ ghi phần riêng của task.

### Vì sao để trên bảng `tasks` chứ không dùng bảng `reminders`

- Bảng `reminders` là **nhắc cá nhân** theo `user_id`, gửi chat riêng, có lặp/hoãn/gọi điện. Còn task là **danh sách việc chung**.
- Để trên dòng task thì hoàn thành hoặc xoá việc là tự hết nhắc, không phải đồng bộ hai bảng; trang `/reminders` cũng không bị lẫn nhắc việc.
- Mỗi lần nhắc là một dòng trong bảng `task_reminder_times`, có dấu "đã gửi" riêng. Không dùng mảng trong một cột vì bộ hẹn giờ cần đánh dấu đúng **một** lần nhắc bằng câu update có điều kiện, để hai lượt chạy chồng nhau không gửi trùng.
- Cột `remind_at` trên `tasks` vẫn giữ, nghĩa là **lần nhắc kế tiếp chưa gửi** (tự cập nhật sau mỗi lần sửa và mỗi lần gửi), để mọi chỗ chỉ đọc "lần tới" không phải sửa.
- Task chưa có "lặp mỗi ngày tới khi xong", hoãn hay gọi điện.

### Nhắc gửi về đâu

| Việc tạo/sửa từ | Kênh mặc định | Đổi được? |
| --- | --- | --- |
| Bot Zalo (nhóm hoặc chat riêng) | Chính cuộc trò chuyện đã nhắn bot | Sửa trên dashboard thì đổi được |
| Dashboard, người dùng có Zalo | Chat riêng với chính họ | Có, chọn ở ô **Gửi nhắc vào** |
| Dashboard, `dashboard-owner` | Không có (tài khoản này không gắn Zalo) | **Bắt buộc chọn** kênh |
| Dashboard, tài khoản chỉ có ID Zalo Bot cũ (20 ký tự hex) | Không có (ZCA không gửi được tới ID này) | **Bắt buộc chọn** kênh |

- **Người được nhắc** bắt buộc khi có nhắc. Tạo việc từ Zalo trong nhóm: người được tag là người được nhắc; không tag ai thì bot nhắc chính người nhắn. Tạo trong chat riêng thì nhắc chính người đó.
- Kênh chọn mới phải là chat riêng của chính người đó, hoặc một kênh **đang listen**. Lý do: admin bỏ listen một nhóm nghĩa là không muốn bot hoạt động ở đó.
- Ô chọn lấy danh sách từ `GET /api/reminder-targets/channels` (dùng chung với lời nhắc), mở cho **mọi** người dùng dashboard (khác `/api/zca/listened-threads` chỉ dành cho admin và chỉ trả ID).
- Kênh là nhóm thì chọn thêm được **người được nhắc** (thành viên nhóm, tối đa 10) và **cách nhắc**. Trên Zalo: "thêm việc nộp báo cáo, 3h chiều nhắc @Trí" tag Trí; "nhắc tôi" tag người nhắn; "nhắn riêng" thì nhắn riêng từng người.

### Quy tắc khi sửa

- Sửa danh sách giờ nhắc: giờ nào **giữ nguyên** thì giữ cả dấu đã gửi (không gửi lại); giờ bị bỏ thì xoá; giờ mới phải ở tương lai.
- **Đổi kênh, đổi người hoặc đổi cách nhắc không gửi lại** những lần đã gửi, chỉ áp cho các lần chưa gửi. Muốn nhắc thêm thì thêm giờ mới. Gửi lại hết sẽ dội nhiều tin cũ vào nhóm cùng lúc.
- Xoá hết giờ nhắc ⇒ xoá luôn kênh và người được nhắc.
- Sửa các trường khác (tiêu đề, ghi chú, hoàn thành...) **không** đụng tới nhắc. Một nhắc đã qua giờ không bị kiểm tra lại, nên vẫn sửa tiêu đề hay đánh dấu xong được bình thường.
- Giờ nhắc mới phải ở tương lai; phút hiện tại vẫn được chấp nhận vì dashboard chọn giờ theo phút.
- Mở lại việc đã xong: những giờ nhắc **đã qua trong lúc việc đang xong** bị bỏ qua (không gửi dồn), các giờ còn ở tương lai vẫn nhắc bình thường.

### Bot gửi nhắc thế nào

Nhắc việc chạy trên hàng đợi BullMQ `task-reminders` (cơ chế chung xem [Dịch vụ nền của Backend](../../global/backend-runtime-services.md)), chia hai bước:

**Bước quét** (job `scan`, 30 giây một lần):

1. **ZCA đang đăng xuất thì bỏ qua cả lượt**: nhắc chờ tới khi đăng nhập lại mới gửi, không bị mất.
2. Lấy tối đa 50 **lần nhắc** đã tới giờ, chưa gửi, của việc còn cần làm.
3. Với từng lần nhắc, **đánh dấu đã gửi trước** rồi mới đưa vào hàng đợi gửi. Lệnh đánh dấu chỉ thành công cho người gọi đầu tiên, nên hai lượt quét chồng nhau không bao giờ gửi trùng. Nếu không đưa được vào hàng đợi (Redis rớt), lần nhắc được trả lại trạng thái chưa gửi để lượt sau thử lại.

**Bước gửi** (job `deliver`, mỗi lần nhắc một job):

4. Đọc lại việc: nếu việc đã xong hoặc đã xoá trong lúc chờ thì không gửi nữa.
5. Nếu ZCA vừa đăng xuất thì trả lần nhắc về trạng thái chưa gửi, đợi lượt quét đầu tiên sau khi đăng nhập lại gửi tiếp, tránh tiêu hết lượt thử lại.
6. Gửi qua `ReminderTargetService.deliver` (dùng chung): kênh là nhóm đã bị bỏ listen ⇒ không gửi, ghi log cảnh báo; có người được nhắc thì tag họ, hoặc nhắn riêng từng người rồi tag bù trong nhóm những ai không nhắn riêng được. Chat riêng thì luôn gửi, giống lời nhắc cá nhân.
7. Gửi lỗi ⇒ BullMQ tự thử lại tối đa 5 lần (cách nhau khoảng 30 giây, 1, 2, 4 phút). Hết lượt mới ghi log lỗi và bỏ lần nhắc đó.

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
- Nhắc việc: queue `task-reminders` (`task-reminder.queue.ts`), worker `TaskReminderProcessor`, logic ở `TaskReminderSchedulerService`, cùng các hàm `getDueTaskReminders`, `markTaskReminderSent`, `releaseTaskReminderTime`, `getTaskReminderTime`, `refreshReminderSummary` trong `TasksService`; logic thuần của danh sách giờ nhắc (giữ/xoá/thêm, lần kế tiếp) ở `apps/api/src/reminders/reminder-times.ts`, dùng chung với lời nhắc. Kiểm tra và gửi tới đích nhắc nằm ở `ReminderTargetService` của module reminders, nên `TasksModule` import `RemindersModule`, `UsersModule` (lấy ngôn ngữ) và `ZcaModule` qua `forwardRef`. Hằng `DASHBOARD_OWNER_USER_ID` được tách ra `apps/api/src/users/dashboard-owner.ts` để module tasks dùng mà không phải import `UsersService` (kéo theo ZCA).
- Bảng `tasks`: migration `CreateTasks` tạo bảng, migration `AddReminderToTasks` thêm `remind_at`, `remind_chat_id`, `reminded_at` và index `(status, remind_at)`, migration `CreateReminderTimes` tạo `task_reminder_times` và chuyển mỗi giờ nhắc cũ thành một dòng (giữ dấu đã gửi), migration `DropTaskGoogleCopy` xoá các cột của bản sao Google (`google_task_id`, `google_account_email`, `sync_status`...) và đổi các dòng có nguồn `google` thành `dashboard`. Dùng migration mới thay vì sửa migration cũ để DB nào đã chạy bản cũ cũng về đúng cấu trúc.
- `GoogleTasksService` đã bị xoá. Đăng nhập Google **không còn xin quyền Google Tasks**; token đã cấp trước vẫn dùng bình thường.
- Tên người tạo và tên nhóm Zalo lấy qua `loadRecordOriginLookups` trong `apps/api/src/google/google-copy.util.ts` (dùng chung với lịch, gọi không kèm Google).
- Web `apps/web/src/modules/tasks/api/`: `getTasks`, `createTask`, `updateTask`, `deleteTask` và các hook TanStack Query tương ứng. Mọi mutation làm mới cache `tasks` và `dashboard`.
- Web `apps/web/src/modules/tasks/model/task-create-form.ts`: hàm thuần (có unit test) kiểm tra và dựng request cho form thêm việc.
- Màn hình, bảng và hộp thoại thêm việc nằm ở module dashboard: `TasksScreen`, `TasksTable`, `CreateTaskDialog`.

## 4. Màn hình Việc cần làm

- **Thêm việc**: nút `+ Thêm việc` trên toolbar (desktop) hoặc ở thanh hành động dưới cùng (điện thoại) mở hộp thoại gồm tiêu đề (bắt buộc), ghi chú, hạn chót, **Nhắc lúc** (tuỳ chọn, một hoặc nhiều giờ: mỗi giờ một ô, nút xoá từng giờ và nút **+ Thêm giờ nhắc**, tối đa 10).
  - Bộ ô **đích nhắc** dùng chung (`ReminderTargetFields`) **luôn hiện** ngay dưới giờ nhắc, giống form lời nhắc, để người tạo thấy ngay chỗ "nhắc ai"; chưa có giờ nhắc thì phần này không được gửi đi. Gồm: **Gửi nhắc vào** (người dùng có Zalo được chọn sẵn "Chat riêng với tôi"; `dashboard-owner` và tài khoản ID cũ phải tự chọn; chưa có kênh nào đang listen thì ô báo rõ) → **Nhắc ai** (luôn hiện và bắt buộc khi có giờ nhắc: nhóm phải chọn ít nhất 1 người, chat riêng thì hiện sẵn chính người đó) → **Cách nhắc** (khi đã chọn người). Lý do: nhắc mà không rõ nhắc ai thì tin vào nhóm dễ bị bỏ qua.
  - Giờ đã qua báo lỗi ngay dưới ô; lỗi từ API (kênh không hợp lệ...) hiện đúng thông điệp của API trong hộp thoại.
  - Hạn chót lưu theo cùng quy ước với khi sửa trực tiếp (cuối ngày, giờ UTC).
  - Nếu đang lọc "Đã xong", màn hình tự chuyển về "Cần làm" sau khi thêm để người dùng thấy ngay việc vừa tạo.
- **Lọc theo kỳ** (mặc định Tháng), **thẻ tổng quan**: tổng, cần làm, đã xong, quá hạn.
- **Lọc trạng thái** Tất cả / Cần làm (mặc định) / Đã xong; tìm theo tiêu đề và ghi chú.
- **Cột bảng**: Trạng thái, Tiêu đề, Ghi chú, Hạn chót, **Nhắc lúc** (🔔 lần nhắc kế tiếp kèm "+N lần" còn lại, rê chuột xem đủ các giờ; dòng dưới là kênh · người được nhắc · "Nhắn riêng"; mờ đi kèm "Đã nhắc" khi mọi lần đã gửi), Cập nhật, **Người tạo** (tên hoặc nguồn, kèm nhóm Zalo), Thao tác.
- Sửa trực tiếp như cũ; xoá trống ô ghi chú, hạn chót hoặc giờ nhắc rồi lưu thì trường đó được xoá. Ô Nhắc lúc khi sửa là danh sách giờ (lần đã gửi có chữ "đã gửi") cùng bộ ô đích nhắc (bản gọn), bộ ô này luôn hiện kể cả khi việc chưa có giờ nhắc. Màn hình chỉ gửi trường nhắc khi người dùng thật sự sửa nó, và giờ nào giữ nguyên thì gửi lại đúng giá trị cũ, để lần nhắc đã qua giờ không bị báo "phải ở tương lai". Lưu lỗi thì toast hiện lý do và giữ nguyên chế độ sửa. Xoá task dùng hộp xác nhận trong app (thay `window.confirm`).
- Trang Tổng quan dùng bảng rút gọn (không có cột Người tạo).

## 5. Kiểm thử

1. `npm run typecheck`, `npm run lint`, `npm run test --workspace @zalobot/api` (có `tasks.service.spec.ts`, `task.mapper.spec.ts`, `task-reminder-scheduler.service.spec.ts`) và `npm run test --workspace @zalobot/web` (có `task-create-form.spec.ts`).
2. `npm run build --workspace @zalobot/contracts` trước (web và API đọc kiểu từ `dist`), rồi `npm run build --workspace @zalobot/web`.
3. Sau khi deploy (migration `CreateTasks` và `DropTaskGoogleCopy` tự chạy): tạo (bằng nút **+ Thêm việc**)/sửa/hoàn thành/xoá một task trên `/tasks`, khi chưa kết nối Google cũng phải làm được; gõ `/task mua sữa` trên Zalo rồi `/tasks`.
4. Nhắc việc (migration `AddReminderToTasks`, `AddReminderTargets`, `CreateReminderTimes` tự chạy): đặt nhắc 2 phút nữa vào một nhóm đang listen, chờ tin nhắc; đặt 2 giờ nhắc thì nhận 2 tin; đổi kênh sau khi đã nhắc thì không nhận lại tin cũ; đánh dấu xong trước giờ thì không nhắc. Nhắn bot "thêm việc nộp báo cáo, nhắc 8h và 14h mai" và kiểm tra thẻ xác nhận liệt kê đủ 2 giờ. 
