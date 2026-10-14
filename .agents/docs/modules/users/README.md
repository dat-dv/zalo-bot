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
  - Tự động gán quyền admin cho ID cấu hình trong `ZALO_ADMIN_ID`.
  - Cấm hoặc thu hồi quyền truy cập (`banUser`, `setGrantAccess`).

## 2. Giao Diện Quản Trị Web (`apps/web/src/modules/users`)

- **Màn hình `UsersScreen` (`apps/web/src/modules/users/view/users-screen.tsx`)**:
  - Thanh công cụ tìm kiếm và bộ lọc nhanh: Tất cả, Đã cấp quyền, Chờ duyệt, Quản trị viên (Admin).
  - Nút thêm mới người dùng thủ công: Mở modal nhập Zalo User ID, tên, vai trò và trạng thái quyền truy cập ban đầu.
  - Bảng danh sách người dùng:
    - Zalo ID kèm nút copy 1-click.
    - Tên người dùng và avatar mặc định.
    - Vai trò (`Admin` / `User`) với màu sắc phân biệt.
    - Trạng thái cấp quyền: Nút gạt bật/tắt quyền truy cập (`useSetGrantAccessMutation`).
    - Nút xóa người dùng có xác nhận (`useDeleteUserMutation`).

## 3. Các Endpoint API (`API_ROUTES`)

- `GET /api/users`: Lấy danh sách toàn bộ người dùng (yêu cầu quyền Admin).
- `POST /api/users`: Thêm người dùng mới.
- `PATCH /api/users/:id`: Cập nhật thông tin/vai trò người dùng.
- `DELETE /api/users/:id`: Xóa người dùng và thu hồi token liên quan.
- `POST /api/users/:id/grant-access`: Cập nhật trạng thái `grantAccess` (`granted` hoặc `denied`).

## 4. Kiểm Thử

- Chạy `npm run test --workspace @zalobot/api` để kiểm tra các service trong `users`.
- Chạy `npm run typecheck` và `npm run lint`.
