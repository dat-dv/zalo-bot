# Walkthrough: Một kho tài chính duy nhất — bỏ `user_id` khỏi dữ liệu tài chính

Trạng thái: **đã thực hiện** theo `implementation_plan.md` (phương án bỏ hẳn `user_id`, anh duyệt 2026-10-20). Đã merge vào `main` (`ee3c24b`, v1.0.98) và deploy production.

## 1. Thay đổi code

### Database
- Migration mới `apps/api/src/database/migrations/1724790000000-RemoveFinanceUserScope.ts` (SQL thuần, đăng ký trong `data-source.ts` và `database.module.ts`):
  1. Điền `created_by_user_id = user_id` cho giao dịch cũ.
  2. Gộp trùng giữa các sổ cũ: nơi chốn (tên chuẩn hoá), người liên quan (tên + biệt danh; bản giữ lại được bù SĐT/avatar/liên kết), danh mục (loại + tên). Giao dịch/công nợ trỏ về bản giữ lại.
  3. Mỗi tài khoản chỉ còn liên kết tối đa một người liên quan.
  4. Ghi 1 dòng `audit_logs` (số lượng theo từng sổ cũ), xoá cột `user_id` ở 7 bảng tài chính, tạo unique `UQ_finance_places_normalized_name`, xoá `users.is_ledger_owner`.
  - `down()` chỉ thêm lại cột rỗng; dữ liệu cũ cần khôi phục từ backup.
- Entity: bỏ `userId` ở 7 entity tài chính; bỏ `isLedgerOwner` ở `UserEntity`.
- `AuditLogSubscriber`: `actor_id` lấy `userId`, nếu không có thì `createdByUserId`.

### API
- `FinanceService`: bỏ tham số/điều kiện `userId` ở mọi hàm. Bỏ quy tắc "không gắn người liên quan với chính chủ danh bạ".
- Xoá `LedgerService`, `finance-data-mover.ts`, `shared-ledger.spec.ts`, 3 endpoint `/api/finance/ledger*`.
- `FinanceController`: mọi endpoint gọi `authenticate(req)` (vẫn bắt buộc đăng nhập) rồi gọi service không kèm user. Ảnh hoá đơn Drive đọc bằng token của người tạo (không có người tạo → 404).
- `ReportsController`: dashboard/contacts/debts/expenses đọc toàn kho.
- Bot Zalo: 8 strategy + `TransactionConfirmationService` + `dto-descriptor.util.ts` bỏ phân giải sổ; vẫn giữ `userId` người nhắn cho thẻ chờ duyệt và "Người tạo".
- `ContactUserSyncService`: đồng bộ vào danh bạ chung (chỉ bỏ qua tài khoản bot).
- `UserMergeService`: không di chuyển dữ liệu tài chính; chỉ chuyển người tạo giao dịch, liên kết người liên quan (gỡ nếu user đích đã có), lời nhắc, token Google.
- `UserLinkedContactsService`: bỏ `ownerUserId/ownerName`.
- Script `apps/api/scripts/cleanup-group-users.ts`: kiểm tra tham chiếu theo `created_by_user_id`, `linked_user_id`, `user_tokens`, `reminders`, `dashboard_exchange_tokens` (trước đây lọc bảng tài chính theo `userId` → sẽ lỗi sau migration).

### Contracts (`packages/contracts`)
- Xoá route/kiểu/i18n `ledger*`; `IUserLinkedContactItem` bỏ owner; `IDebtPaymentItem`/`IDebtAllocationItem` bỏ `userId`; `USER_MERGE_TABLES` = `financeTransactions`, `debtContacts`, `reminders`, `googleToken`; `IUserMergeConflicts` = `{ linkedContacts, googleToken }`; cập nhật i18n gộp tài khoản (vi + en).

### Web
- Xoá `shared-ledger-panel.tsx`, `consolidate-ledger-dialog.tsx`, `users-api.spec.ts` (chỉ test API ledger), hook/API ledger; gỡ panel và badge "Chủ sổ" khỏi trang ZCA; `LinkedContactsDialog` bỏ dòng chủ danh bạ; `MergeUserDialog` hiển thị xung đột liên kết mới.

## 2. Kiểm chứng đã chạy
- `npm run typecheck` (api, web, contracts): pass.
- `npm run test --workspace @zalobot/api`: 378/378 pass (có test mới: tạo giao dịch không gắn chủ sở hữu, query không lọc theo user, gộp tài khoản giữ nguyên dữ liệu tài chính, gỡ liên kết khi user đích đã có).
- `npm run test --workspace @zalobot/web`: 26/26 pass.
- `npm run build` api + web: pass.
- ESLint các file đã sửa: sạch. Lỗi lint còn lại có từ trước, không thuộc thay đổi này: `zca/confirmation/transaction-confirmation.service.ts` (`rawMessenger: any`), `zalo/text/text-input.service.ts`, `transaction-confirmation.service.spec.ts` (`ZaloService` không dùng), `apps/web/src/modules/zca/api/zca-query.ts`.
- **Migration chạy thử** trên Postgres 16 tạm (Docker) với dữ liệu giả lập nhiều sổ có trùng: nơi chốn/người liên quan/danh mục trùng được gộp, giao dịch & công nợ trỏ đúng, người tạo được điền, liên kết trùng bị gỡ, chỉ `reminders`/`dashboard_exchange_tokens` còn `user_id`, `down()` chạy được.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## 3. Tài liệu đã cập nhật
- `CONTEXT.md` (Giao dịch, Sổ chung, bỏ Chủ sổ, Người tạo, Danh bạ công nợ, Liên kết tài khoản, Gộp tài khoản).
- Knowledge (EN): `project-overview.md`, `global/finance-domain.md`, `global/backend-crud-api.md`, `global/README.md`, `modules/users`, `modules/zca`, `modules/contacts`, `modules/debts`, `modules/dashboard`.
- Docs (VI): `global/finance-domain.md`, `global/backend-crud-api.md`, `README.md`, `modules/users`, `modules/zca`, `modules/contacts`, `modules/dashboard`.

## 4. Rollout production (anh tự làm)
1. Backup: `docker exec postgres-rn8pasb6jb1jz4toyhghxaqi-<ts> sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > zalobot-before-remove-user-scope.sql`
2. Deploy; migration tự chạy khi API khởi động.
3. Kiểm tra: `SELECT count(*) FROM finance_transactions;` → 19; `\d finance_transactions` không còn `user_id`; đăng nhập 2 tài khoản khác nhau đều thấy 19 giao dịch.

## 4a. Kết quả trên production (2026-10-20)

Coolify tự deploy commit `ee3c24b` (v1.0.98) ngay sau khi push `main`; **không có backup DB trước migration**. Kiểm tra sau deploy:

| Kiểm tra | Kết quả |
|---|---|
| `typeorm_migrations` | `RemoveFinanceUserScope1724790000000` đã chạy (08:28 UTC) |
| `count(*) finance_transactions` | 19 (không mất dòng) |
| `created_by_user_id` | đủ 19 dòng: `2285509137317769272` 9, `2099328425338516056` 5, `573462d8909179cf2080` 3, `effcda102859c1079848` 1, `5369142156728714489` 1 |
| `audit_logs` | `merged: { places: 2, contacts: 0, categories: 19, unlinkedContacts: 0 }` (19 danh mục = bộ mặc định bị seed lặp ở mỗi sổ cũ) |
| Cột `user_id` | chỉ còn ở `dashboard_exchange_tokens`, `reminders` |

Còn mở (không ảnh hưởng dữ liệu): 10 giao dịch có người tạo là `2285509137317769272` và `effcda102859c1079848`, hai ID không có dòng `users`, nên cột "Người tạo" có thể hiện "—". Nếu xác nhận đó là ID cũ của Văn Đạt thì chuyển `created_by_user_id` sang `2099328425338516056` bằng tay.

## 5. Rủi ro còn lại
- Thẻ chờ duyệt đang nằm trong Redis lúc deploy vẫn chứa `userId` cũ trong payload; trường thừa này bị bỏ qua khi ghi, không gây lỗi.
- Tên nơi chốn nay là duy nhất toàn hệ thống: tạo nơi chốn trùng tên sẽ dùng lại bản có sẵn.
