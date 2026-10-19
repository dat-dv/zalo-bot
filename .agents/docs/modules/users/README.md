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

## 2. Gộp Tài Khoản Trùng (Merge)

### Vì sao có tài khoản trùng?

Cùng một người có thể nhắn bot qua 2 kênh, và Zalo cấp **2 ID khác nhau**:

- Kênh **Zalo Bot chính thức (webhook)** cũ: ID theo app, 20 ký tự hex (vd `573462d8909179cf2080`).
- Kênh **ZCA** (tài khoản Zalo cá nhân qua `zca-js`): UID Zalo, dạng số (vd `2285509137317769272`).

`GrantAccessGuard` của ZCA tự lưu mọi ID lạ thành user "Chờ phê duyệt". Vì vậy sau khi chuyển sang ZCA, trang Users hiện 2 dòng cho cùng một người, và dữ liệu cũ (giao dịch, công nợ, Google…) vẫn nằm ở ID cũ.

### Quy trình gộp (bắt buộc làm theo thứ tự)

1. Khuyến nghị `pg_dump` database trước khi gộp lần đầu.
2. Vào trang **Người dùng**, bấm biểu tượng **Gộp vào…** trên dòng tài khoản **nguồn** (ID cũ, sẽ bị xoá).
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

## 3. Giao Diện Quản Trị Web (`apps/web/src/modules/users`)

- **Màn hình `UsersScreen` (`apps/web/src/modules/users/view/users-screen.tsx`)**:
  - Thanh công cụ tìm kiếm và bộ lọc nhanh: Tất cả, Đã cấp quyền, Chờ duyệt, Quản trị viên (Admin).
  - Nút thêm mới người dùng thủ công: Mở modal nhập Zalo User ID, tên, vai trò và trạng thái quyền truy cập ban đầu.
  - Bảng danh sách người dùng:
    - Zalo ID kèm nút copy 1-click.
    - Tên người dùng và avatar mặc định.
    - Vai trò (`Admin` / `User`) với màu sắc phân biệt.
    - Trạng thái cấp quyền: Nút gạt bật/tắt quyền truy cập (`useSetGrantAccessMutation`).
    - Nút xóa người dùng có xác nhận (`useDeleteUserMutation`).
    - Nút **Gộp vào…** mở `MergeUserDialog` (`presentation/components/merge-user-dialog.tsx`) để gộp tài khoản trùng (xem mục 2).

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
