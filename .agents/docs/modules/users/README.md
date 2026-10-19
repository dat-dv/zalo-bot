---
metadata:
  agent-artifact:
    id: docs-module-users
    type: documentation
    depends_on:
      - .agents/knowledge/modules/users/README.md
---

# Module Quản Lý Người Dùng (Users Management)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/users/README.md).

Module `apps/api/src/users` và `apps/web/src/modules/users` quản lý danh sách người dùng, vai trò phân quyền (Admin / User), trạng thái cấp quyền truy cập bot (`grantAccess`), và liên kết thư mục Google Drive cá nhân.

## 1. Chức Năng Chính Backend (`apps/api/src/users`)

- **Thực thể Người dùng (`UserEntity`)**:
  - `id`: Mã Zalo ID của người dùng.
  - `firstName`: Tên hiển thị Zalo.
  - `role`: Vai trò `admin` hoặc `user` (`UserRole`).
  - `grantAccess`: Trạng thái cấp quyền (`granted` / `denied` / `pending`).
  - `driveFolderId`, `driveFolderUrl`, `driveFolderPath`: Thư mục Google Drive phân vùng cá nhân (`zalobot/u-<userId>`).
  - `createdAt`, `updatedAt`: Dấu thời gian.
- **Quản lý danh sách trắng (Whitelist) & Mời người dùng**:
  - Tạo mã mời kích hoạt 24h (`createInvite`, `consumeInvite`).
  - Admin chỉ lấy từ DB (`role = admin`): người đầu tiên chat với bot khi hệ thống chưa có admin hoặc người được cấp quyền nào (`bootstrapFirstAdmin`), hoặc người được set trên dashboard. Ngoài ra tài khoản ZCA của chính bot luôn là admin. **Không còn** cấu hình admin qua biến môi trường (`ADMIN_USER_IDS`, `ZALO_ADMIN_ID`…).
  - Cấm hoặc thu hồi quyền truy cập (`banUser`, `setGrantAccess`).

## 1a. Khi Nào Một User Được Tạo & Dọn User Giả Là Nhóm

Module Users chỉ ghi nhận **ai được tương tác với bot**. Một dòng user chỉ được tạo qua ba đường:
- `registerPendingUser`: người nhắn bot trực tiếp (L1) lần đầu, vào trạng thái chờ duyệt.
- `bootstrapFirstAdmin`: người đầu tiên khi hệ thống chưa có admin.
- Admin thêm trên dashboard.

Các quy tắc đi kèm:
- `saveDriveFolderInfo` **không còn tự tạo user**. Nếu ID chưa tồn tại, hàm ghi log cảnh báo rồi bỏ qua. Trước đây hàm này tạo user `DENIED` cho bất kỳ ID nào, nên khi bot lưu link Drive của một nhóm ZCA (ID dạng số) thì nhóm đó hiện ở trang Users như một người "Chờ phê duyệt".
- ID nhóm không bao giờ là user. `syncUsersWithZca` chỉ lấy thread `type = 'user'`, nên không còn chép tên nhóm vào `firstName`.
- Tin nhắn thụ động (L2) trong nhóm chỉ kiểm tra quyền im lặng, không ghi nhận user chờ duyệt (xem tài liệu module ZCA, mục "Ba luồng xử lý tin nhắn").

**Dọn dữ liệu đã lỡ sinh ra** — script `apps/api/scripts/cleanup-group-users.ts`:

```bash
npm run users:cleanup-groups --workspace @zalobot/api
```

- Mặc định chạy **dry-run**: in bảng các user có ID trùng với thread nhóm trong `zca_thread_configs`, cột `action` cho biết `DELETE` hay `SKIP (lý do)`.
- Script tự bỏ qua admin và mọi ID đã có dữ liệu thật (giao dịch, nơi chốn, công nợ, nhắc nhở, danh mục, token Google, token dashboard). Những dòng này anh xem tay, không tự xoá.
- Sau khi kiểm tra bảng, chạy lại với `-- --apply`. Script xoá trong một transaction (audit log ghi lại từng dòng xoá) và xoá cache Redis `whitelist:user:<id>` nếu có `REDIS_URL`.
- Cần Postgres (`DATABASE_URL` trong `.env.local`/`.env`) đang chạy.

## 2. Gộp Tài Khoản Trùng (Merge)

### Vì sao có tài khoản trùng?

Cùng một người có thể nhắn bot qua 2 kênh, và Zalo cấp **2 ID khác nhau**:

- Kênh **Zalo Bot chính thức (webhook)** cũ: ID theo app, 20 ký tự hex (vd `573462d8909179cf2080`).
- Kênh **ZCA** (tài khoản Zalo cá nhân qua `zca-js`): UID Zalo, dạng số (vd `2285509137317769272`).

`GrantAccessGuard` của ZCA tự lưu mọi ID lạ thành user "Chờ phê duyệt". Vì vậy sau khi chuyển sang ZCA, danh sách người dùng có 2 dòng cho cùng một người, và dữ liệu cũ (giao dịch, công nợ, Google…) vẫn nằm ở ID cũ.

### Quy trình gộp (bắt buộc làm theo thứ tự)

1. Khuyến nghị `pg_dump` database trước khi gộp lần đầu.
2. Vào trang **Zalo & Người dùng**, mở menu **⋯** trên dòng tài khoản **nguồn** (ID cũ, sẽ bị xoá) và chọn **Gộp tài khoản trùng**.
3. Chọn **người dùng đích** (ID sẽ được giữ lại) và kiểm tra bảng xem trước: số dòng sẽ chuyển theo từng loại dữ liệu, số chỗ trùng sẽ được hợp nhất, và kết nối Google nào được giữ.
4. Tích "Tôi hiểu thao tác này không thể hoàn tác" rồi bấm **Gộp tài khoản**.
5. Nếu vừa gộp chính tài khoản đang đăng nhập dashboard, phiên hiện tại sẽ mất quyền. Mở lại dashboard bằng link mà bot gửi qua Zalo.

### Hệ thống làm gì khi gộp

Toàn bộ chạy trong **một transaction**: lỗi ở bất kỳ bước nào thì không có gì thay đổi.

- **Nơi chốn** trùng tên (đã chuẩn hoá): giao dịch được trỏ sang nơi chốn của user đích, bản trùng của user nguồn bị xoá.
- **Người liên quan** trùng tên + biệt danh: khoản nợ và giao dịch được trỏ sang người liên quan của user đích, bản trùng bị xoá. Liên kết `linkedUserId` cũng được đổi sang user đích.
- **Danh mục** trùng tên: bản của user nguồn bị xoá. Giao dịch lưu tên danh mục nên không mất dữ liệu.
- **Giao dịch, khoản nợ, lần trả nợ, phân bổ trả nợ, lời nhắc**: chuyển sang user đích.
- **Kết nối Google**: nếu chỉ một bên có thì giữ bên đó. Nếu cả hai cùng có thì giữ token có refresh token, còn hoà thì giữ token mới hơn.
- **Hồ sơ user đích**: các trường đang trống (tên, SĐT, avatar, thư mục Drive) được lấy từ user nguồn. Giữ quyền Admin và "Đã cấp quyền" nếu một trong hai có. Ngày kết nối lấy ngày sớm hơn.
- Xoá user nguồn và ghi **một** dòng nhật ký kiểm toán mới. Nhật ký cũ giữ nguyên, không bị sửa.
- Sau khi gộp: xoá whitelist Redis của ID nguồn và làm mới cache quyền.

### Xử lý sự cố

- **Nút Gộp bị mờ, có cảnh báo vàng**: tài khoản nguồn là tài khoản ZCA của chính bot. Tài khoản này không gộp được vì luôn được tạo lại khi API khởi động.
- **Lỗi khi gộp**: không có dữ liệu nào bị đổi (transaction đã rollback). Xem log API của `UserMergeService` để biết bước bị lỗi.

## 3. Giao Diện Quản Trị Web

- **Không còn trang Người dùng riêng.** Trang `/users` và `UsersScreen` đã bị xoá. Mọi thao tác quản lý người dùng (cấp/thu hồi quyền, thêm, sửa tên/SĐT/vai trò, gộp, xoá, đồng bộ từ ZCA) nằm trên trang **Zalo & Người dùng** (`/zca`). Xem mục 2 trong tài liệu module ZCA.
- Lý do: một người Zalo vừa là cuộc trò chuyện 1-1 trên ZCA, vừa là một dòng trong `users`. Gộp lại giúp admin thấy và đổi cả **lắng nghe** lẫn **quyền tương tác** ở cùng một chỗ.
- Thư mục `apps/web/src/modules/users` chỉ còn:
  - `api/` (`users-api.ts`, `users-query.ts`): trang ZCA và dialog gộp danh bạ (`contacts`) dùng chung.
  - `presentation/components/merge-user-dialog.tsx`: dialog gộp tài khoản trùng (xem mục 2), được trang ZCA mở từ menu **⋯**.
- **Backend và bảng `users` không đổi.** `users.id` vẫn là danh tính của toàn hệ thống: giao dịch, công nợ, nhắc lịch và token Google đều tham chiếu tới nó.

## 4. Các Endpoint API (`API_ROUTES`)

- `GET /api/users`: Lấy danh sách toàn bộ người dùng (yêu cầu quyền Admin).
- `POST /api/users`: Thêm người dùng mới.
- `PATCH /api/users/:id`: Cập nhật thông tin/vai trò người dùng.
- `DELETE /api/users/:id`: Xóa người dùng và thu hồi token liên quan.
- `POST /api/users/:id/grant-access`: Cập nhật trạng thái `grantAccess` (`granted` hoặc `denied`).
- `GET /api/users/:id/merge-preview?targetUserId=`: Xem trước dữ liệu sẽ chuyển khi gộp (Admin, chỉ đọc).
- `POST /api/users/:id/merge` (`{ targetUserId }`): Gộp user `:id` vào user đích rồi xoá user `:id` (Admin).

## 5. Kiểm Thử

- Chạy `npm run test --workspace @zalobot/api` để kiểm tra các service trong `users`. Test gộp tài khoản nằm ở `apps/api/src/users/user-merge.service.spec.ts`: xem trước, chuyển dữ liệu, hợp nhất bản trùng, giữ quyền admin, chặn khi ID nguồn là env admin, và rollback khi lỗi.
- Chạy `npm run typecheck` và `npm run lint`.
