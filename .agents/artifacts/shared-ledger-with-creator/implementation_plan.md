# Kế hoạch: Sổ thu chi chung toàn hệ thống + Người tạo + Ảnh hoá đơn

- Route: `implement` · Phase 1 (inspect-and-plan) · Rủi ro: **HIGH** (đổi quyền sở hữu dữ liệu tài chính, migration DB, chuyển dữ liệu cũ)
- Ngày: 2026-10-20 · Base: `main` @ `820ff07`
- Thay thế kế hoạch `.agents/artifacts/transaction-creator-and-receipt/implementation_plan.md` (gộp vào đây).
- Yêu cầu đã chốt: **toàn hệ thống chỉ có một sổ**; ai nhắn cũng ghi vào sổ của **một người (chủ sổ)**; trang Thu chi hiện **người tạo** và **ảnh hoá đơn**.

## 1. Hiện trạng
- Mọi dữ liệu tài chính (giao dịch, nơi chốn, danh bạ công nợ, công nợ, thanh toán nợ, phân bổ, danh mục) gắn theo `user_id` = **người gửi tin** (8 strategy trong `apps/api/src/zalo/text/strategies/*` + `TransactionConfirmationService`) hoặc **user trong access token** (`FinanceController`, `ReportsController`).
- Prod: Văn Đạt `2099…056` (5 giao dịch), Diệu Hằng `5369…489` (1), admin/webhook `5734…080` (3), 2 ID không có tài khoản `2285…769` (9), `effc…848` (1).
- `UserMergeService` đã có logic gộp dữ liệu tài chính giữa 2 user (khử trùng nơi chốn, danh bạ, danh mục) nhưng **kèm xoá tài khoản nguồn**, nên không dùng nguyên được.

## 2. Thiết kế

### 2.1 Chủ sổ (ledger owner)
- Migration mới: `users.is_ledger_owner boolean NOT NULL DEFAULT false` + unique partial index `WHERE is_ledger_owner` (tối đa 1 chủ sổ).
- `LedgerService` (module finance): `resolveLedgerUserId(actorId) → ownerId ?? actorId`. Cache trong bộ nhớ, xoá cache khi đổi chủ sổ. **Chưa đặt chủ sổ thì hệ thống chạy như hiện tại** (tương thích ngược).
- Admin đặt chủ sổ ở trang **Zalo & Users**: badge "Chủ sổ" và hành động "Đặt làm chủ sổ" (admin-only, `PATCH /api/users/:id/ledger-owner`, route constant mới).

### 2.2 Áp dụng sổ chung (chỉ phần tài chính)
- **Ghi/đọc qua chat Zalo**: 8 strategy dùng `ledgerUserId = resolveLedgerUserId(senderId)` cho mọi lệnh `financeService.*` và cho `payload.userId`. `TransactionConfirmationService`: các nhánh tài chính dùng `payload.userId` / resolve từ `pending.userId`. **Người được duyệt** (gõ `yes <code>` hoặc thả ❤️) giữ nguyên quy tắc hiện tại.
- **Dashboard**: `FinanceController.userId()` và các endpoint tài chính trong `ReportsController` (dashboard summary, contacts, debts, expenses) resolve sang chủ sổ. Mọi user có quyền dùng bot vào dashboard đều thấy **cùng một sổ**.
- **Không đổi**: nhắc nhở, Google Tasks/Calendar, upload Drive/Photos (vẫn dùng token Google của người gửi), quyền admin.
- Cần rà khi làm: `users/user-linked-contacts.service.ts` (đồng bộ user Zalo vào danh bạ, commit `820ff07`/`b5489ee`) phải ghi vào danh bạ của chủ sổ.

### 2.3 Người tạo
- Migration: `finance_transactions` thêm `created_by_user_id varchar NULL`, `created_by_name varchar NULL`, `source varchar NULL` (`zalo` | `dashboard`), `source_chat_id varchar NULL`.
- Ghi: chat → `created_by_user_id = senderId`, `created_by_name = displayName`, `source = 'zalo'`, `source_chat_id = chatId`; dashboard → user trong token, `source = 'dashboard'`.
- Đọc (`toTransactionItem`): `createdByName` = `users.firstName` hiện tại của `created_by_user_id` (tra theo lô, không N+1), fallback tên đã lưu; `sourceChatName` tra `zca_thread_configs.thread_name`; `sourceChatType`.

### 2.4 Ảnh hoá đơn
- `hasReceipt` trong DTO; **không** trả `receiptUrl` thô.
- `GET /api/transactions/:id/receipt` (route constant `API_ROUTES.transactionReceipt(id)`): kiểm tra giao dịch thuộc sổ của người xem; link Drive → `files.get(alt=media)` bằng token Google của **người tạo** (`created_by_user_id`, fallback `user_id`); URL CDN Zalo → fetch phía server (≤10MB, timeout 10s, chỉ cho phép host CDN Zalo); lỗi → 404/502, không làm hỏng trang.

### 2.5 Chuyển dữ liệu cũ vào sổ chung (một lần, admin)
- Tách phần tài chính của `UserMergeService` thành `FinanceDataMover.move(manager, sourceId, targetId)` (nơi chốn, danh bạ, danh mục khử trùng; giao dịch, công nợ, thanh toán, phân bổ). `UserMergeService` dùng lại hàm này (hành vi gộp tài khoản không đổi).
- Trước khi chuyển: `created_by_user_id = user_id` cho giao dịch cũ chưa có người tạo, để **giữ nguyên ai đã ghi**.
- Endpoint admin `GET /api/finance/ledger/consolidate-preview` (đếm theo từng user_id) và `POST /api/finance/ledger/consolidate`: chuyển dữ liệu tài chính của **mọi `user_id` khác chủ sổ** (kể cả 2 ID không có tài khoản) vào chủ sổ, trong **một transaction DB**, ghi audit log. **Không xoá tài khoản nào.**
- UI: nút "Gộp dữ liệu cũ vào sổ chung" cạnh phần chủ sổ, mở dialog xem trước số lượng rồi mới xác nhận.

### 2.6 Web — trang Thu chi
- Cột **Người tạo**: tên + dòng phụ nguồn (`Nhóm <tên>` / `Chat riêng` / `Dashboard`); dữ liệu chưa có → "—". Ẩn/hiện được; mặc định ẩn ở màn < 640px.
- Cột **Ảnh**: thumbnail 32px nếu `hasReceipt`, bấm mở lightbox (`Modal` dùng chung) + nút "Mở ảnh". Ảnh tải qua `httpClient` dạng blob (cần Bearer), lazy khi vào viewport, `staleTime` 1 giờ, thu hồi object URL khi unmount.
- Dòng mở rộng: chi tiết đầy đủ (người tạo, nguồn, ghi chú đầy đủ, phương thức, tiền tệ, thời điểm tạo, ảnh lớn, phân bổ).
- i18n vi/en cho mọi nhãn mới.

## 3. Thứ tự triển khai
1. Migration + entity (`is_ledger_owner`, 4 cột người tạo/nguồn).
2. `LedgerService` + endpoint đặt chủ sổ + UI Zalo & Users.
3. Áp dụng resolve cho chat (8 strategy + confirmation) và dashboard (finance/reports controller).
4. Ghi người tạo/nguồn; DTO đọc người tạo, tên nhóm, `hasReceipt`.
5. `FinanceDataMover` + refactor `UserMergeService` + endpoint/UI gộp dữ liệu cũ.
6. Endpoint ảnh + UI cột Người tạo/Ảnh/dòng mở rộng.
7. Test, docs, walkthrough.

## 4. Kiểm thử
- `LedgerService`: chưa có chủ sổ → trả actorId; có → trả ownerId; đổi chủ sổ → cache mới.
- Strategy ghi giao dịch: `payload.userId` = chủ sổ, `createdByUserId` = người gửi; các strategy đọc (`/today`, `/finance`, `/debts`, báo cáo, xoá giao dịch) dùng sổ chủ.
- Dashboard: user A và B cùng thấy giao dịch của nhau khi đã có chủ sổ.
- `FinanceDataMover`: khử trùng nơi chốn/danh bạ/danh mục, giữ `created_by_user_id`; test `UserMergeService` hiện có vẫn pass.
- Consolidate: chạy trong transaction, chỉ admin, không xoá user.
- Endpoint ảnh: sai sổ → 404, không ảnh → 404, Drive dùng token người tạo, host lạ → 404.
- `npm run typecheck`, `npm run test`, lint các file sửa, `npm run build --workspace @zalobot/web`.

## 5. Vận hành sau deploy (anh làm trên prod)
1. **Backup DB trước** (`pg_dump`) — vì bước gộp dữ liệu không hoàn tác tự động.
2. Vào Zalo & Users → đặt **Văn Đạt** làm chủ sổ.
3. Bấm "Gộp dữ liệu cũ", kiểm tra bản xem trước, xác nhận.

## 6. Tài liệu
- `CONTEXT.md` (thuật ngữ **Sổ chung / Chủ sổ / Người tạo**), `global/finance-domain.md`, `global/backend-crud-api.md`, `modules/dashboard`, `modules/users`, `modules/zca`, `global/receipt-image-analysis.md` (EN+VI). Drift check pass + walkthrough.

## 7. Cần anh duyệt
1. Chủ sổ đặt bằng giao diện Zalo & Users (không dùng biến môi trường) — đồng ý?
2. **Mọi** dữ liệu tài chính (thu chi, nơi chốn, danh bạ, công nợ, danh mục) đều dùng chung — đồng ý?
3. Gộp dữ liệu cũ của **tất cả** ID (kể cả admin/webhook và 2 ID không có tài khoản) vào chủ sổ, không xoá tài khoản — đồng ý?
4. Ai có quyền dùng bot cũng xem được toàn bộ sổ chung trên dashboard — đồng ý?
