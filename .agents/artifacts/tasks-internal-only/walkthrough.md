# Walkthrough: tasks-internal-only (2026-10-22)

Plan: [implementation_plan.md](implementation_plan.md), đã được anh duyệt. Mặc định đã chốt: không nhập task từ Google, giữ tên file `global/google-tasks.md`, hỏi trước khi commit/push.

## Lệch so với plan
- **Migration**: plan định sửa thẳng `CreateTasks`. Em đổi sang **thêm migration mới** `1724890000000-DropTaskGoogleCopy`, vì:
  - API local ở cổng 3001 tự chạy migration khi khởi động, nhưng em không xác định được nó dùng DB nào (Postgres local ở 5432 không chạy, `.env` không đọc được).
  - Nếu DB đó đã chạy bản cũ thì cột `sync_status NOT NULL` vẫn còn và mọi lệnh tạo task sẽ lỗi.
  - Migration mới dùng `DROP COLUMN IF EXISTS` nên an toàn cho mọi DB. Nó cũng đổi các dòng `source = 'google'` thành `dashboard`.
- `loadRecordOriginLookups` (`google-copy.util.ts`): `googleAuth` thành tuỳ chọn để tasks gọi không cần Google, thay vì viết một hàm lookup riêng.

## Đã làm
- **API**:
  - `task.entity.ts` bỏ các cột Google.
  - `TasksService` bỏ đẩy lên Google, nhập từ Google, đồng bộ lại và xoá bản sao; bỏ dependency Google. `getTask` chỉ tìm theo id dòng.
  - `TasksController` bỏ `POST /:id/resync`. `task.mapper.ts` bỏ phần chuyển đổi dữ liệu Google và trường `sync`.
  - `tasks.module.ts` bỏ import `GoogleModule`. Xoá `google-tasks.service.ts`; `CreateTaskOptions` chuyển sang `tasks/task.types.ts` (bỏ `taskListId`).
  - OAuth bỏ scope `auth/tasks`; câu thông báo kết nối thành công không còn nhắc Tasks.
- **Bot**:
  - Bỏ `importForUserId` ở các lệnh `/tasks`, `/today`, `/week`, `LIST_TASKS`, `COMPLETE_TASK` và kiểm tra trùng.
  - Bỏ câu "chưa lên Google Tasks" trong `/task`, bỏ việc so khớp `googleTaskId` khi hoàn thành.
  - Lời bot ở help/start/login/status và mô tả tool `CREATE_TASK` không còn nhắc Google Tasks.
  - `reports.controller.ts` đọc task không còn nhập từ Google.
- **Contracts**:
  - `TaskSource` bỏ `'google'`; `ITaskListItem` bỏ `sync`; bỏ `API_ROUTES.taskResync`.
  - Xoá 15 khoá i18n đồng bộ (`tasks.sync.*`...) và `public.privacy.tasksScope`; sửa `tasks.subtitle`, `tasks.delete.message`, `tasks.create.description`, `public.about.googleDescription`.
- **Web**:
  - `tasks-api` / `tasks-query` bỏ resync.
  - `TasksScreen` bỏ thẻ "Chưa lên Google", bộ lọc chưa đồng bộ, nút Đồng bộ lại và dòng nhắc Google.
  - `TasksTable` bỏ cột Google Tasks; `CreateTaskDialog` bỏ dòng nhắc.
  - Sửa `metadata` của `/tasks`; trang quyền riêng tư bỏ mục Google Tasks.
- **Tài liệu**:
  - `knowledge` + `docs`: `modules/tasks` (viết lại), `global/google-tasks.md`, `modules/dashboard`, `global/backend-crud-api.md`, `global/llm-providers.md`, `global/google-oauth-public-verification.md`, `global/dashboard-session.md`.
  - Các mục lục README, `project-overview.md`, `CONTEXT.md` (bỏ thuật ngữ "Bản sao Google (task)").

## Kiểm thử
- `npm run test --workspace @zalobot/api`: 521/521 pass (spec của tasks đã viết lại theo hành vi mới).
- `npm run test --workspace @zalobot/web`: 82/82 pass.
- Typecheck API: pass. Build contracts, build API: pass.
- ESLint các file đã đổi: sạch.
- Dò lại `google_task|googleTaskId|taskResync|resyncTask|GoogleTasksService|auth/tasks|tasks.sync.|localOnlyTip|tasksScope` trong `apps/` + `packages/`: không còn kết quả, ngoài phần của lịch (giữ nguyên).
- **Chưa xanh, nhưng không phải do task này**:
  - Typecheck/build web lỗi ở `zca/model/thread-config-form.spec.ts` (`memberAccess`).
  - `docs-drift-check` báo module `zca`.
  - Cả hai thuộc session đang làm `memberAccess` (migration `1724900000000-AddMemberAccessToZcaThreadConfigs`, chưa commit).
- Chưa chạy migration trên DB thật (không có Postgres local); chưa kiểm tra trên trình duyệt (preview `EPERM`).

## Còn lại
- Commit/push: chờ anh quyết.
- Trang quyền riêng tư đang liệt kê quyền hồ sơ và Calendar nhưng thiếu Drive và Photos, dù app vẫn xin hai quyền này. Lỗi này có từ trước, không thuộc phạm vi task.
