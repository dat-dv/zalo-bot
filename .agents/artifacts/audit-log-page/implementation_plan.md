# Implementation Plan: Trang Nhật ký hoạt động + sửa cách ghi người thực hiện

- Ngày: 2026-10-23
- Route: implement · Phase 1 (inspect-and-plan) · **Chờ anh duyệt**
- Mức rủi ro: **CAO** (thêm cột vào DB, đụng luồng xác thực dashboard, luồng xử lý tin nhắn ZCA và API admin mới)
- Nguồn: [research.md](../dashboard-page-gap-research/research.md), mục 2.1

## 1. Mục tiêu

1. Nhật ký phải ghi **đúng người thực hiện** thao tác (người dùng dashboard, người nhắn bot trên Zalo, hoặc hệ thống), kèm **nguồn** và **kênh Zalo**. Hiện tại hệ thống ghi người *tạo* bản ghi.
2. Thêm trang **Nhật ký hoạt động** (`/activity`, chỉ admin). Trang có bộ lọc, phân trang và xem dữ liệu trước/sau của từng thay đổi.
3. Từ chi tiết một giao dịch, admin bấm được "Xem lịch sử" để mở nhật ký đã lọc sẵn theo giao dịch đó.

## 2. Hiện trạng và nguyên nhân lỗi

- `AuditLogSubscriber` ([audit-log.subscriber.ts](../../../apps/api/src/database/audit-log.subscriber.ts)) ghi mọi lần insert, update, remove đi qua TypeORM vào bảng `audit_logs`. Riêng `zca_messages` được bỏ qua.
- **Lỗi**: `actorId` được lấy từ `data.userId` hoặc `data.createdByUserId` **của chính dòng dữ liệu**. Hậu quả:
  - B sửa hoặc xoá giao dịch do A tạo → nhật ký ghi A.
  - Job nhắc việc cập nhật `sentAt` → nhật ký ghi người tạo lời nhắc.
  - Import Google Calendar chạy trong request của người đang xem lịch → nhật ký ghi người xem.
- Xác thực dashboard không dùng guard. Mỗi controller tự gọi `getDashboardUserId` / `requireDashboardAdmin` ([dashboard-user.ts](../../../apps/api/src/dashboard-auth/dashboard-user.ts)). Cả 10 controller đều đi qua hai hàm này, nên đây là điểm gắn người thực hiện duy nhất cho dashboard.
- Luồng Zalo:
  - `ZcaService.dispatchMessage` / `dispatchReaction` ([zca.service.ts](../../../apps/api/src/zca/zca.service.ts)) chuyển sự kiện cho các plugin.
  - Thao tác chờ duyệt được thực thi trong `TransactionConfirmationService.processConfirm`. Người xác nhận có thể là người khác (`yes <code>` hoặc thả tim), còn `pending.userId` là người đã yêu cầu.
- Dự án chưa dùng `AsyncLocalStorage` hay `nestjs-cls`.
- Bảng `audit_logs`: `before_data`/`after_data` là kiểu `text` (simple-json). Đã có index trên `table_name`, `record_id`, `actor_id`. **Chưa có index trên `created_at`**.
- Trang chủ chỉ hiện 10 dòng qua `AuditService.listRecent(userId, 10)`, lọc theo `actor_id`.

## 3. Thiết kế

### 3.1. Ngữ cảnh người thực hiện (`AuditContext`)

- File mới `apps/api/src/audit/audit-context.ts`. Đây là file thuần, không phải Nest provider, để `dashboard-user.ts` và subscriber import được mà không tạo vòng phụ thuộc giữa các module. File dùng một `AsyncLocalStorage<AuditContextStore>`:
  - `AuditContextStore = { source: AuditActorSource; actorId?: string; channelId?: string }`.
  - `AuditActorSource = 'dashboard' | 'zalo' | 'system'`, khai báo trong contracts.
  - API của file: `run(store, fn)`, `runAsSystem(fn)`, `current()`, `setActor(actorId)`. `setActor` chỉ ghi vào store của request hiện tại; nếu không có store thì không làm gì.
- **Dashboard**:
  - Middleware mới `AuditContextMiddleware` (đăng ký cho mọi route trong `CommonModule.configure`, cạnh `RequestIdMiddleware`) mở `run({ source: 'dashboard' }, next)`.
  - `getDashboardUserId` và `getDashboardUserIdFromBrowser` gọi `AuditContext.setActor(String(userId))` **sau khi token đã xác thực xong**. Middleware không tự đọc token, nên chỉ danh tính đã được xác thực mới được ghi.
- **Zalo**:
  - `dispatchMessage` bọc vòng plugin trong `run({ source: 'zalo', actorId: uidFrom, channelId: threadId })`.
  - `dispatchReaction` làm tương tự, với actor là người thả reaction.
- **Thao tác chờ duyệt**: trong `processConfirm`, phần thực thi pending được bọc lại bằng `run({ source: 'zalo', actorId: pending.userId, channelId: pending.chatId })`. Người thực hiện là **người yêu cầu**, không phải người bấm duyệt (xem câu hỏi Q1).
- **Hệ thống**:
  - `ReminderProcessor.process`, `TaskReminderProcessor.process` và `CalendarService.importRange` bọc bằng `runAsSystem`.
  - Nếu không bọc, import lịch sẽ nhận context của request đang xem lịch và bị ghi tên người xem.
  - Mọi chỗ không có context sẽ được ghi là `system`.
- **Subscriber**:
  - Lấy `actorId`, `source`, `channelId` từ `AuditContext.current()`.
  - **Bỏ hẳn** fallback về `userId` / `createdByUserId` của dòng dữ liệu. Không xác định được thì `actor_id = NULL`.
- **Gộp tài khoản**: `UserMergeService` đang tự ghi audit với `actorId` đúng. Bổ sung `actorSource: 'dashboard'` cho dòng này.

### 3.2. Database (migration mới, không sửa migration cũ)

`apps/api/src/database/migrations/1724950000000-AddAuditLogActorSource.ts`:

- `ALTER TABLE audit_logs ADD COLUMN actor_source varchar NULL`, `ADD COLUMN channel_id varchar NULL`.
- `CREATE INDEX IDX_audit_logs_created_at ON audit_logs (created_at DESC)`.
- Dữ liệu cũ **giữ nguyên**, `actor_source = NULL`. Giao diện hiển thị các dòng này là "Dữ liệu cũ": cột người hiện người *tạo* bản ghi, kèm chú thích rằng đó có thể không phải người sửa. Không thể suy ngược ra người thực hiện thật, nên không backfill.
- Cập nhật `AuditLogEntity`: thêm `actorSource?: AuditActorSource | null` và `channelId?: string | null`.

### 3.3. Contracts (`packages/contracts/src/index.ts`)

- `API_ROUTES.auditLogs = '/api/audit-logs'`, `API_ROUTES.auditLog = (id) => '/api/audit-logs/${id}'`.
- `APP_ROUTES.activity = '/activity'` và `APP_ROUTES.activityFor = (table, recordId) => '/activity?table=…&recordId=…'`, có `encodeURIComponent`.
- `AUDIT_ACTOR_SOURCES`, `AuditAction = 'insert' | 'update' | 'remove'`.
- `AUDIT_TABLES`: danh sách bảng gồm `{ table, group: 'finance' | 'planning' | 'system', technical: boolean }`.
  - Các bảng `technical: true` (mặc định ẩn): `user_tokens`, `dashboard_exchange_tokens`, `reminder_times`, `task_reminder_times`.
- DTO:
  - `IAuditLogListQuery { tables?, actions?, sources?, actorIds?, recordId?, startAt?, endAt?, includeTechnical?, limit?, offset? }`.
  - `IAuditLogListItem { id, tableName, recordId, action, actorId, actorName, actorSource, channelId, channelName, channelType, changedFields: string[], createdAt }`.
  - `IAuditLogListResponse { items, total, limit, offset, facets: { actors: { id, name }[] } }`.
  - `IAuditLogDetail extends IAuditLogListItem { beforeData, afterData }`.
- i18n `vi` và `en`:
  - `nav.activity`, `audit.*` (tiêu đề, bộ lọc, cột, nhãn hành động, nhãn nguồn, "Dữ liệu cũ", trạng thái trống, lỗi, nhãn từng bảng).
  - `transactions.details.history`.

### 3.4. API (`apps/api/src/audit`)

- `AuditController` mới, chỉ admin qua `requireDashboardAdmin`:
  - `GET /api/audit-logs`: lọc như query DTO. Mặc định loại các bảng `technical`. Sắp xếp `created_at DESC`. `limit` mặc định 50, tối đa 200.
  - `GET /api/audit-logs/:id`: trả đủ `beforeData`/`afterData` (đã redact sẵn khi ghi).
- `AuditService` bổ sung `list(query)` và `get(id)`:
  - Tra tên người thực hiện theo lô (`users.firstName`). `DASHBOARD_OWNER_USER_ID` hiển thị là "Chủ hệ thống".
  - Tra tên kênh theo lô (`zca_thread_configs`), cùng cách `FinanceService.toTransactionItems` đang làm.
  - `changedFields`, tính bằng hàm thuần `computeChangedFields(before, after)`:
    - update có cả trước và sau → các khoá có giá trị khác nhau;
    - update chỉ có giá trị mới (`repo.update`) → các khoá của dữ liệu sau;
    - insert/remove → `[]`.
  - Danh sách **không** trả `beforeData`/`afterData`, để payload nhẹ.
- `AuditModule` import `TypeOrmModule.forFeature([AuditLogEntity, UserEntity, ZcaThreadConfigEntity])` và `DashboardAuthModule`. Cần kiểm tra lại vòng import với `UsersModule` (vì `UsersService.isAdmin`) khi code.
- `listRecent` của trang chủ giữ nguyên. Sau khi sửa, cột `actor_id` mang nghĩa đúng, nên trang chủ sẽ hiện các việc người dùng đó thực sự đã làm.

### 3.5. Web (`apps/web/src/modules/audit`, module mới cùng tên với `apps/api/src/audit`)

- `api/audit-api.ts`, `api/audit-query.ts`:
  - `auditQueryKeys` theo dạng factory `['audit', 'list', query]`, `['audit', 'detail', id]`.
  - Dùng `keepPreviousData` khi đổi trang.
  - Lỗi 403 không retry, theo mẫu `users-query.ts`.
- `model/audit-url-state.ts`: bộ lọc và trang lưu trên query string, theo mẫu `chat-table-url-state.ts`. Có spec.
- `model/audit-labels.ts`: map bảng, hành động và nguồn sang khoá i18n.
- `presentation/components/`:
  - `audit-filters.tsx`: nhóm bảng, hành động, nguồn, người thực hiện (lấy từ facets), khoảng ngày, công tắc "Hiện bản ghi kỹ thuật".
  - `audit-table.tsx`: dùng `DataTable` có sẵn với các cột thời điểm, người thực hiện (+ nguồn/kênh), hành động, dữ liệu (nhãn bảng + `recordId` rút gọn), các trường đã đổi.
  - `audit-detail-dialog.tsx`: bảng so sánh trường | trước | sau, tô đậm trường đã đổi. Dòng insert/remove hiện một cột. Dòng "Dữ liệu cũ" có ghi chú.
- `view/activity-screen.tsx`:
  - Có đủ 4 trạng thái (đang tải, lỗi + thử lại, trống, có dữ liệu).
  - Dùng `ZcaAdminOnlyNotice` khi nhận 403.
  - Responsive: trên điện thoại (≤640px), mỗi dòng là một thẻ; bộ lọc gom vào một hàng chip cuộn ngang, chiều cao 32px giống các trang khác. Giữ bo góc nhỏ hiện có.
- Route `apps/web/app/(private)/activity/page.tsx`: metadata và render `ActivityScreen`. Bọc `Suspense` vì dùng `useSearchParams` trong static export.
- Menu ([app-navigation.tsx](../../../apps/web/src/shared/ui/app-navigation.tsx)): thêm mục `activity` vào nhóm HỆ THỐNG, `adminOnly: true`, icon mới `activity`.
- Liên kết từ trang khác:
  - Khung "Chi tiết giao dịch" (module `expenses`): thêm nút "Xem lịch sử" → `APP_ROUTES.activityFor('finance_transactions', id)`. Nút chỉ hiện với admin (`GET /api/me`).
  - Bảng hoạt động ở trang chủ (module `dashboard`): thêm link "Xem tất cả" cho admin.

## 4. Các bước thực hiện (Phase 2, sau khi anh duyệt)

1. Contracts: routes, types, `AUDIT_TABLES`, i18n vi/en.
2. `audit-context.ts` + middleware + gắn `setActor` vào `dashboard-user.ts`. Kèm spec.
3. Sửa subscriber, bỏ fallback. Kèm spec cho các trường hợp: có context, không context, không lấy từ dòng dữ liệu.
4. Bọc context ở ZCA dispatch, `processConfirm`, 2 processor, import lịch. Thêm spec cho `processConfirm` để kiểm tra actor là người yêu cầu.
5. Migration + cập nhật entity + `UserMergeService` (`actorSource`).
6. `AuditService.list/get`, `computeChangedFields`, `AuditController`. Kèm spec cho bộ lọc, loại bảng kỹ thuật, phân trang, facets, 403 với người không phải admin.
7. Module web `audit` + trang `/activity` + mục menu.
8. Link "Xem lịch sử" (expenses) và "Xem tất cả" (dashboard).
9. Tài liệu (mục 6).
10. Kiểm tra (mục 5).

## 5. Kiểm tra

- `npm run typecheck`, `npm run lint`, `npm run test`, mỗi lệnh chạy riêng cho `@zalobot/contracts`, `@zalobot/api`, `@zalobot/web`.
- `npm run build --workspace @zalobot/web` để chắc trang static export build được.
- Chạy migration trên DB local, chỉ khi DB local đang chạy; không chạy được thì sẽ báo rõ.
- Kiểm tra trong trình duyệt, chỉ với môi trường local:
  - Sửa một giao dịch của người khác → nhật ký ghi đúng người sửa.
  - Bộ lọc và URL state hoạt động.
  - Hộp thoại so sánh trước/sau hiển thị đúng.
  - Giao diện điện thoại và desktop.
  - Tài khoản không phải admin thấy thông báo chỉ dành cho admin.
- `node .claude/hooks/docs-drift-check.mjs --all` phải trả mã 0.

## 6. Tài liệu (Hard Completion Gate)

- **Mới**:
  - `.agents/knowledge/modules/audit/README.md` (EN): cách ghi người thực hiện, nguồn, bảng kỹ thuật, API, giao diện, dữ liệu cũ.
  - `.agents/docs/modules/audit/README.md` (VI): giải thích nghiệp vụ và cách vận hành.
- **Cập nhật**:
  - Index `modules/README.md` ở cả knowledge và docs, cùng `.agents/docs/README.md`.
  - `project-overview.md`: thêm `/activity` vào danh sách trang và danh sách trang chỉ admin.
  - `global/dashboard-session.md`: thêm vào danh sách menu chỉ dành cho admin.
  - `CONTEXT.md`: bổ sung định nghĩa "Nhật ký kiểm toán" (người thực hiện, nguồn, kênh; dữ liệu cũ) và thuật ngữ "Người thực hiện".
  - Tài liệu module `expenses` và `dashboard`, cho hai link mới.

## 7. Rủi ro và giới hạn

- **Thao tác hàng loạt**: `repo.update` / `repo.delete` theo điều kiện sinh dòng audit thiếu `recordId` hoặc dữ liệu trước. Ví dụ `delete` allocation theo `financeTransactionId`, `update` cờ `sentAt`. Đợt này chỉ hiển thị trung thực ("thay đổi hàng loạt", không có dữ liệu trước) và **không** đổi các lời gọi này sang `save` để lấy đủ dữ liệu, vì việc đó ngoài phạm vi.
- **Bảng phình to**: `audit_logs` không có chính sách dọn dữ liệu. Index `created_at` giúp phân trang nhanh. Dọn định kỳ là việc riêng.
- **Việc chạy ngầm trong request**: việc bắn đi rồi quên (`void …`) bên trong request sẽ mang theo người của request đó. Thường như vậy là đúng; những chỗ chắc chắn là việc của hệ thống đã được bọc `runAsSystem`.
- **Dữ liệu cá nhân**: before/after có thể chứa số điện thoại, ghi chú. Trang chỉ dành cho admin, và các trường token/secret/password đã được che sẵn khi ghi.
- **Dữ liệu cũ**: không sửa được người thực hiện, chỉ đánh dấu.

## 8. Câu hỏi cần anh chốt (đã có mặc định nếu anh không đổi)

- **Q1**: Thao tác chờ duyệt được người khác duyệt (bằng `yes <code>` hoặc thả tim) thì ghi người thực hiện là **người yêu cầu** *(mặc định)*. Có cần ghi thêm **người duyệt** không? Nếu có, phải thêm một cột và sửa `handleReaction` để truyền người thả tim.
- **Q2**: Đường dẫn `/activity` và tên menu "Nhật ký hoạt động" *(mặc định)*.
- **Q3**: Mặc định ẩn 4 bảng kỹ thuật (token, phiên đăng nhập, lần nhắc) *(mặc định: ẩn, có công tắc để hiện)*.

## 9. Ngoài phạm vi

Dọn nhật ký định kỳ; xuất CSV; ghi người duyệt (trừ khi Q1 = có); chuyển các lời gọi `update`/`delete` hàng loạt sang `save`; mở trang cho người không phải admin.
