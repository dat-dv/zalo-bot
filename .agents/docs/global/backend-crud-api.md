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

Backend **không bao giờ** nhận `userId` từ client. Người gọi được xác định duy nhất từ access token dashboard (header `Authorization: Bearer ...`). Dữ liệu tài chính là **kho chung** nên mọi người dùng đã đăng nhập đều thấy như nhau; lịch và việc cần làm cũng dùng chung theo cùng cách; còn lời nhắc vẫn theo từng người nên không ai xem được của người khác dù đoán được ID.

- Nhóm `/api/users*` chỉ dành cho admin (tài khoản ZCA của chính bot hoặc user có role admin); người khác nhận `403`.
- Các endpoint `drive/share`, `drive/folder-link`, `photos/album-link` chỉ dành cho admin dashboard (Bearer token). `drive/open`, `photos/open` là link mở trực tiếp (`<a href>`) nên chấp nhận Bearer hoặc cookie refresh, cũng chỉ admin. Thiếu token trả 401, không phải admin trả 403. Lý do: không có kiểm tra "người gọi thuộc kênh", nên để mở thì người ngoài có thể chia sẻ thư mục Drive của nhóm khác cho email bất kỳ.

## Danh sách endpoint theo nghiệp vụ

- **Giao dịch thu chi**: `GET /api/transactions` (lọc `type`, `startAt`, `endAt`, `search`, phân trang `limit`/`offset`; trả kèm số dư lũy kế, tổng kỳ và số dư sổ cái), `POST /api/transactions`, `GET/PATCH/DELETE /api/transactions/:id`. Gửi `placeId: null` để bỏ liên kết nơi chốn.
- **Kho tài chính chung**: mọi endpoint tài chính (giao dịch, nơi chốn, danh bạ công nợ, công nợ, danh mục) đọc/ghi một kho duy nhất cho cả hệ thống; token chỉ để xác thực, không để giới hạn dữ liệu. Không còn API "chủ sổ" (`/api/finance/ledger*`).
- **Ảnh hoá đơn**: `GET /api/transactions/:id/receipt` — trả ảnh của giao dịch (mọi người dùng đã đăng nhập), xác thực bằng Bearer hoặc cookie refresh để `<img>` dùng trực tiếp.
- **Phân bổ giao dịch vào công nợ**: `GET /api/transactions/:id/candidate-debts` (gợi ý khoản nợ phù hợp), `GET/POST /api/transactions/:id/allocations` (body `allocations: [{ debtId, amount, note? }]`), `DELETE /api/transactions/:id/allocations/:allocationId`. Dữ liệu nằm ở bảng `debt_payment_allocations`.
- **Danh mục**: `GET /api/categories?type=`, `POST /api/categories`, `PATCH/DELETE /api/categories/:id` (bảng `user_categories`, có `color`, `icon`, `isDefault`).
- **Nơi chốn**: `GET/POST /api/places`, `PATCH/DELETE /api/places/:id`, `POST /api/places/combine` để gộp ít nhất 2 nơi chốn trùng thành một.
- **Danh bạ công nợ**: `GET /api/contacts` (tối đa 200 người, phục vụ bởi reports controller), `POST /api/contacts`, `GET/PATCH/DELETE /api/contacts/:id`, `POST /api/contacts/combine` (kèm `consolidateDebts: true` để gom nợ của các người được gộp về khoản nợ cha), `POST /api/contacts/sync-users` (admin: đưa người dùng Zalo vào danh bạ chung và đồng bộ SĐT).
- **Công nợ**: `GET /api/debts?status=active|settled`, `POST /api/debts`, `GET/PATCH/DELETE /api/debts/:id`, `POST /api/debts/combine` (gộp ≥2 khoản nợ thành khoản cha qua `parent_debt_id`).
- **Trả nợ**: `GET/POST /api/debts/:id/payments`, `DELETE /api/debts/:id/payments/:paymentId`.
- **Báo cáo**: `GET /api/dashboard`, `GET /api/expenses`, `GET /api/finance/analytics?startAt&endAt&grain`.
- **Lời nhắc**: `GET/POST /api/reminders`, `GET/PATCH/DELETE /api/reminders/:id`.
- **Người dùng (admin)**: `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`, `POST /api/users/sync-zca` (đồng bộ tên, avatar, SĐT từ danh bạ ZCA), `PATCH /api/users/:id/grant-access`, `GET /api/users/:id/merge-preview?targetUserId=`, `POST /api/users/:id/merge`, `GET /api/users/:id/linked-contacts` (Người liên quan đang gắn với user).
- **Lịch**: `/api/calendar/events[/:id]`, `POST /api/calendar/events/:id/resync` — lịch chung lưu trong DB, Google chỉ giữ bản sao (xem `modules/calendar/README.md`).
- **Việc cần làm**: `/api/tasks[/:id]` — danh sách việc chung chỉ lưu trong DB, không đồng bộ Google (xem `modules/tasks/README.md`).

## Quy tắc nghiệp vụ quan trọng

- Ghi trả nợ làm giảm `remainingAmount`; khi về 0 khoản nợ chuyển `settled` và ghi `settledAt`. Xóa một lần trả nợ sẽ đưa khoản nợ về `active` nếu cần.
- Lời nhắc theo dõi `status` (`pending`, `completed`, `snoozed`, `cancelled`), `snoozeCount`, `snoozedUntil`, `completedAt`. API không nhận `isTriggered` vì scheduler quản lý trường này.
- `DELETE /api/users/:id` xóa bản ghi user và từ chối xóa admin. Gộp tài khoản trùng dùng `merge-preview` rồi `merge` (xem `CONTEXT.md`, mục Gộp tài khoản).
- Bảng `invites` đã bị xóa bằng migration `DropInvitesTable`; không còn API mã mời. Quyền dùng bot giờ do trường `grantAccess` của user quyết định.

## Công cụ LLM của bot

Khi người dùng nhắn tự nhiên, `LlmService` chọn một tool trong `ZALO_TOOL_DEFINITIONS` (`apps/api/src/zalo/text/text-tool.definitions.ts`): `MANAGE_DEBT`, `RECORD_TRANSACTION`, `DELETE_TRANSACTION`, `SET_REMINDER`, `GET_REPORT`, `CREATE_CALENDAR_EVENT`, `LIST_CALENDAR_EVENTS`, `DELETE_CALENDAR_EVENT`, `CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK`, `LOGIN_GOOGLE`, `CREATE_PLACE`, `GET_STORAGE_LINKS`.

- `RECORD_TRANSACTION` ghi **một** giao dịch mỗi lần gọi (bắt buộc `type`, `amount`; tùy chọn `category`, `note`, `occurredAt`, `placeName`, `paymentMethod`, `receiptUrl`). Không có tool ghi hàng loạt.
- Nếu `placeName` chưa có trong danh sách nơi chốn của người dùng, bot tạo thêm một thao tác chờ duyệt `CREATE_PLACE` đi kèm (Companion Action) chứ không tạo người liên quan công nợ.
- Tin nhắn nhóm ZCA chỉ tới được các tool này khi @mention bot hoặc bắt đầu bằng tiền tố của nhóm; tin không gọi bot không bao giờ được gửi cho AI (xem tài liệu module ZCA).
