# Walkthrough: web-crud-gaps (2026-10-22)

Plan: [implementation_plan.md](implementation_plan.md). Trạng thái: **xong phần công nợ và lời nhắc; phần tasks tạm hoãn.**

## Đã làm

### Contracts (`packages/contracts/src/index.ts`)
- Thêm `ICreateDebtRequest` (ghi chú: bắt buộc có `contactId` hoặc `createNewContact: true`).
- Thêm khoá i18n `vi` + `en`: `debts.actions.create|delete`, `debts.create.*`, `debts.delete.*`, `reminders.actions.create`, `reminders.create.*`.

### Dùng chung (web)
- `shared/ui/form-dialog.tsx` — `FormDialog`: khung dialog form dùng chung (header, banner lỗi, footer Huỷ/Lưu, toàn màn hình trên điện thoại, chạm ra ngoài không đóng, không đóng được khi đang lưu). Style lấy theo calendar sheet. *Plan không có file này*; em thêm vì cả 3 form tạo mới đều dùng.
- `shared/lib/local-date-input.ts` — `toLocalDateTimeInput` (+ test).

### Công nợ
- `debts-api.ts`: `createDebt`, `deleteDebt`; `debts-query.ts`: `useCreateDebtMutation`, `useDeleteDebtMutation` (invalidate thêm `contacts`).
- `model/debt-create-form.ts` (+ 5 test): `matchContact`, `buildCreateDebtRequest`, `dueDateToIso`. Ô người liên quan khi sửa trực tiếp cũng dùng `matchContact`.
- `create-debt-dialog.tsx`: form tạo khoản nợ. Tên không khớp danh bạ thì phải tick "Tạo người liên quan mới" mới lưu được.
- `debts-table.tsx`: nút ✕ (prop `onDelete`) đã có sẵn nhưng chưa được dùng. Em sửa tooltip từ "Hủy" thành "Xóa" và thêm `aria-label`.
- `debts-screen.tsx`:
  - Nút `+ Thêm khoản nợ` trên toolbar desktop; trên điện thoại nằm ở `MobileActionBar` (hiện nút Gộp khi chọn từ 2 khoản trở lên).
  - Xoá qua `ConfirmDialog`, có cảnh báo về đợt trả nợ và khoản con.

### Lời nhắc
- `reminders-api.ts` / `reminders-query.ts`: `createReminder`, `useCreateReminderMutation`.
- `model/reminder-create-form.ts` (+ 3 test): mặc định nhắc sau 1 giờ, chặn thời điểm đã qua.
- `create-reminder-dialog.tsx`, cùng nút trên toolbar và trên `MobileActionBar` trong `reminders-screen.tsx`.

### Tài liệu
- `knowledge` + `docs` của `debts`, `reminders`, `dashboard` (gồm cả `depends_on`).

## Phát hiện khi làm
- **Xoá khoản nợ không xoá các giao dịch thu/chi đã ghi cho các đợt trả**: cascade chỉ xoá dòng `debt_payments`. Khi xoá lẻ một đợt trả thì giao dịch liên kết bị xoá kèm. Hộp xác nhận và tài liệu đã ghi rõ điều này. Backend chưa sửa, cần anh quyết.
- `createDebt` khi thiếu cả contact lẫn cờ tạo mới thì trả lỗi 500 (`new Error`), không phải 400. Form đã chặn từ phía client.

## Kiểm thử
- `npm run test --workspace @zalobot/web`: 78/78 pass (gồm 9 test mới).
- `npm run typecheck --workspace @zalobot/web` và `@zalobot/contracts`: pass.
- ESLint các file đã đổi: sạch. Prettier: sạch.
- `npm run build --workspace @zalobot/web`: pass.
- `node .claude/hooks/docs-drift-check.mjs`: còn 2 lỗi ở `calendar` và `tasks`. Cả hai thuộc session "Lưu task vào database riêng" đang sửa dở; task này không đụng các file đó.
- **Chưa kiểm tra trên trình duyệt**: `preview_start` lỗi `EPERM: operation not permitted, uv_cwd`. Tiến trình preview không có quyền đọc thư mục dự án trong `~/Documents` (quyền macOS).

## Đợt 2 — Tasks (sau khi session tasks-DB xong)
- Task giờ lưu trong DB (`TasksController`, `POST /api/tasks` nhận `title`, `notes?`, `due?`), nên **bỏ điều kiện "phải kết nối Google"** mà plan đặt ra. Chưa kết nối Google thì việc lưu ở trạng thái `local`, hộp thoại hiện `tasks.localOnlyTip`.
- `tasks-api.ts`: `createTask`; `tasks-query.ts`: `useCreateTaskMutation`.
- `tasks/model/task-create-form.ts` (+ 3 test).
- `dueDateToIso` chuyển từ `debts/model` sang `shared/lib/local-date-input.ts` (+ test) để công nợ và tasks dùng chung.
- `create-task-dialog.tsx` gồm tiêu đề, ghi chú, hạn chót.
- `tasks-screen.tsx`: nút trên toolbar và trên `MobileActionBar`. Thêm xong, nếu đang lọc "Đã xong" thì tự chuyển sang "Cần làm" để thấy việc vừa tạo.
- i18n: `tasks.actions.create`, `tasks.create.*` (vi + en).
- Tài liệu: `knowledge` + `docs` của `tasks`, `dashboard`, `debts` (chỗ nhắc tới `dueDateToIso`).
- Kiểm thử:
  - Web test 82/82 pass.
  - Typecheck web và contracts pass. Phải chạy `npm run build --workspace @zalobot/contracts` trước, vì web đọc kiểu từ `dist`.
  - ESLint và Prettier sạch; build web pass.
  - `docs-drift-check` (thường và `--all`): PASS.

## Còn lại
- Kiểm tra trên trình duyệt (375px và desktop, sáng/tối) sau khi dev server chạy được. `preview_start` vẫn lỗi `EPERM uv_cwd`.
