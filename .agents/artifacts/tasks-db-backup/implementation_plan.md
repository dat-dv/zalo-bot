# Kế hoạch: Lưu việc cần làm (Tasks) vào DB của zalobot

Rủi ro: **HIGH** (bảng DB mới + migration, đổi nguồn dữ liệu của API `/api/tasks`, bot Zalo, luồng xác nhận và trang Tổng quan).

Làm theo đúng khuôn của lịch (commit `f21201a`, plan `calendar-redesign-db`): **DB là nguồn sự thật, Google Tasks chỉ là bản sao**.

## 1. Hiện trạng

- Hệ thống **không lưu task**. Mọi thao tác đi thẳng vào Google Tasks list `@default` qua `GoogleTasksService` (`apps/api/src/google/google-tasks.service.ts`), dùng token của người dùng, không có thì dùng tài khoản Google dùng chung.
- Đổi tài khoản Google ⇒ dashboard và bot chỉ còn thấy task của tài khoản mới; task cũ "biến mất".
- Các nơi đang đọc/ghi Google trực tiếp:
  - Dashboard: `GET/GET :id/POST/PATCH/DELETE /api/tasks` trong `google-resources.controller.ts`.
  - Trang Tổng quan: `reports.controller.ts` → `getTasks()` (chỉ khi `googleConnected`).
  - Bot: `create-task` (kiểm tra trùng), `list-tasks`, `complete-task`, `tasks-quick` (`/tasks`, `/task <nội dung>` tạo ngay).
  - Xác nhận mã: `transaction-confirmation.service.ts` (`CREATE_TASK`, `COMPLETE_TASK`).
- Chưa kết nối Google thì bot từ chối mọi lệnh task, dashboard trả danh sách rỗng.
- Task chỉ có: tiêu đề, ghi chú, hạn, trạng thái, ngày cập nhật/hoàn thành. Không biết ai tạo, tạo từ nhóm nào, có trên Google hay không.

## 2. Hướng giải quyết

### 2.1 Bảng `tasks` (entity `TaskEntity`, migration `1724880000000-CreateTasks`)
| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | uuid | khoá chính |
| `title` | varchar | |
| `notes` | text, null | |
| `due_at` | timestamptz, null | Google Tasks chỉ giữ phần ngày; giữ nguyên quy ước hiện tại |
| `status` | varchar | `needsAction` \| `completed` |
| `completed_at` | timestamptz, null | |
| `created_by_user_id`, `created_by_name` | varchar, null | giống `calendar_events` |
| `source` | varchar | `zalo` \| `dashboard` \| `google` |
| `source_chat_id` | varchar, null | nhóm/chat Zalo tạo ra task |
| `google_task_id`, `google_task_list_id`, `google_account_email` | varchar, null | unique `(google_account_email, google_task_id)` khi khác null |
| `sync_status` | varchar | `synced` \| `pending` \| `failed` \| `local` (dùng lại kiểu `CalendarSyncStatus` → đổi tên chung `GoogleSyncStatus`, giữ alias cũ) |
| `synced_at` | timestamptz, null | |
| `deleted_at` | timestamptz, null | xoá mềm |
| `created_at`, `updated_at` | timestamptz | |

Index: `(status, due_at)`, `(deleted_at)`, unique bản sao Google như trên.

### 2.2 Backend: module mới `apps/api/src/tasks/`
- `TasksService` là nơi duy nhất đọc/ghi task. `GoogleTasksService` giữ vai trò client Google (thêm phân trang `pageToken` khi liệt kê, và liệt kê mọi task list).
  - **Tạo**: ghi DB (`pending`) → có Google thì đẩy lên list `@default` → lưu `google_task_id`, list id, email, `synced`. Google lỗi ⇒ `failed`, task vẫn lưu và vẫn hiện. Không có Google ⇒ `local`.
  - **Sửa / Hoàn thành / Mở lại / Xoá**: sửa DB trước; bản sao thuộc tài khoản đang kết nối thì patch/xoá trên Google; thuộc tài khoản cũ thì chỉ sửa DB.
  - **Đọc**: truy vấn DB (lọc trạng thái, từ khoá, giới hạn).
  - **Nhập từ Google**: kéo **toàn bộ task của mọi task list** của tài khoản đang kết nối (`showCompleted`, `showHidden`, phân trang), upsert theo `(google_account_email, google_task_id)`, `source = 'google'` nếu mới. Task của **chính tài khoản đó** mà Google không còn trả về thì xoá mềm. Throttle 5 phút/tài khoản (Redis + bộ nhớ, như lịch). Task đã xoá trong zalobot không bị nhập lại.
  - **Đồng bộ lại**: task `failed`/`pending`/ở tài khoản cũ được đẩy lại vào tài khoản hiện tại khi bấm "Đồng bộ lại".
  - Kiểm tra trùng (`findPotentialDuplicateTasks`) chuyển sang đọc DB, giữ nguyên thuật toán `normalizeTaskTitle`.
- `TasksController`: **giữ nguyên đường dẫn** `/api/tasks` (GET, GET :id, POST, PATCH :id, DELETE :id), chuyển khỏi `google-resources.controller.ts`; thêm `POST /api/tasks/:id/resync` (khai báo trong `API_ROUTES`). DTO bằng class-validator thay cho `Record<string, unknown>`.
- Ghi nhật ký kiểm toán khi tạo/sửa/xoá.
- Chuyển các nơi gọi sang `TasksService`: `reports.controller.ts`, 4 strategy bot, `transaction-confirmation.service.ts` (`CREATE_TASK` lưu thêm người tạo + chat nguồn; `COMPLETE_TASK` theo id DB). **Tương thích ngược**: thao tác chờ duyệt đã nằm trong Redis trước khi deploy mang id Google ⇒ `TasksService` nhận cả uuid lẫn `google_task_id`.
- Bỏ điều kiện "chưa kết nối Google thì không dùng được task" ở bot: task vẫn lưu DB (`local`), bot báo rõ chưa có trên Google.

### 2.3 Contracts (`packages/contracts`, chỉ thêm trường)
`ITaskListItem` thêm: `createdByName?`, `source?`, `sourceChatName?`, `sync?: ITaskSync` (cùng hình dạng `ICalendarEventSync`). Thêm `API_ROUTES.tasks.resync(id)`, i18n vi/en cho nhãn mới.

### 2.4 UI trang `/tasks` (thay đổi nhỏ, không làm lại trang)
- Bỏ fallback `dashboard.data.tasks` và lời nhắc "kết nối Google" che dữ liệu: task luôn hiện từ DB; chưa kết nối Google chỉ còn là gợi ý nhỏ.
- Bảng thêm cột/nhãn **đồng bộ** (*Đã lên Google* / *Chỉ lưu trong app* / *Lỗi đồng bộ* / *Ở tài khoản Google cũ*) và **người tạo + nhóm nguồn**.
- Thẻ tóm tắt thêm *Chưa lên Google* (bấm để lọc); hành động **Đồng bộ lại** trong cột thao tác cho task chưa đồng bộ.
- Xoá dùng `ConfirmDialog` (đã có từ đợt lịch) thay `window.confirm`.
- Trên điện thoại: nhãn đồng bộ dạng chấm/icon nhỏ để không tràn hàng. Giữ bo góc nhỏ hiện tại.

### 2.5 Dữ liệu cũ
- Task ở tài khoản Google mà hệ thống không còn token thì không lấy lại được. Sau khi deploy, tài khoản đang kết nối được nhập vào DB ngay lần đầu mở `/tasks` hoặc gõ `/tasks`. Muốn giữ task của tài khoản cũ: đăng nhập lại tài khoản đó một lần rồi đổi về, hệ thống sẽ nhập và giữ lại.

## 3. Câu hỏi cần anh chốt
1. **Task dùng chung hay theo người?**
   - **(Đề xuất) Dùng chung như lịch và sổ chung**: ai cũng thấy mọi task, mỗi task ghi người tạo + nhóm nguồn.
   - Theo người: mỗi người chỉ thấy task mình tạo, admin thấy tất cả.
2. Xoá task trên app Google thì **xoá mềm luôn trong zalobot** (đề xuất, giống lịch) hay giữ lại?
3. Nhập **mọi task list** của Google (đề xuất) hay chỉ list mặc định như hiện nay? Task mới vẫn đẩy vào list mặc định.
4. UI chỉ thêm phần đồng bộ/người tạo như mục 2.4 (đề xuất), hay anh muốn làm lại trang Tasks giống trang Lịch trong đợt này?

## 4. Thứ tự làm
1. Entity + migration `tasks`, `TasksService` + test đơn vị (tạo/sửa/hoàn thành/xoá, Google lỗi, tài khoản cũ, nhập + xoá mềm, id Google cũ trong pending action).
2. `TasksController` (giữ route) + DTO, contracts, chuyển Tổng quan + bot + confirmation sang `TasksService`.
3. UI `/tasks`: cột đồng bộ, người tạo, lọc *Chưa lên Google*, Đồng bộ lại, `ConfirmDialog`.
4. Tài liệu (Hard Completion Gate): `.agents/knowledge/modules/tasks/` + `global/google-tasks.md` (EN), `.agents/docs/modules/tasks/` + `global/google-tasks.md` (VI), `CONTEXT.md` (thuật ngữ *Việc cần làm*, *Bản sao Google* dùng chung), `.agents/docs/README.md`, `CHANGELOG.md`; `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 5. Kiểm tra
- `npm run typecheck`, `npm run lint`, `npm run test` (api, web, contracts), `npm run build --workspace @zalobot/web`.
- Chạy migration trên DB local; thử tạo/sửa/hoàn thành/xoá khi có và không có Google.
- Xem `/tasks` ở 375px và desktop, sáng/tối. Trên prod chỉ xem, không tạo/xoá dữ liệu thật trừ khi anh cho phép.
