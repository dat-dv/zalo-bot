# Kế hoạch: Nhắc nhở cho Việc cần làm (Task reminder)

- Route: implement · Phase 1 (Planning) · Risk: **MEDIUM–HIGH** (thêm cột DB + migration, đổi contract API, thêm endpoint, thêm cron, đổi tool LLM)
- Trạng thái: chờ anh duyệt
- Bản 2: đã chốt **cách 2 — có ô chọn kênh nhận nhắc**

## 1. Có làm được không?

**Được.** Hạ tầng đã có sẵn đủ mảnh:

- `ReminderSchedulerService` (`apps/api/src/reminders/reminder-scheduler.service.ts`) có sẵn pattern cron 30 giây + `ZcaMessengerService.sendMessage(chatId, text)` (gửi được cả nhóm lẫn chat riêng theo `chatId`).
- `TaskEntity` đã lưu `sourceChatId` và `createdByUserId`.
- `zca_thread_configs` có `thread_id`, `thread_name`, `thread_type`, `is_listened` → đủ để liệt kê kênh cho ô chọn.
- Luồng bot `CREATE_TASK` đã đi qua thẻ xác nhận, chỉ cần thêm trường.

## 2. Thiết kế

### 2.1 Dữ liệu — thêm 3 cột vào `tasks` (không dùng bảng `reminders`)

| Cột | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `remind_at` | `timestamptz NULL` | Thời điểm nhắc (có giờ; khác `due_at` chỉ tính theo ngày) |
| `remind_chat_id` | `varchar NULL` | Kênh Zalo nhận nhắc (ID nhóm hoặc UID chat riêng) |
| `reminded_at` | `timestamptz NULL` | Lúc bot đã gửi nhắc; `NULL` = chưa nhắc |

Lý do không gộp vào bảng `reminders`: bảng đó là nhắc **cá nhân theo `user_id`** (gửi DM, có lặp/snooze/gọi), còn task là **danh sách việc chung**. Để trên task thì việc xong/xoá tự động hết nhắc, không phải đồng bộ hai bảng, trang `/reminders` cũng không bị lẫn.

### 2.2 Kênh nhận nhắc — luôn lưu tường minh vào `remind_chat_id` khi có `remindAt`

| Tạo/sửa từ | `remind_chat_id` mặc định | Được đổi? |
| --- | --- | --- |
| Bot Zalo (nhóm hoặc chat riêng) | `chatId` nơi nhắn bot | Không (sửa trên dashboard thì được) |
| Dashboard, người dùng có Zalo | Chat riêng với chính họ (`users.id`) | Có — chọn kênh khác trong ô "Gửi nhắc vào" |
| Dashboard, `dashboard-owner` | **Không có mặc định** | **Bắt buộc chọn** kênh khi đặt giờ nhắc |

Quy tắc kiểm tra:
- Khi lưu: `remindAt` có giá trị thì `remind_chat_id` phải có; kênh chọn phải là kênh **đang listen** (hoặc chat riêng của chính người dùng). Sai → `400`.
- Xoá `remindAt` → xoá luôn `remind_chat_id`, `reminded_at`.
- Đổi `remindAt` hoặc `remind_chat_id` → `reminded_at = NULL` (nhắc lại theo cấu hình mới).
- Lúc gửi: kênh đã bị admin bỏ listen → **không gửi**, đánh dấu `reminded_at` + log cảnh báo (admin bỏ listen nghĩa là không muốn bot hoạt động ở đó).

### 2.3 Cron gửi nhắc

Mỗi 30 giây quét: `remind_at <= now AND reminded_at IS NULL AND status = 'needsAction' AND deleted_at IS NULL`.

- Đánh dấu bằng update có điều kiện `reminded_at IS NULL` → 2 tick chồng nhau không gửi trùng.
- Gửi lỗi do ZCA chưa đăng nhập → **không** đánh dấu, tick sau thử lại.
- Phạm vi: **nhắc một lần** (chưa lặp, chưa snooze, chưa gọi điện).

Nội dung tin (VI/EN theo locale người tạo; mặc định VI):

```
⏰ Nhắc việc cần làm
━━━━━━━━━━━━━━━━━━━━
📌 <tiêu đề>
⏳ Hạn: 23/10            (nếu có)
📝 <ghi chú rút gọn>     (nếu có)
━━━━━━━━━━━━━━━━━━━━
Trả lời "xong <tiêu đề>" để đánh dấu hoàn thành.
```

### 2.4 Danh sách kênh cho ô chọn

Endpoint mới `GET /api/tasks/reminder-channels` (mọi người dùng dashboard đã đăng nhập, không chỉ admin):

```ts
interface ITaskReminderChannel { id: string; name: string; type: 'user' | 'group'; isSelf?: boolean }
```

- Trả về các kênh `is_listened = true` từ `zca_thread_configs` + (nếu người dùng có Zalo) mục "Chat riêng với tôi" đánh dấu `isSelf`.
- Lý do không dùng `/api/zca/listened-threads`: endpoint đó **chỉ admin**, và chỉ trả ID.
- Lưu ý quyền riêng tư: người dùng thường sẽ thấy **tên** các kênh đang listen. Tên kênh vốn đã hiện ở cột "Nguồn" của task, nên không lộ thêm loại dữ liệu mới.

## 3. Các bước thay đổi

### 3.1 Contracts — `packages/contracts/src/index.ts`
- `ITaskListItem`: thêm `remindAt?`, `remindChatId?`, `remindChatName?`, `remindedAt?`.
- `ICreateTaskRequest`: `remindAt?`, `remindChatId?`.
- `IUpdateTaskRequest`: `remindAt?` (`''` = xoá nhắc), `remindChatId?`.
- Mới: `ITaskReminderChannel`; `API_ROUTES.taskReminderChannels`.
- i18n (vi + en): `tasks.columns.remindAt`, `tasks.create.remindAt`, `tasks.create.remindChannel`, `tasks.create.remindChannelRequired`, `tasks.create.remindPastTime`, `tasks.remind.self`, `task.reminder.header`.
- ⚠️ File này đang có thay đổi dở của việc khác (đã thấy trong `git status`). Em chỉ **thêm** vào phần task, không sửa/format lại phần khác; nếu phiên kia còn chạy thì sẽ cần gộp.

### 3.2 API — DB
- `TaskEntity`: 3 cột mới; index `IDX_tasks_status_remind_at` trên (`status`, `remind_at`).
- Migration mới `apps/api/src/database/migrations/<ts>-AddReminderToTasks.ts` (không sửa migration cũ).

### 3.3 API — module `tasks`
- `TaskInput`/`TaskFields`/`normalize`/`updateTask`: nhận `remindAt`, `remindChatId`; áp dụng quy tắc 2.2.
- `TasksService`: `getDueTaskReminders()`, `markTaskReminded(id)`, `listReminderChannels(userId)`, `assertReminderChannel(chatId, userId)`.
- `task.mapper.ts`: map trường mới (+ `remindChatName` qua lookup kênh sẵn có); `formatTaskReminderMessage(...)` thuần, có unit test.
- DTO: `remindAt` (`IsISO8601`, update cho phép `''`), `remindChatId` (`IsString`, `MaxLength`).
- Controller: truyền trường mới; thêm `GET reminder-channels` (khai báo **trước** `GET :id`).
- **Mới** `task-reminder-scheduler.service.ts`; `TasksModule` import `forwardRef(() => ZcaModule)` + `UsersModule` (locale) như `RemindersModule` — kiểm tra vòng phụ thuộc khi làm.

### 3.4 API — bot Zalo
- `text-tool.definitions.ts` (`CREATE_TASK`): thêm `remindAt` (ISO, có giờ). Chỉnh mô tả: có **việc cần làm** + giờ nhắc → `CREATE_TASK` kèm `remindAt`; chỉ "nhắc tôi lúc X" không phải việc → `SET_REMINDER` như cũ (bỏ ví dụ "nhắc làm slide" đang gây trùng).
- `CreateTaskOptions` + `create-task-tool.strategy.ts`: mang `remindAt` vào payload.
- `transaction-confirmation.service.ts` (commit `CREATE_TASK`): truyền `remindAt` hợp lệ, `remindChatId = pending.chatId`; bỏ qua giờ sai định dạng/đã qua.
- `compact-summary.util.ts` `summarizeTask`: thêm `⏰ nhắc <giờ ngày>`.

### 3.5 Web — `/tasks`
- `apps/web/src/modules/tasks/api`: `getTaskReminderChannels` + `useTaskReminderChannelsQuery` (query key factory sẵn có).
- `task-create-form.ts`: thêm `remindAt` (`datetime-local`), `remindChatId`; lỗi `pastTime`, `channelRequired`; cập nhật spec.
- `create-task-dialog.tsx`: dưới "Hạn chót" thêm "Nhắc lúc"; khi có giờ nhắc thì hiện ô **"Gửi nhắc vào"** (select: "Chat riêng với tôi" nếu có, rồi các nhóm/chat đang listen). `dashboard-owner` không có mục "Chat riêng với tôi" và phải chọn.
- `tasks-table.tsx`: hiển thị 🔔 giờ nhắc + tên kênh dưới cột hạn chót; đã nhắc thì làm mờ; chế độ sửa (desktop + sheet mobile) có `datetime-local` + select kênh.
- `tasks-screen.tsx`: edit draft thêm 2 trường; xoá nhắc gửi `remindAt: ''`.
- Giữ bo góc nhỏ hiện tại; dùng `API_ROUTES`, không hardcode route.

### 3.6 Tài liệu (Hard Completion Gate)
- `.agents/knowledge/modules/tasks/README.md` (EN) + `.agents/docs/modules/tasks/README.md` (VI): trường nhắc, quy tắc kênh, cron, chống gửi trùng, endpoint mới.
- `CONTEXT.md` mục "Việc cần làm": thêm **Nhắc việc** và **Kênh nhận nhắc**.
- Cập nhật `.agents/docs/README.md` nếu index đổi; chạy `node .claude/hooks/docs-drift-check.mjs`.
- Cảnh báo drift của `dashboard`/`debts` hiện tại là của việc khác — không xử lý trong task này.

## 4. Kiểm thử

- Unit (api): `tasks.service.spec.ts` (đổi giờ/kênh reset `remindedAt`; việc xong/xoá không vào danh sách đến hạn; thiếu kênh → lỗi; kênh không listen → lỗi), `task.mapper.spec.ts` (format tin), spec cron (gửi đúng kênh; ZCA lỗi không đánh dấu; kênh bỏ listen → đánh dấu bỏ qua), spec summary/confirmation cho `CREATE_TASK`.
- Unit (web): `task-create-form.spec.ts`.
- `npm run typecheck`, `npm run lint`, `npm run test` theo workspace api/web/contracts.
- Kiểm tra UI trên preview `/tasks` (desktop + mobile): tạo việc có nhắc + chọn kênh, sửa, xoá nhắc.
- Không tự xác nhận được tin nhắc tới Zalo thật nếu ZCA local chưa đăng nhập — sẽ báo rõ.

## 5. Rủi ro

- Migration thêm cột nullable → an toàn.
- Vòng phụ thuộc `TasksModule ↔ ZcaModule` → `forwardRef` như `RemindersModule`.
- LLM chọn nhầm `SET_REMINDER` / `CREATE_TASK` → giảm bằng mô tả tool rõ ràng.
- Xung đột với thay đổi dở trong `packages/contracts/src/index.ts`.

## 6. Ghi chú thực thi (Phase 2, 2026-10-22)

Trạng thái: **đã code xong**, chưa commit.

Điều chỉnh so với kế hoạch:

- **ZCA đăng xuất** → scheduler bỏ qua cả lượt (thêm `ZcaMessengerService.isConnected()`), nhắc chờ tới lần đăng nhập sau. Thay cho "không đánh dấu rồi thử lại mỗi tick" để tránh log lặp vô hạn khi lỗi gửi là vĩnh viễn.
- **Đánh dấu trước, gửi sau**: lỗi gửi giữa chừng chỉ ghi log, không gửi lại (giống `ReminderSchedulerService`).
- **Bỏ qua khi bỏ listen** chỉ áp cho **nhóm** (`isUnlistenedGroup`). Chat riêng luôn được gửi, vì chat riêng của người dùng dashboard thường không nằm trong danh sách listen.
- Kiểm tra "giờ ở tương lai" cho phép lệch 1 phút để khớp với form dashboard (chọn giờ theo phút).
- Tách `DASHBOARD_OWNER_USER_ID` ra `apps/api/src/users/dashboard-owner.ts` (`users.service.ts` re-export) để `TasksService` không phải import `UsersService` (kéo theo ZCA vào unit test).
- Web: thêm `taskApiErrorMessage` để hiện đúng thông điệp lỗi 400 của API; thêm i18n `tasks.inlineEdit.error`.
- Gợi ý trong tin nhắc đổi thành "Nhắn bot "xong …"" vì trong nhóm bot chỉ trả lời khi được gọi.

Kiểm chứng:

- `npm run typecheck` (gốc) ✅, `npm run lint` api/web/contracts ✅.
- `npm run test` api 558/558 ✅, web 94/94 ✅ (thêm test: `tasks.service.spec.ts`, `task.mapper.spec.ts`, `task-reminder-scheduler.service.spec.ts`, `compact-summary.util.spec.ts`, `transaction-confirmation.service.spec.ts`, `task-create-form.spec.ts`).
- `node .claude/hooks/docs-drift-check.mjs --all` ✅.
- ❌ **Chưa kiểm tra UI trên trình duyệt**: preview dev server không khởi động được (`EPERM: uv_cwd`, macOS chặn quyền thư mục).
- ❌ **Chưa chạy migration trên DB thật**, chưa thử gửi tin nhắc tới Zalo thật.
