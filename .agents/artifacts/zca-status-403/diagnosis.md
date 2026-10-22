# Chẩn đoán: `GET /api/zca/status` trả 403

Ngày: 2026-10-22 · Route: investigate · Authority: propose-only

## Hiện tượng

- Anh mở `https://zalobot.datintech.site/zca`, request `GET /api/zca/status` trả về 403.
- Kỳ vọng: trang hiện trạng thái kết nối ZCA.

## Bằng chứng

1. Trong code, mọi route `/api/zca/*` đều gọi `requireDashboardAdmin` (`apps/api/src/zca/zca.controller.ts:79`, `:460`).
2. `requireDashboardAdmin` → `assertDashboardAdmin` (`apps/api/src/dashboard-auth/dashboard-user.ts:37`):
   - Thiếu token hoặc token sai → **401**.
   - Token hợp lệ nhưng `usersService.isAdmin(userId)` = false → **403** (`ForbiddenException`).
3. `isAdmin` trả true khi user có `role = ADMIN` trong DB, hoặc chính là UID Zalo của acc bot (`apps/api/src/users/users.service.ts:213`).
4. Chạy lại trên production bằng phiên admin trong browser pane: `/api/zca/status`, `/api/users`, `/api/zca/threads`… đều trả **200**. API vẫn chạy bình thường.
5. Danh sách user trên `/zca` hiện có **1 admin**: "Bot Finance Assistance" (`…cf2080`, ID 20 ký tự hex của webhook Zalo Bot cũ). "Văn Đạt" (`…516056`, UID Zalo cá nhân qua ZCA) chỉ ở trạng thái "Đã cấp", không phải admin.

## Nguyên nhân gốc (độ tin cậy: cao)

Không phải lỗi API. Phiên dashboard trên trình duyệt của anh đang đăng nhập bằng **một user không phải admin**. Nhiều khả năng đó là "Văn Đạt" (`…516056`), vào qua link đăng nhập bot gửi trong Zalo. Quyền admin cũ của anh nằm ở ID webhook cũ `…cf2080`; khi chuyển sang ZCA, Zalo cấp cho anh một ID mới và ID mới này chưa được nâng lên admin.

Chưa xác nhận: em chưa đọc được phiên trên trình duyệt của anh đang là user nào.

Yếu tố làm khó hiểu thêm: trang `/zca` không xử lý lỗi 403 của `useZcaStatusQuery` (`apps/web/src/modules/zca/view/zca-screen.tsx:113`). User thường vẫn thấy menu và vào được trang, nhưng không có thông báo "chỉ admin". Lỗi chỉ hiện trong DevTools.

## Đề xuất

A. Vận hành (không sửa code), chọn một cách:
   - Đăng nhập dashboard bằng `DASHBOARD_LOGIN_CODE` (user `dashboard-owner`, luôn là admin).
   - Hoặc dùng phiên admin, mở `/zca`, gộp `…cf2080` vào `…516056` (User Merge chuyển cả quyền ADMIN: `user-merge.service.ts:208`), hoặc sửa role của "Văn Đạt" thành Admin.

B. Sửa code (cần plan riêng): khi `/api/zca/status` trả 403, trang `/zca` hiện thông báo "Trang này chỉ dành cho admin" và không gọi các query admin khác. Có thể cân nhắc ẩn mục menu với user không phải admin.
