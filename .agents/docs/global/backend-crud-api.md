---
metadata:
  agent-artifact:
    id: docs-global-backend-crud-api
    type: documentation
    depends_on:
      - .agents/knowledge/global/backend-crud-api.md
      - apps/api/src/finance/finance.controller.ts
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/users/users.controller.ts
      - apps/api/src/reminders/reminders.controller.ts
      - apps/api/src/google/google-resources.controller.ts
      - apps/api/src/zalo/text/text-tool.definitions.ts
---

# REST CRUD Backend

Tài liệu canonical tương ứng: [`backend-crud-api.md`](../../knowledge/global/backend-crud-api.md).

API (`apps/api`) không chia theo `src/modules/<feature>` mà theo từng vùng nghiệp vụ (`finance`, `reports`, `users`, `reminders`, `google`, `zca`). Mọi endpoint đều có tiền tố `/api` (trừ webhook và health). Web chỉ gọi API qua hằng số `API_ROUTES` trong `packages/contracts/src/index.ts`.

## Vì sao phải khóa theo token

Dashboard là dữ liệu tài chính cá nhân, nên backend **không bao giờ** nhận `userId` từ client. Người gọi được xác định duy nhất từ access token dashboard (header `Authorization: Bearer ...`). Nhờ vậy một người không thể xem giao dịch, công nợ hay lời nhắc của người khác dù đoán được ID.

- Nhóm `/api/users*` chỉ dành cho admin (tài khoản ZCA của chính bot hoặc user có role admin); người khác nhận `403`.
- Lưu ý hiện trạng: các endpoint `drive/share`, `drive/folder-link`, `drive/open`, `photos/album-link`, `photos/open` chưa kiểm tra token dashboard — cần xử lý ở task riêng nếu muốn khóa chặt.

## Danh sách endpoint theo nghiệp vụ

- **Giao dịch thu chi**: `GET /api/transactions?type=income|expense`, `POST /api/transactions`, `GET/PATCH/DELETE /api/transactions/:id`. Gửi `placeId: null` để bỏ liên kết nơi chốn.
- **Phân bổ giao dịch vào công nợ**: `GET /api/transactions/:id/candidate-debts` (gợi ý khoản nợ phù hợp), `GET/POST /api/transactions/:id/allocations` (body `allocations: [{ debtId, amount, note? }]`), `DELETE /api/transactions/:id/allocations/:allocationId`. Dữ liệu nằm ở bảng `debt_payment_allocations`.
- **Danh mục**: `GET /api/categories?type=`, `POST /api/categories`, `PATCH/DELETE /api/categories/:id` (bảng `user_categories`, có `color`, `icon`, `isDefault`).
- **Nơi chốn**: `GET/POST /api/places`, `PATCH/DELETE /api/places/:id`, `POST /api/places/combine` để gộp ít nhất 2 nơi chốn trùng thành một.
- **Danh bạ công nợ**: `GET /api/contacts` (tối đa 200 người, phục vụ bởi reports controller), `POST /api/contacts`, `GET/PATCH/DELETE /api/contacts/:id`, `POST /api/contacts/combine` (kèm `consolidateDebts: true` để gom nợ của các người được gộp về khoản nợ cha).
- **Công nợ**: `GET /api/debts?status=active|settled`, `POST /api/debts`, `GET/PATCH/DELETE /api/debts/:id`, `POST /api/debts/combine` (gộp ≥2 khoản nợ thành khoản cha qua `parent_debt_id`).
- **Trả nợ**: `GET/POST /api/debts/:id/payments`, `DELETE /api/debts/:id/payments/:paymentId`.
- **Báo cáo**: `GET /api/dashboard`, `GET /api/expenses`, `GET /api/finance/analytics?startAt&endAt&grain`.
- **Lời nhắc**: `GET/POST /api/reminders`, `GET/PATCH/DELETE /api/reminders/:id`.
- **Người dùng (admin)**: `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`, `POST /api/users/sync-zca` (đồng bộ tên, avatar, SĐT từ danh bạ ZCA), `PATCH /api/users/:id/grant-access`, `GET /api/users/:id/merge-preview?targetUserId=`, `POST /api/users/:id/merge`.
- **Google**: `/api/calendar/events[/:id]`, `/api/tasks[/:id]` — chỉ thao tác trên tài khoản Google đã liên kết của người gọi, không trả OAuth token.

## Quy tắc nghiệp vụ quan trọng

- Ghi trả nợ làm giảm `remainingAmount`; khi về 0 khoản nợ chuyển `settled` và ghi `settledAt`. Xóa một lần trả nợ sẽ đưa khoản nợ về `active` nếu cần.
- Lời nhắc theo dõi `status` (`pending`, `completed`, `snoozed`, `cancelled`), `snoozeCount`, `snoozedUntil`, `completedAt`. API không nhận `isTriggered` vì scheduler quản lý trường này.
- `DELETE /api/users/:id` xóa bản ghi user và từ chối xóa admin. Gộp tài khoản trùng dùng `merge-preview` rồi `merge` (xem `CONTEXT.md`, mục Gộp tài khoản).
- Bảng `invites` đã bị xóa bằng migration `DropInvitesTable`; không còn API mã mời. Quyền dùng bot giờ do trường `grantAccess` của user quyết định.

## Công cụ LLM của bot

Khi người dùng nhắn tự nhiên, `LlmService` chọn một tool trong `ZALO_TOOL_DEFINITIONS` (`apps/api/src/zalo/text/text-tool.definitions.ts`): `MANAGE_DEBT`, `RECORD_TRANSACTION`, `DELETE_TRANSACTION`, `SET_REMINDER`, `GET_REPORT`, `CREATE_CALENDAR_EVENT`, `LIST_CALENDAR_EVENTS`, `DELETE_CALENDAR_EVENT`, `CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK`, `LOGIN_GOOGLE`, `CREATE_PLACE`, `GET_STORAGE_LINKS`.

- `RECORD_TRANSACTION` ghi **một** giao dịch mỗi lần gọi (bắt buộc `type`, `amount`; tùy chọn `category`, `note`, `occurredAt`, `placeName`, `paymentMethod`, `receiptUrl`). Không có tool ghi hàng loạt.
- Nếu `placeName` chưa có trong danh sách nơi chốn của người dùng, bot tạo thêm một thao tác chờ duyệt `CREATE_PLACE` đi kèm (Companion Action) chứ không tạo người liên quan công nợ.
- Tin nhắn nhóm không nhắc tên bot chỉ được kích hoạt nhóm tool thụ động: `RECORD_TRANSACTION`, `MANAGE_DEBT` (khi bật theo dõi chi tiêu) hoặc `CREATE_CALENDAR_EVENT`, `SET_REMINDER` (khi bật trích xuất lịch).
