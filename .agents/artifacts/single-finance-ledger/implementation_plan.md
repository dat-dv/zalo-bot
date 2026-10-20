# Implementation Plan: Một kho tài chính duy nhất — bỏ hẳn `user_id` khỏi dữ liệu tài chính

Trạng thái: **đã duyệt & đã thực hiện** (xem `walkthrough.md`) · Rủi ro: **HIGH** (đổi schema 7 bảng, migration di chuyển + xoá dữ liệu trùng trên production, đổi chữ ký service, xoá API công khai)

## 1. Bối cảnh & quyết định nghiệp vụ

- Production (2026-10-20): 19 giao dịch rải ở 5 `user_id`; dashboard chỉ đọc theo người đăng nhập → Văn Đạt thấy 5/19.
- Nguyên nhân: mọi bảng tài chính có cột `user_id` và mọi query lọc theo nó; khi chưa chọn "chủ sổ", `LedgerService.resolveLedgerUserId()` trả về chính người thao tác → mỗi user một sổ.
- **Anh chốt**: hệ thống **không làm riêng cho từng user**, chỉ có **một kho tài chính**; **bỏ hẳn `user_id`** (không dùng mẹo `'shared'`), bỏ khái niệm "chủ sổ".

## 2. Tiêu chí chấp nhận

- Không bảng tài chính nào còn cột `user_id`; không query tài chính nào lọc theo người dùng.
- Mọi tài khoản dashboard / mọi ID Zalo nhắn bot đều thấy và thao tác trên toàn bộ dữ liệu tài chính.
- Production sau deploy: mọi tài khoản thấy đủ 19 giao dịch; `today`/báo cáo bot tính trên 19 giao dịch.
- "Người tạo" (`created_by_user_id`, `created_by_name`, `source`, `source_chat_id`) vẫn ghi và hiển thị — chỉ để xem.
- Không còn API/UI/cột "chủ sổ".

## 3. Phạm vi dữ liệu

| Bảng | Hành động |
|---|---|
| `finance_transactions` | bỏ `user_id` (+ index) |
| `finance_places` | bỏ `user_id`; unique `(user_id, normalized_name)` → unique `(normalized_name)` |
| `debt_contacts` | bỏ `user_id`; tên/biệt danh chuẩn hoá trở thành khoá toàn hệ thống |
| `debts`, `debt_payments`, `debt_payment_allocations` | bỏ `user_id` |
| `user_categories` | bỏ `user_id`; danh mục dùng chung (giữ tên bảng để tránh đổi tên không cần thiết) |
| `users` | bỏ `is_ledger_owner` + index `UQ_users_single_ledger_owner` |
| **Giữ nguyên** | `reminders`, `user_tokens`, `dashboard_exchange_tokens`, `zca_thread_configs`, Google (dữ liệu cá nhân); `debt_contacts.linked_user_id` (liên kết tài khoản — nghiệp vụ khác, vẫn cần) |

## 4. Thay đổi chi tiết

### 4.1 Migration mới — `apps/api/src/database/migrations/<ts>-RemoveFinanceUserScope.ts`
**SQL thuần** (không import entity/`finance-data-mover`, vì entity sẽ không còn `userId`). Chạy trong transaction của migration, theo thứ tự:
1. **Giữ người tạo**: `UPDATE finance_transactions SET created_by_user_id = user_id WHERE created_by_user_id IS NULL`.
2. **Gộp nơi chốn trùng** theo `normalized_name`: giữ bản tạo sớm nhất; `finance_transactions.place_id` trỏ về bản giữ; xoá bản trùng.
3. **Gộp người liên quan trùng** theo `(normalized_name, COALESCE(normalized_alias,''))`: giữ bản sớm nhất; trỏ `debts.contact_id`, `finance_transactions.contact_id` về bản giữ; bù `phone`, `linked_user_id` cho bản giữ nếu đang trống (không ghi đè); xoá bản trùng.
4. **Một tài khoản chỉ liên kết tối đa một người liên quan** (nay là trên toàn hệ thống): nếu sau bước 3 một `linked_user_id` còn gắn với >1 người liên quan → giữ ở bản sớm nhất, gỡ ở các bản còn lại.
5. **Gộp danh mục trùng** theo `(type, lower(trim(name)))`: giữ bản sớm nhất, xoá bản trùng (giao dịch lưu `category` dạng chuỗi nên không cần trỏ lại).
6. Ghi 1 dòng `audit_logs` (`table_name='finance_transactions'`, `after_data.operation='remove-finance-user-scope'`, số dòng theo từng `user_id` cũ + số bản ghi đã gộp) — dữ liệu trước khi đổi để truy vết.
7. Xoá index `IDX_*_user_id` của 7 bảng, `UQ_finance_places_user_normalized_name`, rồi `DROP COLUMN user_id` ở 7 bảng; tạo `UQ_finance_places_normalized_name`.
8. Xoá `UQ_users_single_ledger_owner`, `users.is_ledger_owner`.
- `down()`: chỉ thêm lại cột `user_id` nullable / `is_ledger_owner` + index; **không** khôi phục dữ liệu đã gộp (ghi rõ trong comment: cần restore backup).
- Production hiện tại: bước 2–5 xử lý trùng giữa 5 sổ cũ (ví dụ cùng nơi chốn/danh mục "Ăn uống" ở nhiều sổ).

### 4.2 Entities — `apps/api/src/database/entities/`
- Bỏ `userId` + `@Index` ở `finance-transaction`, `finance-place` (đổi `@Unique` sang `['normalizedName']`), `debt-contact`, `debt`, `debt-payment`, `debt-payment-allocation`, `user-category`; bỏ `isLedgerOwner` ở `user.entity.ts`.

### 4.3 API — service & controller
- `finance/finance.service.ts`: bỏ tham số `userId` khỏi mọi hàm tài chính và mọi điều kiện `where: { userId }` (~167 vị trí); các hàm ghi nhận `createdByUserId/createdByName/source/sourceChatId` từ người thao tác (đã có) — **không** lọc theo chúng. `getLatestTransaction(createdByUserId?)` giữ ưu tiên "giao dịch gần nhất của chính người nhắn" (đúng hành vi "xoá giao dịch vừa ghi"), fallback giao dịch mới nhất toàn kho.
- **Xoá** `finance/ledger.service.ts`, `finance/finance-data-mover.ts` (sau khi gỡ phụ thuộc), `finance/shared-ledger.spec.ts`; gỡ khỏi `finance.module.ts`.
- `finance/finance.controller.ts`: xoá `GET finance/ledger`, `PATCH finance/ledger/owner`, `POST finance/ledger/consolidate`, helper `ledgerUserId()`; mọi endpoint gọi service không kèm user. Giữ `actorId` cho kiểm tra quyền admin và "Người tạo".
- `finance/contact-user-sync.service.ts` + `contact-user-sync.ts`: bỏ `ownerId`, đồng bộ vào danh bạ chung.
- `users/user-linked-contacts.service.ts`: bỏ `ownerUserId/ownerName` (không còn chủ danh bạ).
- `users/user-merge.service.ts`: bỏ bước `moveFinanceData`; vẫn chuyển `created_by_user_id`, `linked_user_id`, reminders; bỏ phần thống kê dữ liệu tài chính theo user trong summary nếu có.
- `reports/reports.controller.ts`: bỏ `LedgerService`; báo cáo đọc toàn kho (token vẫn xác thực người xem).
- Bot Zalo — `zalo/text/strategies/*` (record-transaction, today, get-report, finance-quick, debts-quick, manage-debt, create-place, delete-transaction) và `zca/confirmation/transaction-confirmation.service.ts`, `zca/confirmation/dto-descriptor.util.ts`, `zca/pending-image/*`: bỏ `resolveLedgerUserIdOrSelf`, gọi service không kèm user; **giữ** `userId` của người nhắn cho pending action, mã xác nhận, ngôn ngữ, Google, thu hồi tin nhắn và "Người tạo".
- LLM tool handlers: không đổi định nghĩa tool (`ZALO_TOOL_DEFINITIONS`) trừ khi có tham số user.

### 4.4 Contracts — `packages/contracts/src/index.ts`
- Xoá route `ledger`, `ledgerOwner`, `ledgerConsolidate`; xoá `ILedgerInfo`, `ILedgerSource`, `ILedgerDataCounts`, `ISetLedgerOwnerRequest`, `ILedgerConsolidateResult`; bỏ `ownerUserId/ownerName` khỏi `IUserLinkedContactItem`; xoá i18n `ledger.*`; rà các DTO tài chính còn trường `userId` và bỏ. Build lại `dist`.

### 4.5 Web — `apps/web/src/modules/`
- Xoá `users/presentation/components/shared-ledger-panel.tsx`, `consolidate-ledger-dialog.tsx`; xoá hook/API ledger trong `users/api/users-api.ts`, `users-query.ts`; gỡ panel khỏi `zca/view/zca-screen.tsx`, `zca/presentation/components/chat-table-row.tsx`.
- Chỗ hiển thị chủ danh bạ của người liên quan đã liên kết (dùng `ownerUserId`) → bỏ cột/nhãn.
- Các trang tài chính không đổi logic (API đã trả toàn kho).

### 4.6 Tests
- `finance.service.spec.ts`, `finance-transactions-query.spec.ts`, `finance-contact-link.spec.ts`, `contact-user-sync.spec.ts`, user-merge spec, `deploy-notify.service.spec.ts`, spec strategies/confirmation: bỏ `userId`/mock `LedgerService`.
- Test mới: giao dịch do A ghi → B (tài khoản khác, ID hex/ID số) query thấy; `createdByUserId` = A; tạo nơi chốn trùng tên từ 2 người → dùng chung 1 bản ghi.
- Test migration: tách logic gộp trùng thành SQL kiểm thử trên DB local có dữ liệu mẫu 5 sổ (mục 6).

### 4.7 Tài liệu (Hard Completion Gate)
- `CONTEXT.md`: **Giao dịch** "thuộc đúng một người dùng zalo" → "thuộc kho tài chính chung, ghi nhận người tạo"; định nghĩa lại **Sổ chung**; xoá **Chủ sổ**; **Danh bạ công nợ** "riêng của mỗi người dùng" → dùng chung; **Liên kết tài khoản** "trong một danh bạ" → toàn hệ thống; **Gộp tài khoản** không còn chuyển dữ liệu tài chính.
- `.agents/knowledge/global/finance-domain.md` (EN) + `.agents/docs/global/finance-domain.md` (VI); `.agents/knowledge/project-overview.md` (Shared Ledger, Finance); tài liệu module `finance`, `users`, `zca` nhắc user-scope/chủ sổ; `.agents/knowledge/global/backend-crud-api.md` nếu nêu lọc theo user; `.agents/docs/README.md`.
- `node .claude/hooks/docs-drift-check.mjs` → exit 0.

## 5. Ngoài phạm vi
- Calendar/Tasks/Reminders (dữ liệu cá nhân Google).
- Lệch múi giờ `occurred_at` (dòng cũ UTC, dòng mới giờ VN) — task riêng.
- Phân quyền xem tài chính theo vai trò (hiện mọi user được cấp quyền đều thấy toàn kho — đúng yêu cầu).

## 6. Rollout production
1. **Backup trước deploy**:
   `docker exec postgres-rn8pasb6jb1jz4toyhghxaqi-<ts> sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > zalobot-before-remove-user-scope.sql`
2. Deploy → migration chạy khi API khởi động. **Không hoàn tác tự động**; rollback = restore backup + deploy commit cũ.
3. Kiểm tra sau deploy:
   - `SELECT count(*) FROM finance_transactions;` → 19
   - `SELECT normalized_name, count(*) FROM finance_places GROUP BY 1 HAVING count(*) > 1;` → 0 dòng
   - `\d finance_transactions` → không còn `user_id`
   - Đăng nhập bằng 2 tài khoản khác nhau → cùng thấy 19 giao dịch.

## 7. Kiểm chứng
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` (api, web, contracts).
- Chạy migration trên DB local (docker-compose.local) đã seed dữ liệu giả lập 5 sổ có nơi chốn/người liên quan/danh mục trùng → chạy các query mục 6.3.

## 8. Thứ tự thực hiện (Phase 2)
1. Migration + entities → 2. `finance.service` + controller + xoá ledger/mover → 3. strategies/confirmation/reports/users → 4. contracts → 5. web → 6. tests → 7. typecheck/lint/test/build + chạy migration local → 8. tài liệu + docs-drift-check.
