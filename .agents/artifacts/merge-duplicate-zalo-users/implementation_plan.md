# Kế hoạch: Gộp user trùng (ID webhook cũ → UID ZCA) và thao tác "Gộp tài khoản"

Rủi ro: **HIGH** (di chuyển dữ liệu tài chính giữa các user, đụng quyền admin và contracts). Chẩn đoán: [`../duplicate-zalo-user-identities/diagnosis.md`](../duplicate-zalo-user-identities/diagnosis.md).

## 1. Mục tiêu

- Gộp toàn bộ dữ liệu của user nguồn (vd `573462d8909179cf2080`, ID webhook) sang user đích (vd `2285509137317769272`, UID ZCA), rồi xoá user nguồn. Chạy trong **một transaction**: lỗi ở bất kỳ bước nào thì rollback toàn bộ.
- Admin tự thực hiện trên trang Users: chọn user đích, xem trước số dòng sẽ chuyển, rồi xác nhận.

**Điều chỉnh so với hướng B trong chẩn đoán:** không viết migration hardcode ID. Không có cách nhận diện tự động đáng tin cậy (ZCA không trả ID webhook), và hardcode ID của một người vào migration là sai. Thay vào đó làm một chức năng gộp dùng chung; anh chạy nó một lần cho Văn Đạt, và dùng lại cho các trường hợp sau (vd "Đen"). **Không cần đổi schema.**

## 2. Bối cảnh & hiện trạng

- `users.id` là danh tính duy nhất (`apps/api/src/database/entities/user.entity.ts`). Không có FK cứng; các bảng tham chiếu user qua cột `user_id` varchar.
- Các bảng có `user_id`: `finance_transactions`, `finance_places` (UNIQUE `user_id + normalized_name`), `user_categories`, `debts`, `debt_contacts` (+ `linked_user_id`), `debt_payments`, `debt_payment_allocations`, `reminders`, `dashboard_exchange_tokens`, `user_tokens` (PK = `userId`, chứa Google token).
- `audit_logs.actor_id` là bản ghi kiểm toán, theo `CONTEXT.md` thì **không được sửa**.
- Redis: `whitelist:user:<id>` (`apps/api/src/redis/redis.service.ts:122-132`). UsersService còn có cache trong bộ nhớ `adminUserIdsCache` / `allowedUserIdsCache`.
- `refreshMemoryCache()` (`users.service.ts:67-91`) **tự tạo lại** user cho mọi ID trong `ADMIN_USER_IDS`, `ADMIN_USER_ID`, `ZALO_ADMIN_ID`, `ZALO_ADMIN_USER_ID`. Nếu env vẫn chứa ID cũ, bản ghi trùng sẽ xuất hiện lại sau lần khởi động tiếp theo.
- Controller hiện có: `apps/api/src/users/users.controller.ts` (guard admin `this.admin(req)`). Routes: `packages/contracts/src/index.ts:18-20`. Web: `apps/web/src/modules/users/{api,view}`.

## 3. Phạm vi thay đổi

### A. Contracts — `packages/contracts/src/index.ts` [MODIFY]
- `API_ROUTES.usersMergePreview(id)` → `/api/users/${id}/merge-preview`; `API_ROUTES.usersMerge(id)` → `/api/users/${id}/merge`.
- Interface `IUserMergeRequest { targetUserId: string }`, `IUserMergeSummary { sourceUserId; targetUserId; counts: Record<UserMergeTable, number>; conflicts: { places: number; contacts: number; categories: number; googleToken: 'keep-source' | 'keep-target' | 'none' } }`, type `UserMergeTable`.
- i18n key `users.merge.*` (vi + en): nút, tiêu đề dialog, chọn user đích, bảng xem trước, cảnh báo không hoàn tác được, cảnh báo cập nhật `ADMIN_USER_IDS`, thông báo thành công/lỗi.

### B. API
- **[NEW] `apps/api/src/users/user-merge.service.ts`**
  - `preview(sourceId, targetId)`: đếm số dòng theo từng bảng và số xung đột. Không ghi gì.
  - `merge(sourceId, targetId, actorId)`: dùng `DataSource.transaction`:
    1. Validate: 2 ID khác nhau, cả 2 tồn tại. Nếu user nguồn đang là session hiện tại thì vẫn cho gộp, nhưng response báo admin phải mở lại dashboard từ link ZCA.
    2. `finance_places` trùng `normalized_name`: trỏ `finance_transactions.place_id` sang place của user đích, xoá place nguồn. Phần còn lại cập nhật `user_id`.
    3. `debt_contacts` trùng `normalized_name + normalized_alias`: trỏ `debts.contact_id` và `finance_transactions.contact_id` sang contact đích, xoá contact nguồn. Phần còn lại cập nhật `user_id`. Cập nhật `linked_user_id` từ nguồn sang đích.
    4. `user_categories` trùng `type + name`: xoá bản ghi của nguồn (giao dịch lưu tên danh mục nên không mất dữ liệu). Phần còn lại cập nhật `user_id`.
    5. `UPDATE user_id` cho `finance_transactions`, `debts`, `debt_payments`, `debt_payment_allocations`, `reminders`.
    6. `user_tokens`: nếu đích chưa có token thì chuyển token của nguồn sang. Nếu cả 2 cùng có thì giữ token có `refreshToken` mới nhất (`updatedAt`) và xoá token kia.
    7. `dashboard_exchange_tokens` của nguồn: xoá (token ngắn hạn).
    8. Hồ sơ đích: lấy `role` cao hơn (ADMIN thắng), `grantAccess` = GRANTED nếu một trong hai đã GRANTED. Các trường đích đang trống (`firstName`, `username`, `phoneNumber`, `avatarUrl`, `driveFolder*`, `preferredLocale`, `timezone`) lấy từ nguồn. `createdAt` lấy giá trị sớm hơn.
    9. Xoá user nguồn và ghi **một** `audit_logs` mới (`table_name='users'`, `action='merge'`, before/after kèm counts).
  - Sau commit: xoá Redis `whitelist:user:<source>`, set `whitelist:user:<target>`, gọi `usersService.refreshMemoryCache()`.
- **[MODIFY] `users.controller.ts`**: `GET users/:id/merge-preview?targetUserId=` và `POST users/:id/merge` (body `IUserMergeRequest`, DTO dùng class-validator). Chỉ admin. Path lấy theo contracts.
- **[MODIFY] `users.module.ts`**: đăng ký `UserMergeService` và các repository / `DataSource` cần dùng.
- **[MODIFY] `users.service.ts`**: `refreshMemoryCache()` log **cảnh báo** khi một ID admin trong env không có bản ghi và trông giống ID webhook (20 ký tự hex), để nhắc cập nhật env. Không đổi hành vi tự tạo admin.

### C. Web — `apps/web/src/modules/users`
- **[MODIFY] `api/users-api.ts`, `api/users-query.ts`**: `getUserMergePreview`, `useUserMergePreviewQuery`, `useMergeUserMutation` (invalidate query users khi thành công).
- **[NEW] `presentation/components/merge-user-dialog.tsx`**: chọn user đích (loại trừ chính user nguồn), bảng xem trước counts/xung đột, checkbox xác nhận "không hoàn tác được", nút Gộp. Đủ 4 trạng thái loading/error/empty/success. Toàn bộ text đi qua i18n.
- **[MODIFY] `view/users-screen.tsx`**: thêm thao tác "Gộp vào…" ở cột Thao tác cho mọi dòng (kể cả admin), mở dialog.

### D. ENV / vận hành
- Không thêm biến mới. **Bước thủ công bắt buộc:** đổi `ADMIN_USER_IDS` / `ZALO_ADMIN_ID` từ `573462d8909179cf2080` sang `2285509137317769272` ở `.env`, `.env.production` và Coolify **trước khi** gộp, rồi restart API. Nếu không đổi, user cũ sẽ bị tạo lại khi khởi động. Mình sẽ không đọc hay sửa các file `.env*`; anh tự sửa.

## 4. Rủi ro & rollback

- Di chuyển dữ liệu tài chính chạy trong một transaction duy nhất, nên lỗi ở bước nào cũng rollback toàn bộ.
- Xử lý trùng place / contact có thể gộp nhầm hai "nơi chốn" hoặc "người liên quan" khác nhau mà tên chuẩn hoá giống nhau. Bước xem trước hiển thị số xung đột để anh kiểm tra trước khi xác nhận.
- Không hoàn tác được sau khi commit. Khuyến nghị `pg_dump` trước khi gộp lần đầu.
- Session dashboard đang đăng nhập bằng ID nguồn sẽ mất quyền sau khi gộp. Mở lại dashboard từ link mà bot ZCA gửi.

## 5. Kế hoạch kiểm thử

- `apps/api/src/users/user-merge.service.spec.ts` (node:test, EntityManager giả lập), gồm các trường hợp:
  - Từ chối khi 2 ID trùng nhau hoặc một trong hai không tồn tại.
  - Chuyển đúng counts.
  - Xung đột place / contact: các giao dịch được trỏ lại sang bản ghi của user đích.
  - Chọn đúng `user_tokens`.
  - Role ADMIN và GRANTED được giữ.
  - Ghi audit log và không sửa audit cũ.
  - Lỗi giữa chừng thì không có thay đổi nào được ghi.
- Lệnh:
  - `npm run build --workspace @zalobot/contracts`
  - `npm run typecheck|lint:check|test --workspace @zalobot/api`
  - `npm run typecheck|lint:check|build --workspace @zalobot/web`
  - `node .claude/hooks/docs-drift-check.mjs`
- Kiểm tra tay sau khi deploy: preview Văn Đạt (nguồn `573462…` → đích `2285…`), gộp, kiểm tra trang Users còn 1 dòng, dữ liệu giao dịch / công nợ hiển thị trên dashboard mở từ link ZCA, bot nhận anh là admin.

## 6. Cập nhật tài liệu

- `.agents/knowledge/modules/users/README.md` (EN): luồng merge, quy tắc xung đột, endpoints, quy tắc giữ audit log, cảnh báo env admin.
- `.agents/docs/modules/users/README.md` (VI): hướng dẫn gộp, bước đổi env, troubleshooting.
- `CONTEXT.md`: thêm thuật ngữ **Gộp tài khoản** (một người, nhiều ID kênh Zalo).
- `.agents/docs/README.md`: không cần đổi (không thêm topic mới).

## 7. Câu hỏi mở

1. Khi cả 2 user cùng có Google token, giữ token mới nhất như đề xuất ở bước 6 được không?
2. Danh mục trùng tên thì xoá bản của nguồn — anh đồng ý chứ?
3. Có cần nút gộp cho dòng admin không, hay chỉ cho dòng "Chờ phê duyệt"? (Đề xuất: mọi dòng, vì user nguồn trong trường hợp này chính là admin.)
