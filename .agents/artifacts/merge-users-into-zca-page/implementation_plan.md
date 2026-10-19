# Kế hoạch: Gộp trang Users vào trang ZCA

- Route: `implement` · Phase 1 (Planning) · Authority: `inspect-and-plan`
- Rủi ro: **MEDIUM**. Thay đổi giao diện trên nhiều file. **Không** đổi API, DB schema hay luồng phân quyền ở backend.
- Skills: frontend-orchestration, nextjs-static, tanstack-query, enterprise-ui

## 1. Mục tiêu

Chỉ còn **một trang** (`/zca`) để quản lý mọi cuộc trò chuyện Zalo. Trên dòng chat 1-1, admin vừa bật **lắng nghe** vừa **cấp/thu hồi quyền tương tác** cho người đó. Bỏ trang "Người dùng" (`/users`) khỏi giao diện.

## 2. Những gì KHÔNG đổi (quan trọng)

- **Bảng DB `users` vẫn giữ nguyên.** `users.id` là danh tính của toàn hệ thống: giao dịch, công nợ, nhắc lịch, token Google… đều tham chiếu tới nó. Ta chỉ bỏ *bảng trên giao diện*, không bỏ bảng dữ liệu.
- API `/api/users/*` giữ nguyên. Trang mới gọi lại đúng các endpoint này: `PATCH users/:id/grant-access`, `PATCH users/:id`, `POST users/:id/merge`, `DELETE users/:id`, `POST users`.
- `GrantAccessGuard` và cơ chế lắng nghe theo thread ở backend không đổi.

## 3. Hiện trạng đã khảo sát

| Hạng mục | Vị trí |
| --- | --- |
| Trang ZCA, 1194 dòng: đăng nhập QR, ô thêm ID thủ công, bảng thread, filter `all/listened/group/user` | `apps/web/src/modules/zca/view/zca-screen.tsx` |
| Trang Users, 878 dòng: bảng user, filter `pending/granted/admin`, bật/tắt quyền, sửa tên/SĐT/vai trò, gộp, xoá, thêm thủ công, đồng bộ ZCA | `apps/web/src/modules/users/view/users-screen.tsx` |
| Dialog gộp tài khoản | `apps/web/src/modules/users/presentation/components/merge-user-dialog.tsx` |
| Hooks users (cũng được `contacts/combine-contacts-dialog.tsx` dùng) | `apps/web/src/modules/users/api/users-query.ts` |
| Menu điều hướng (mục `users`, `zca`) | `apps/web/src/shared/ui/app-navigation.tsx:112-121` |
| Route và i18n (`APP_ROUTES.users`, `nav.users`, `nav.zca`) | `packages/contracts/src/index.ts` |
| Page wrapper | `apps/web/app/(private)/users/page.tsx`, `apps/web/app/(private)/zca/page.tsx` |

Khi nối hai nguồn dữ liệu: với chat 1-1, `ZcaThread.id` (UID ZCA) trùng với `IUserListItem.id`. Có những user **không** có thread ZCA tương ứng, ví dụ ID của Zalo Bot chính thức (hex 20 ký tự) hoặc thành viên nhóm chưa kết bạn. Các user này vẫn phải hiện để admin cấp quyền được.

## 4. Thiết kế bảng hợp nhất

### 4.1 Nguồn dòng (ViewModel `ChatRow`)
Hàm thuần `buildChatRows(threads, users, threadConfigs)` đặt trong `modules/zca/model/chat-rows.ts`:

| Loại dòng | Điều kiện | Lắng nghe | Quyền tương tác |
| --- | --- | --- | --- |
| 👥 Nhóm | `thread.type === 'group'` | ✅ | — (nhóm không phải user) |
| 👤 Cá nhân | thread `user`, có hoặc chưa có dòng trong `users` | ✅ | ✅ (chưa có dòng trong `users` thì hiện "Chưa cấp") |
| 🆔 Chỉ người dùng | có trong `users` nhưng không có thread ZCA | — | ✅ |

- Tên và avatar ưu tiên lấy từ thread ZCA, nếu không có thì dùng `users.firstName` / `avatarUrl`.
- Khi **chưa đăng nhập ZCA**, bảng vẫn hiện các dòng lấy từ `users`, nên admin vẫn duyệt quyền được.

### 4.2 Cột
Loại · Cuộc trò chuyện / Liên hệ · ID · **Lắng nghe** · **Quyền tương tác** (badge `Admin` / `Đã cấp` / `Chờ duyệt` kèm nút bật/tắt) · Thao tác

### 4.3 Bộ lọc
`Tất cả` · `Đang lắng nghe` · `Nhóm` · `Cá nhân` · **`Chờ duyệt`** · **`Đã cấp quyền`** · **`Admin`**. Ô tìm kiếm khớp cả ID, tên, SĐT và tên gợi nhớ (giống trang Users hiện nay).

### 4.4 Thao tác trên dòng
- Giữ nguyên các thao tác của ZCA: cấu hình thread, Drive/Photos, đồng bộ media, bật/tắt lắng nghe.
- Thêm cho dòng có user: **bật/tắt quyền** (`useSetGrantAccessMutation`). Khi user chưa tồn tại, backend `setGrantAccess` sẽ tự tạo bản ghi.
- Gom vào menu "⋯": **Sửa thông tin & vai trò**, **Gộp tài khoản** (dùng lại `MergeUserDialog`), **Xoá người dùng**. Nếu thu hồi quyền của Admin hoặc xoá thì vẫn hỏi xác nhận như hiện nay.

### 4.5 Thêm thủ công
Ô "Thêm ID thủ công" hiện có trên trang ZCA được bổ sung lựa chọn **"Cấp quyền tương tác ngay"**. Khi chọn, ngoài việc thêm thread như cũ, trang còn gọi `POST /users` với `grantAccess = GRANTED`. Form "Thêm người dùng" đầy đủ (tên, SĐT, vai trò) chuyển thành modal mở từ nút cạnh ô này.

### 4.6 Nút "Đồng bộ ZCA"
Giữ lại trên header của bảng. Nút này vẫn hữu ích cho các dòng "chỉ người dùng".

## 5. Thay đổi theo file

1. **`packages/contracts/src/index.ts`**: đổi `nav.zca` thành "Zalo & Người dùng" (vi) / "Zalo & Users" (en). Xoá `nav.users` và `APP_ROUTES.users`. Giữ toàn bộ `API_ROUTES.users*` vì backend API không đổi.
2. **`apps/web/src/modules/zca/model/chat-rows.ts`** (mới): type `ChatRow` và các hàm thuần `buildChatRows`, `filterChatRows`, `sortChatRows`, kèm unit test `chat-rows.spec.ts`.
3. **`apps/web/src/modules/zca/presentation/components/`** (mới): tách từ `zca-screen.tsx` để file không phình thêm:
   - `chat-access-table.tsx`: bảng, bộ lọc, phân trang
   - `chat-row-actions.tsx`: nút lắng nghe/quyền và menu "⋯"
   - `user-form-dialog.tsx`: modal thêm/sửa user, chuyển từ users-screen
4. **`apps/web/src/modules/zca/view/zca-screen.tsx`**: dùng thêm `useUsersQuery` và các mutation của users, thay bảng cũ bằng `ChatAccessTable`, giữ phần đăng nhập QR và các modal hiện có.
5. **`apps/web/src/modules/users/view/users-screen.tsx`**: **xoá** (cùng thư mục `users/view/`). Giữ `users/api/*` vì contacts đang dùng, và giữ `users/presentation/components/merge-user-dialog.tsx`.
6. **`apps/web/app/(private)/users/`**: **xoá hẳn cả thư mục** theo yêu cầu của anh (rev 2), không để trang chuyển hướng. `/users` sẽ trả 404 của static export. Đồng thời xoá `APP_ROUTES.users` trong `packages/contracts/src/index.ts`; hiện chỉ có `app-navigation.tsx` dùng key này.
7. **`apps/web/app/(private)/zca/page.tsx`**: cập nhật `metadata.title` / `description`.
8. **`apps/web/src/shared/ui/app-navigation.tsx`**: bỏ mục `users`, bỏ `'users'` khỏi union type nếu không còn dùng.

## 6. Tài liệu (Hard Completion Gate)

- `.agents/knowledge/modules/zca/README.md` (EN): trang hợp nhất, bảng `ChatRow`, quy tắc join `thread.id = users.id`, các dòng chỉ có user.
- `.agents/knowledge/modules/users/README.md` (EN): Users UI đã gộp vào `/zca`, trang `/users` đã bị xoá, API không đổi.
- `.agents/docs/modules/zca/README.md` và `.agents/docs/modules/users/README.md` (VI): giải thích vì sao gộp, hai lớp kiểm soát (lắng nghe thread và quyền user), cách duyệt người mới.
- `.agents/docs/README.md`: cập nhật mục mapping nếu có nhắc tới trang Users.
- Chạy `node .claude/hooks/docs-drift-check.mjs`, phải exit 0.

## 7. Kiểm tra

- `npm run typecheck --workspace @zalobot/web` và `--workspace @zalobot/contracts`
- `npm run lint --workspace @zalobot/web`
- `npm run test --workspace @zalobot/web` (bao gồm `chat-rows.spec.ts` mới)
- `npm run build --workspace @zalobot/web` để chắc static export không lỗi
- Kiểm tra trên trình duyệt (`npm run dev`):
  - Menu không còn mục "Người dùng"; không còn chỗ nào trỏ tới `/users`
  - Bật/tắt quyền trên dòng cá nhân
  - Dòng "chỉ người dùng" vẫn hiện khi chưa đăng nhập ZCA
  - Bố cục ở bề rộng mobile

## 8. Câu hỏi mở cho anh

1. **Tên menu/trang**: đề xuất "Zalo & Người dùng". Anh muốn tên khác không?
2. **Dòng "chỉ người dùng"** (ID webhook, thành viên nhóm chưa kết bạn): hiện chung trong bảng như kế hoạch, hay tách ra tab riêng "Người dùng ngoài ZCA"?
3. **Bật lắng nghe một chat 1-1 thì có tự động cấp quyền luôn không?** Kế hoạch hiện tại để **độc lập** (hai nút riêng) cho an toàn. Nếu anh muốn bật một nút là xong cả hai thì em sẽ đưa vào kế hoạch.
