# Walkthrough: Việc cần làm lưu trong DB

Kế hoạch: [implementation_plan.md](implementation_plan.md). Anh duyệt plan và chọn phương án đề xuất cho cả 4 câu: task **dùng chung**, xoá trên Google thì **xoá mềm** trong zalobot, nhập **mọi danh sách** task của Google, UI chỉ thêm phần đồng bộ/người tạo.

## Backend
- Bảng mới `tasks` (entity `TaskEntity` + migration `1724880000000-CreateTasks`), đăng ký trong `database.module.ts` và `data-source.ts`.
- Module mới `apps/api/src/tasks/`: `TasksService` (tạo/sửa/hoàn thành/xoá mềm/đồng bộ lại, nhập toàn bộ tài khoản Google tối đa 5 phút/lần, không ghi đè thay đổi chưa lên Google, chuyển bản sao sang tài khoản hiện tại), `TasksController` (giữ route `/api/tasks`, thêm `/:id/resync`), DTO class-validator, mapper thuần, `task-title.util.ts` (chuyển từ `google-tasks.service.ts`).
- `GoogleTasksService` chỉ còn là client Google: liệt kê mọi danh sách và mọi task (có phân trang), insert/patch/delete.
- Phần dùng chung với lịch tách ra `apps/api/src/google/google-copy.util.ts`; `CalendarService` và mapper lịch dùng lại (không đổi hành vi, test lịch vẫn pass).
- Gỡ các route task khỏi `GoogleResourcesController` (và 3 test cũ tương ứng).
- Trang Tổng quan, 6 lệnh bot (`CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK`, `/tasks` + `/task <nội dung>`, `/today`, `/week`) và luồng duyệt mã chuyển sang `TasksService`; không còn đòi kết nối Google. Mã `COMPLETE_TASK` cũ còn trong Redis (id Google) vẫn chạy vì `getTask` tìm cả theo `google_task_id`.
- Mô tả tool cho LLM bỏ chữ "từ Google Tasks".

## Contracts
- `GoogleSyncStatus` + `IGoogleCopySync` dùng chung (giữ alias `CalendarSyncStatus`, `ICalendarEventSync`); `TaskStatus`, `TaskSource`; `ITaskListItem` thêm người tạo, nguồn, nhóm chat, `sync`, `createdAt`; `IUpdateTaskRequest` bỏ `taskListId`, chuỗi rỗng xoá `notes`/`due`.
- `API_ROUTES.task(id)`, `taskResync(id)`; i18n vi/en cho nhãn mới; bỏ key không dùng `tasks.delete.confirm`.

## Web
- `/tasks`: luôn hiện task từ DB (bỏ fallback dữ liệu dashboard), thẻ "Chưa lên Google" bấm để lọc (chip cam để bỏ lọc), cột Người tạo và Google Tasks (nhãn + nút Đồng bộ lại), xoá bằng `ConfirmDialog`, xoá trống ghi chú/hạn chót được lưu đúng.
- Trên điện thoại nhãn đồng bộ chỉ hiện khi task chưa lên Google.
- Trang Tổng quan: bỏ dòng "Kết nối Google để xem dữ liệu" ở khung Việc cần làm.
- `apps/web/src/shared/ui/google-sync.ts` gom màu/nhãn trạng thái đồng bộ, dùng chung với lịch.

## Tài liệu
- `knowledge/modules/tasks/README.md` (EN) và `docs/modules/tasks/README.md` (VI) viết lại; cập nhật `global/google-tasks.md`, `backend-crud-api.md`, `finance-domain.md`, `zalo-command-intake.md` (cả EN/VI), README lịch và dashboard, `knowledge/modules/README.md`, `docs/README.md` (mục 17), `CONTEXT.md` (mục Việc cần làm).
- `CHANGELOG.md` không sửa tay: mục mới được thêm tự động khi commit (như các commit trước).

## Kiểm tra đã chạy
- API: `npm run test` 526/526 pass (thêm `tasks.service.spec.ts` 10 test, `task.mapper.spec.ts` 4 test), `lint`, `typecheck`: pass.
- Web: `npm run test` 78/78 pass, `lint`, `typecheck`, `build` (static export): pass.
- Contracts: `typecheck`, `build`: pass.
- Migration SQL chạy trên container `postgres:16-alpine` tạm (đã xoá): tạo bảng và index, chạy lại lần hai không lỗi, `ON CONFLICT DO NOTHING` với unique index có điều kiện bỏ qua bản trùng, thứ tự sắp xếp đúng (việc chưa xong có hạn → chưa xong không hạn → đã xong).
- `node .claude/hooks/docs-drift-check.mjs --all`: PASS.

## Chưa kiểm được
- Không xem được UI trên máy: dev server trong browser pane bị macOS chặn (`EPERM uv_cwd`). Cần xem `/tasks` trên prod sau deploy.
- Chưa gọi Google Tasks API thật (nhập nhiều danh sách, patch `completed: null` khi mở lại việc): chỉ có test với Google giả lập.
- Chưa khởi động toàn bộ API với DB thật (giống đợt lịch).

## Lưu ý
- Cùng lúc có một session khác đang sửa trong cùng thư mục (debts, reminders, dialog tạo mới; artifacts `crud-audit`, `web-crud-gaps`). `packages/contracts/src/index.ts` chứa cả thay đổi của hai bên; khi commit cần tách cho đúng phần của task này.
