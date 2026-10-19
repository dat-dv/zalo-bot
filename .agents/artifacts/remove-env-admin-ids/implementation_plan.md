# Kế hoạch: Bỏ cơ chế admin qua biến môi trường

Rủi ro: **MEDIUM**. Thay đổi cách xác định admin, ảnh hưởng nhiều file, không đổi schema DB.

## 1. Mục tiêu

Bỏ hẳn việc đọc `ADMIN_USER_IDS`, `ADMIN_USER_ID`, `ZALO_ADMIN_ID`, `ZALO_ADMIN_USER_ID`. Sau thay đổi, admin chỉ đến từ 3 nguồn:
1. `users.role = admin` trong DB: người đầu tiên chat với bot (`bootstrapFirstAdmin`) hoặc người được set trên dashboard.
2. Tài khoản ZCA của chính bot (`zcaService.getOwnId()`), giữ nguyên như hiện tại.
3. Cache trong bộ nhớ, được dựng lại từ 2 nguồn trên.

## 2. Hiện trạng (bằng chứng)

- `apps/api/src/users/users.service.ts:50-64`: `getEnvAdminIds()` đọc 4 biến env (không qua config đã validate — trái với quy tắc env guard).
- Các chỗ dùng nó:
  - `:69-91` `refreshMemoryCache()`: ép làm admin và **tự tạo lại user** cho mỗi ID trong env.
  - `:183` `getAdminUsers()`.
  - `:237` `isAdmin()`.
  - `:430` `upsertUser()`.
  - `:594` `isEnvAdmin()`, mới thêm cho chức năng gộp.
- Chức năng gộp: `user-merge.service.ts:92-95` (chặn gộp khi ID nguồn là env admin), `:198` (`sourceIsEnvAdmin`); `user-merge.types.ts:42`; `user-merge.service.spec.ts:110, 263`.
- Contracts: `IUserMergeSummary.sourceIsEnvAdmin` (`index.ts:1709`), key i18n `users.merge.envAdminWarning` (vi `:146`, en `:846`).
- Web: `merge-user-dialog.tsx:75, 224-232`.
- Test cũ: `users-sync.spec.ts:91-120` (test admin qua `ZALO_ADMIN_ID`).
- Env template: `apps/api/.env.example:27` (`ZALO_ADMIN_ID=...`). Tài liệu: `README.md:123`, `docs/deployment.md:35`, `docs/quick-setup-runbook.md:45`, `.agents/knowledge|docs/modules/users/README.md`.
- `.env` và `.env.production` của anh không đặt biến nào trong 4 biến này (đã kiểm tra bằng cách đếm dòng, không đọc giá trị).

## 3. Phạm vi thay đổi

### API — `apps/api/src/users`
- [MODIFY] `users.service.ts`:
  - Xoá `getEnvAdminIds()`.
  - `refreshMemoryCache()`: chỉ đảm bảo `ownId` (nếu có) là admin, bỏ log cảnh báo ID webhook.
  - `getAdminUsers()`, `isAdmin()`, `upsertUser()`: bỏ nhánh env, chỉ dùng DB role + cache + `ownId`.
  - Xoá `isEnvAdmin()`.
  - Đổi comment dòng 176.
- [MODIFY] `user-merge.types.ts`: bỏ `isEnvAdmin` khỏi `UserMergeUsersPort`.
- [MODIFY] `user-merge.service.ts`: bỏ chặn env admin và trường `sourceIsEnvAdmin`. **Thêm** chặn gộp khi ID nguồn là `ownId` của bot (tài khoản bot luôn được tạo lại khi khởi động), thông qua port mới `isBotAccount(userId)`.
- [MODIFY] `users.service.ts`: thêm `isBotAccount(userId)` (so với `zcaService.getOwnId()`).
- [MODIFY] `user-merge.service.spec.ts`: thay test env admin bằng test chặn gộp tài khoản bot.
- [MODIFY] `users-sync.spec.ts`: bỏ phần `ZALO_ADMIN_ID` trong test `isAdmin`, giữ phần `ownId`, và thêm khẳng định rằng env không còn tác dụng.

### Contracts — `packages/contracts/src/index.ts`
- `IUserMergeSummary`: đổi `sourceIsEnvAdmin` thành `sourceIsBotAccount`.
- i18n: thay `users.merge.envAdminWarning` bằng `users.merge.botAccountWarning` (vi + en): "Không thể gộp tài khoản ZCA của chính bot."

### Web — `apps/web/src/modules/users/presentation/components/merge-user-dialog.tsx`
- Dùng `sourceIsBotAccount` và key i18n mới.

### Env & tài liệu
- `apps/api/.env.example`: xoá dòng `ZALO_ADMIN_ID`.
- `README.md`, `docs/deployment.md`, `docs/quick-setup-runbook.md`: bỏ `ZALO_ADMIN_ID`, thay bằng câu "Người đầu tiên chat với bot sẽ tự thành admin; admin khác set trên dashboard."
- `.agents/knowledge/modules/users/README.md` (EN) và `.agents/docs/modules/users/README.md` (VI): đổi phần authorization; bỏ bước đổi env trong quy trình gộp và phần troubleshooting liên quan.
- `.agents/artifacts/merge-duplicate-zalo-users/walkthrough.md`: bỏ bước đổi env.

## 4. Rủi ro & rollback

- Môi trường nào đang **chỉ** dựa vào env để có admin (DB không có ai `role=admin`) sẽ mất admin. Khi đó `InitialAdminBootstrapGuard` chỉ chạy nếu DB không có admin **và** không có user nào được cấp quyền, nên có thể rơi vào trạng thái không ai là admin. Local và production của anh không đặt env, nên không bị ảnh hưởng; anh kiểm tra thêm biến env trên Coolify.
- Rollback: `git revert`, không có migration.

## 5. Kiểm thử

- `npm run build --workspace @zalobot/contracts`
- API: `tsc --noEmit`, `eslint` các file sửa, `user-merge.service.spec` (chạy bằng `tsc` + `node --test`).
- `users-sync.spec` không chạy được ở môi trường agent vì `sharp` native cho macOS; anh chạy `npm run test --workspace @zalobot/api` trên máy.
- Web: `tsc -b`, `eslint src/modules/users`.
- `node .claude/hooks/docs-drift-check.mjs`
- `grep` lại 4 tên biến trong toàn repo (trừ `.agents/artifacts`) để xác nhận không còn sót.

## 6. Câu hỏi mở

- Giữ `ownId` (tài khoản ZCA của bot) là admin như hiện tại — đồng ý không?
