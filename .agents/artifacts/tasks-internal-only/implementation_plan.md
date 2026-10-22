# Kế hoạch: Việc cần làm chỉ lưu nội bộ (bỏ đồng bộ Google Tasks)

Rủi ro: **HIGH**. Plan này đổi schema (bảng `tasks`), bỏ một quyền OAuth Google, và đổi câu trả lời của bot cùng trang Việc cần làm.
Bối cảnh: phần lưu task vào DB (plan `tasks-db-backup`) **chưa commit, chưa deploy**. Migration `1724880000000-CreateTasks` chưa chạy trên prod, nên còn sửa thẳng được.

## 1. Quyết định

- Task chỉ nằm trong bảng `tasks` của zalobot: không sao chép lên Google Tasks, không nhập từ Google.
- **Lịch giữ nguyên** đồng bộ Google Calendar, vì bản sao lịch còn dùng để nhắc trên điện thoại.
- Lý do bỏ (đã thống nhất):
  - API Google Tasks bỏ phần giờ của hạn chót, nên bản sao không nhắc đúng giờ được.
  - Bản sao chỉ nằm trong một tài khoản Google.
  - Cần nhắc đúng giờ thì đã có lời nhắc qua Zalo.
  - Bỏ được 5 trạng thái đồng bộ và một lượt gọi Google mỗi lần đọc/ghi.

## 2. Thay đổi backend (`apps/api`)

### 2.1 Bảng `tasks`
- `task.entity.ts`: bỏ `googleTaskId`, `googleTaskListId`, `googleAccountEmail`, `syncStatus`, `syncedAt` và index unique `IDX_tasks_google_copy`. Giữ `source`, `createdBy*`, `sourceChatId`, soft delete.
- Migration `1724880000000-CreateTasks.ts`: **sửa trực tiếp** (bỏ các cột/index trên) thay vì viết migration mới, vì file chưa commit và chưa chạy trên prod.
  - DB local đã chạy migration này thì trước khi làm phải `npm run migration:revert --workspace @zalobot/api` rồi chạy lại. Em sẽ kiểm tra bảng `migrations` ở local trước khi sửa.
- `TaskSource`: bỏ `'google'`, còn `zalo` | `dashboard`.

### 2.2 `TasksService` / controller / mapper
- `tasks.service.ts`:
  - Bỏ `pushToGoogle`, `writeCopy`, `importFromGoogle`, `importAccount`, `resyncTask` và phần xoá bản sao trong `deleteTask`.
  - Bỏ dependency `GoogleTasksService` và `GoogleAuthService`. `listTasks` không còn tham số `importForUserId`.
  - `getTask` chỉ tìm theo id của dòng, bỏ phần dự phòng tìm theo Google task id.
- `tasks.controller.ts`: bỏ `POST /api/tasks/:id/resync`, sửa mô tả Swagger.
- `task.mapper.ts`: bỏ `fromGoogleTask`, `toGoogleTaskBody`, `differsFromRow` và trường `sync` trong `toTaskItem`.
- `tasks.module.ts`: bỏ import `GoogleModule` nếu không còn cần.
- Test: viết lại `tasks.service.spec.ts` và `task.mapper.spec.ts` theo hành vi mới; bỏ các case đồng bộ/nhập.

### 2.3 Client Google Tasks và quyền OAuth
- Xoá `google/google-tasks.service.ts` và gỡ khỏi `google.module.ts`.
- Type `CreateTaskOptions` (đang được `compact-summary.util.ts` và `dto-descriptor.util.ts` import) chuyển về `tasks/` (ví dụ `tasks/task.types.ts`).
- **Bỏ scope `https://www.googleapis.com/auth/tasks`** khỏi `google-auth.service.ts`. Từ nay lúc đăng nhập Google không còn xin quyền Tasks.
  - Token cũ vẫn dùng bình thường vì scope đã cấp vẫn còn hiệu lực.
  - Sửa câu thông báo kết nối thành công ở `google-auth.controller.ts`.
- `google-copy.util.ts`: giữ nguyên vì lịch còn dùng; chỉ bỏ chỗ task gọi tới.

### 2.4 Bot Zalo
- `tasks-quick-tool.strategy.ts`: bỏ ghi chú "chưa lên Google Tasks" sau khi tạo.
- `complete-task-tool.strategy.ts`: bỏ việc so khớp `googleTaskId`.
- Thay "Google Tasks" bằng "Việc cần làm" trong lời bot và mô tả tool:
  - `help-tool`, `start-tool`, `login-tool`, `status-tool`
  - `text-tool.definitions.ts` (`CREATE_TASK`)
  - comment trong `transaction-confirmation.service.ts`
- Các lệnh task **không còn cần đăng nhập Google**. Em sẽ kiểm tra lại các strategy để chắc không còn chỗ nào chặn khi chưa kết nối.
- `reports.controller.ts` (`getTasks` cho trang Tổng quan): đọc DB, không nhập từ Google.

## 3. Thay đổi contracts (`packages/contracts`)
- `ITaskListItem`: bỏ `sync`. `IGoogleCopySync`, `GoogleSyncStatus` giữ lại cho lịch.
- `API_ROUTES.taskResync`: bỏ.
- i18n (`vi` + `en`):
  - Bỏ: `tasks.sync.*`, `tasks.stats.unsynced`, `tasks.filter.unsyncedOnly`, `tasks.filter.clear` (nếu không còn ai dùng), `tasks.localOnlyTip`, `tasks.columns.sync`, `tasks.source.google`.
  - Sửa: `tasks.subtitle`, `tasks.delete.message`, `tasks.create.description` để không còn nhắc Google.
- Trang quyền riêng tư / điều khoản (khoá i18n ở dòng ~1031/1049 và bản `en`): bỏ đoạn về Google Tasks, vì không còn xin quyền đó.

## 4. Thay đổi web (`apps/web`)
- `tasks-api.ts` / `tasks-query.ts`: bỏ `resyncTask`, `useResyncTaskMutation`.
- `tasks-screen.tsx`:
  - Bỏ thẻ "Chưa lên Google", bộ lọc `unsyncedOnly` và `handleResync`.
  - Bỏ mô tả `localOnlyTip`. Lưới thẻ tổng quan còn 4 thẻ.
- `tasks-table.tsx`: bỏ cột `sync`, prop `onResync`/`resyncingId` và nhãn nguồn `google`.
- `create-task-dialog.tsx`: bỏ prop `isGoogleConnected` và dòng nhắc.
- `app/(private)/tasks/page.tsx`: sửa `metadata.description`.
- `shared/ui/google-sync.ts`: giữ nguyên cho lịch.

## 5. Tài liệu
- `knowledge` + `docs`:
  - `modules/tasks`: viết lại phần nghiệp vụ, dữ liệu, API, UI.
  - `global/google-tasks.md`: tài liệu tạo task từ chat. Giữ tên file để link không gãy, sửa nội dung cho đúng việc task chỉ lưu nội bộ. Nếu anh muốn thì đổi tên thành `task-intake.md` và sửa link.
  - `modules/dashboard`, `global/backend-crud-api.md`, `global/zalo-command-intake.md`: những chỗ nhắc tới đồng bộ task.
  - `.agents/docs/README.md` nếu đổi mục lục.
- `CONTEXT.md` (ngôn ngữ chung): bỏ phần nói task có bản sao Google (nếu có).
- Cập nhật walkthrough của `tasks-db-backup` và `web-crud-gaps` cho khớp.

## 6. Ngoài phạm vi / cần anh xác nhận
- **Không nhập một lần** các task đang có trên Google Tasks. Task cũ vẫn còn trên app Google; việc nào cần thì thêm lại trên dashboard hoặc qua `/task`. Nếu anh muốn nhập một lần thì báo em, em sẽ thêm một endpoint admin chạy một lần.
- Không đụng tới lịch.
- **Chưa commit/push.** Làm xong em sẽ hỏi anh cách commit:
  - đề xuất 2 commit: `feat(tasks)` gồm phần lưu DB + bỏ đồng bộ; `feat(web)` gồm phần tạo/xoá nợ, lời nhắc, task;
  - rồi mới push `main`.

## 7. Kiểm thử
1. `npm run test --workspace @zalobot/api` (đã viết lại spec của tasks), `--workspace @zalobot/web`.
2. `npm run typecheck`, `npm run lint`, `npm run build` cho cả 3 workspace. Build contracts trước vì web đọc từ `dist`.
3. Chạy lại migration trên DB local, gọi thử `GET/POST/PATCH/DELETE /api/tasks`.
4. Dò lại toàn repo xem còn sót không: `grep -rn "google_task\|googleTaskId\|syncStatus\|taskResync\|GoogleTasksService\|auth/tasks"` trong `apps/` và `packages/` phải không còn kết quả. Riêng `syncStatus` của lịch thì giữ.
5. `node .claude/hooks/docs-drift-check.mjs --all` phải PASS.
6. Kiểm tra trên trình duyệt nếu dev server chạy được (hiện bị `EPERM`).
