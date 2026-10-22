# Kế hoạch: Web bổ sung tạo/xoá công nợ, tạo lời nhắc, tạo task

Nguồn: audit `.agents/artifacts/crud-audit/research.md` (nhóm 1).
Rủi ro: **MEDIUM** — chạm nhiều file web và thêm 1 kiểu DTO vào `@zalobot/contracts`. **Không đổi backend, không migration, không đổi API.**

## 1. Hiện trạng (đã kiểm chứng trong code)

| Thực thể | API sẵn có | Web hiện tại |
| --- | --- | --- |
| Công nợ | `POST /api/debts`, `DELETE /api/debts/:id` (`finance.controller.ts:626,714`) | `debts-api.ts` chỉ có list, sửa, gộp, ghi/xoá trả nợ |
| Lời nhắc | `POST /api/reminders` (`reminders.controller.ts:39`) | `reminders-api.ts` chỉ có list, sửa, xoá |
| Google Tasks | `POST /api/tasks` (`google-resources.controller.ts:332`) | `tasks-api.ts` chỉ có list, sửa, xoá |

Những điểm ràng buộc khi gọi API:
- **Tạo công nợ** bắt buộc có `contactId` **hoặc** `createNewContact: true`. Nếu thiếu cả hai, service ném lỗi "Cần chọn người trong danh bạ hoặc xác nhận tạo người mới" (`finance.service.ts:1114-1118`). Các trường còn lại: `direction`, `counterparty`, `amount` (bắt buộc), `counterpartyAlias`, `note`, `occurredAt`, `dueAt` (tuỳ chọn).
- **Xoá công nợ**: các lần trả nợ và phân bổ bị xoá theo (FK `CASCADE`). Nếu đó là khoản cha sau khi gộp thì các khoản con bị tách ra (`parentDebtId` → `NULL`, FK `SET NULL`) và **hiện lại thành khoản độc lập**.
- **Tạo lời nhắc**: bắt buộc `title`, `remindAt` (ISO); tuỳ chọn `notifyType` (`text` | `call`), `repeatType` (`none` | `daily` | `weekly`).
- **Tạo task**: bắt buộc `title`; tuỳ chọn `notes`, `due`. Gọi thẳng Google Tasks nên **cần đã kết nối Google** (`isGoogleConnected` trên `tasks-screen.tsx:61`).
- Contracts đã có `ICreateReminderRequest`, `ICreateTaskRequest`, **nhưng chưa có `ICreateDebtRequest`**.

## 2. Thay đổi

### 2.1 Contracts (`packages/contracts/src/index.ts`)
- Thêm `ICreateDebtRequest { direction; counterparty; counterpartyAlias?; contactId?; createNewContact?; amount; note?; occurredAt?; dueAt? }`, đặt cạnh `IUpdateDebtRequest`.
- Thêm khoá i18n cho **cả `vi` và `en`**:
  - `debts.actions.create`, `debts.create.*` (tiêu đề, nhãn trường, gợi ý tạo người mới, lỗi, thành công)
  - `debts.actions.delete`, `debts.delete.*` (tiêu đề, nội dung, cảnh báo khi có lần trả nợ hoặc khoản con, thành công)
  - `reminders.actions.create`, `reminders.create.*`
  - `tasks.actions.create`, `tasks.create.*`, `tasks.create.needGoogle`

### 2.2 Công nợ (`apps/web/src/modules/debts/`)
1. `api/debts-api.ts`: thêm `createDebt(data, signal)` (POST `API_ROUTES.debts`) và `deleteDebt(id, signal)` (DELETE `` `${API_ROUTES.debts}/${id}` ``, giống cách đang gọi `updateDebt`).
2. `api/debts-query.ts`: thêm `useCreateDebtMutation` và `useDeleteDebtMutation`. Khi thành công, invalidate `debtsQueryKeys.list()`, `['contacts']` và `['dashboard']`, giống các mutation hiện có.
3. **Mới** `presentation/components/create-debt-dialog.tsx`: dùng `Modal` (`phoneLayout="sheet"`), theo khuôn của `adjust-balance-modal.tsx`. Các trường:
   - Chiều nợ: 2 chip `Phải thu` / `Phải trả`, mặc định `Phải thu`.
   - Người liên quan: ô nhập dùng lại `datalist#debt-contacts-autocomplete` mà `debts-screen` đang render. Logic khớp tên/biệt danh tách ra từ `handleCounterpartyChange` thành hàm thuần `matchContact()` đặt trong `debts/model/`, và màn hình đang dùng cũng gọi hàm này.
   - Khớp được người trong danh bạ: gửi `contactId`. Không khớp: hiện checkbox "Tạo người liên quan mới «X»", phải tick mới bật nút Lưu, rồi gửi `createNewContact: true` kèm biệt danh (tuỳ chọn).
   - Số tiền (> 0, VND), ngày phát sinh (`datetime-local`, mặc định là lúc mở form), hạn trả (tuỳ chọn), ghi chú.
   - Lỗi từ API hiện ngay trong form, không đóng dialog.
4. `presentation/components/debts-table.tsx`: thêm prop `onDelete?: (debt) => void` và nút **Xoá** cạnh nút "Sửa" ở hàng desktop và thẻ mobile, cùng kiểu nút nhỏ `rounded-[3px]` đang dùng.
5. `presentation/components/debts-screen.tsx`:
   - Nút **+ Thêm công nợ** trên toolbar `DataPanel` (desktop), cùng kiểu với `places.actions.create`. Trên điện thoại nằm ở hàng chip.
   - Xác nhận xoá bằng `ConfirmDialog` (không dùng `window.confirm`). Nội dung nêu số lần trả nợ, và nếu là khoản cha thì báo các khoản con sẽ được tách ra.
   - Xoá xong: bỏ id khỏi `selectedIds`, thoát chế độ sửa nếu đang sửa đúng khoản đó, rồi hiện toast.

### 2.3 Lời nhắc
1. `modules/reminders/api/reminders-api.ts` + `reminders-query.ts`: thêm `createReminder` và `useCreateReminderMutation`, invalidate `reminders` và `dashboard`.
2. **Mới** `modules/dashboard/presentation/components/create-reminder-dialog.tsx`: các trường tiêu đề, thời điểm nhắc (`datetime-local`, mặc định 1 giờ tới, không cho chọn thời điểm đã qua), kiểu báo (`text`/`call`), lặp lại (`none`/`daily`/`weekly`). Các lựa chọn và nhãn dùng lại từ `reminders-table.tsx` để không bị lệch nhau.
3. `reminders-screen.tsx`: thêm nút **+ Thêm lời nhắc** vào toolbar, đặt cạnh ô tìm kiếm.

### 2.4 Tasks
1. `modules/tasks/api/tasks-api.ts` + `tasks-query.ts`: thêm `createTask` (dùng `ICreateTaskRequest` đã có) và `useCreateTaskMutation`.
2. **Mới** `modules/dashboard/presentation/components/create-task-dialog.tsx`: các trường tiêu đề, ghi chú, hạn (`date`).
3. `tasks-screen.tsx`: thêm nút **+ Thêm việc**. Nếu `isGoogleConnected === false` thì nút bị disable kèm tooltip `tasks.create.needGoogle`, vì API sẽ lỗi khi chưa kết nối Google.

## 3. Ngoài phạm vi
- Không sửa backend, kể cả lỗi `new Error` của `createDebt` đang trả về 500 thay vì 400. Form chặn trường hợp này từ phía client.
- Không làm chức năng sửa khoản trả nợ (nhóm 2), không dọn module `expenses` chết (nhóm 3).
- **Liên quan plan `tasks-db-backup`** (HIGH, chưa làm): plan đó đổi `/api/tasks` sang lưu DB nhưng giữ nguyên contract `POST { title, notes, due }`, nên form tạo task ở đây vẫn dùng được. Chỉ cần gỡ điều kiện "cần kết nối Google" khi plan đó xong.

## 4. Kiểm thử
1. Unit test cho `matchContact()`: khớp tên, khớp biệt danh, không phân biệt hoa thường, không khớp.
2. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` cho `--workspace @zalobot/contracts` và `@zalobot/web`.
3. Chạy app trong browser pane (`.claude/launch.json`):
   - Tạo nợ với người có sẵn và với người mới (người mới phải xuất hiện ở trang Người liên quan).
   - Xoá một khoản nợ thường và một khoản cha đã gộp (các khoản con phải hiện lại).
   - Tạo lời nhắc, tạo task (khi đã kết nối Google; khi chưa kết nối thì nút phải bị disable).
   - Kiểm tra ở 375px (bottom sheet) và desktop, sáng và tối.
   - Theo memory: **không** đăng xuất hay xoá session của phiên test trong browser pane.

## 5. Tài liệu (completion gate)
- `.agents/knowledge/modules/{debts,reminders,tasks}/README.md` (EN): thêm thao tác tạo/xoá trên dashboard, quy tắc chọn hoặc tạo người liên quan, và hệ quả khi xoá khoản cha.
- `.agents/docs/modules/{debts,reminders,tasks}/README.md` (VI): giải thích luồng nghiệp vụ tương ứng.
- Cập nhật `.agents/docs/README.md` nếu thay đổi mục lục; chạy `node .claude/hooks/docs-drift-check.mjs` và phải exit 0.

## 6. Thứ tự thực hiện
Contracts → Công nợ (API, hook, dialog, xoá) → Lời nhắc → Tasks → Test → Tài liệu.
