# Walkthrough: Gộp tài khoản trùng (ID webhook cũ → UID ZCA)

Plan: [`implementation_plan.md`](implementation_plan.md). Anh duyệt bằng "triển khai đi"; 3 câu hỏi mở dùng phương án mặc định: giữ Google token tốt hơn, xoá danh mục trùng của user nguồn, có nút gộp ở mọi dòng.

## 1. Thay đổi

### Contracts — `packages/contracts/src/index.ts`
- Route `API_ROUTES.usersMergePreview(id)` và `API_ROUTES.usersMerge(id)`.
- `USER_MERGE_TABLES`, `UserMergeTable`, `UserMergeGoogleTokenDecision`, `IUserMergeRequest`, `IUserMergeConflicts`, `IUserMergeSummary`, `IUserMergeResult`.
- 37 key i18n `users.merge.*`, có đủ cả vi và en.

### API — `apps/api/src/users`
- [NEW] `user-merge.types.ts`: interface `UserMergeManager` / `UserMergeUnitOfWork` / `UserMergeUsersPort` và các DI token.
- [NEW] `user-merge.service.ts`: `preview()` (chỉ đọc) và `merge()`. Gộp chạy trong một transaction, hợp nhất bản trùng của nơi chốn / người liên quan / danh mục, chọn Google token, gộp hồ sơ, ghi 1 dòng audit mới, sau đó làm mới cache và whitelist.
- [NEW] `dto/merge-user.dto.ts`: `MergeUserDto` (class-validator).
- [MODIFY] `users.controller.ts`: `GET users/:id/merge-preview` và `POST users/:id/merge`, chỉ admin.
- [MODIFY] `users.module.ts`: provider `UserMergeService`, factory `USER_MERGE_UNIT_OF_WORK` (dùng `DataSource`), `USER_MERGE_USERS_PORT` → `UsersService`.
- [MODIFY] `users.service.ts`: thêm `afterUsersMerged()`, và `isBotAccount()` (từ task `remove-env-admin-ids`).
- **Bổ sung so với plan:** API từ chối gộp khi ID nguồn là tài khoản ZCA của chính bot. Sau task [`remove-env-admin-ids`](../remove-env-admin-ids/implementation_plan.md), cơ chế admin qua env đã bị bỏ.

### Web — `apps/web/src/modules/users`
- [MODIFY] `api/users-api.ts`, `api/users-query.ts`: `getUserMergePreview`, `mergeUser`, `useUserMergePreviewQuery`, `useMergeUserMutation` (khi thành công thì invalidate mọi query).
- [NEW] `presentation/components/merge-user-dialog.tsx`: chọn user đích, xem trước (loading / error / empty / data), cảnh báo tài khoản bot, checkbox xác nhận không hoàn tác được. Toàn bộ text qua i18n.
- [MODIFY] `view/users-screen.tsx`: nút "Gộp vào…" trên từng dòng, banner kết quả, và thông báo khi vừa gộp chính tài khoản đang đăng nhập.

### Tài liệu
- `.agents/knowledge/modules/users/README.md` (EN), `.agents/docs/modules/users/README.md` (VI): luồng gộp, quy tắc xử lý xung đột, endpoint, troubleshooting.
- `CONTEXT.md`: thêm thuật ngữ "Danh tính kênh Zalo" và "Gộp tài khoản".

## 2. Kết quả kiểm thử

| Lệnh | Kết quả |
| --- | --- |
| `npm run build` (contracts) | ✅ PASS |
| `tsc --noEmit` (api) | ✅ PASS |
| `eslint` các file API đã sửa/thêm | ✅ PASS |
| `user-merge.service.spec.ts` (6 test, chạy bằng `tsc` + `node --test`) | ✅ 6/6 PASS |
| `tsc -b` (web) | ✅ PASS |
| `eslint src/modules/users` (web) | ✅ PASS |
| `node .claude/hooks/docs-drift-check.mjs` | ✅ PASS |
| `npm run test --workspace @zalobot/api` (toàn bộ) | ⚠️ Chưa chạy được ở môi trường agent: `node_modules` cài cho macOS (esbuild / sharp native). `users-sync.spec` và `users-drive-folder.spec` lỗi khi load `sharp`, không liên quan thay đổi này. Cần chạy lại trên máy anh. |
| `npm run build --workspace @zalobot/web` | ⚠️ Chưa chạy (Next SWC native cho macOS). Cần chạy trên máy anh. |

## 3. Việc anh cần làm

1. Chạy trên máy: `npm run test --workspace @zalobot/api` và `npm run build --workspace @zalobot/web`.
2. Khuyến nghị `pg_dump` trước khi gộp.
3. Trang Users → dòng `573462d8909179cf2080` → **Gộp vào…** → chọn `2285509137317769272` → kiểm tra bản xem trước → xác nhận.
4. Mở lại dashboard từ link mà bot gửi qua ZCA, kiểm tra dữ liệu cũ đã hiện.

## 4. Rủi ro còn lại

- Nơi chốn hoặc người liên quan khác nhau nhưng tên chuẩn hoá trùng nhau sẽ bị hợp nhất. Kiểm tra số "trùng lặp" trong bản xem trước trước khi xác nhận.
- `users.service.ts` có 2 lỗi Prettier từ trước (dòng ~42 và ~565, không phải dòng mình sửa); lint-staged sẽ tự format khi commit.
- Path trong Nest controller vẫn viết chuỗi `'users/...'`, giống các endpoint hiện có. Các route phía client đều dùng `API_ROUTES`.
