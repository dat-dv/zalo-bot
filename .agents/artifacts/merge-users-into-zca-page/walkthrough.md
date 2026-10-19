# Walkthrough: Gộp trang Users vào trang ZCA

Thực hiện theo `implementation_plan.md` (rev 2, đã duyệt). Ba câu hỏi mở đều làm theo mặc định: tên "Zalo & Người dùng"; dòng 🆔 hiện chung trong bảng; lắng nghe và quyền tương tác độc lập.

## Đã thay đổi

- **Mới**
  - `apps/web/src/modules/zca/model/chat-rows.ts`: ghép thread và user, cùng filter/sort/search. Có test ở `chat-rows.spec.ts` (5 case).
  - `apps/web/src/modules/zca/presentation/components/`: `chat-table-row.tsx`, `chat-row-menu.tsx` (menu "⋯" dùng `position: fixed` để không bị bảng cắt), `user-form-dialog.tsx` (thêm/sửa), `zca-icons.tsx` (tách các icon ra khỏi zca-screen).
- **Sửa**
  - `zca-screen.tsx`: bảng hợp nhất, 7 bộ lọc, sort `pending_first`, thẻ "Quyền tương tác", nút "Đồng bộ thông tin" và "+ Thêm người dùng". File giảm từ 1194 xuống 918 dòng.
  - `app-navigation.tsx`: bỏ mục `users` và icon `users`.
  - `packages/contracts`: bỏ `APP_ROUTES.users` và `nav.users`; `nav.zca` đổi thành "Zalo & Người dùng" / "Zalo & Users".
  - Metadata của `zca/page.tsx`.
- **Xoá**: `apps/web/app/(private)/users/`, `apps/web/src/modules/users/view/users-screen.tsx`.
- **Không đổi**: backend, bảng `users`, `API_ROUTES.users*`, `users/api/*`, `MergeUserDialog`.

## Lệch nhỏ so với plan

- Ô "Thêm ID thủ công" **không** có checkbox "Cấp quyền ngay". Ô này nhận cả ID nhóm, nên nếu cấp quyền từ đây có thể biến ID nhóm thành user (lỗi đã sửa ở commit 7e7ac7f). Việc thêm người kèm cấp quyền đi qua nút "+ Thêm người dùng".
- Nút Bật/Tắt lắng nghe riêng được thay bằng nhãn "Đang lắng nghe / Bỏ qua" bấm được. Nút Photos ở cột thao tác bỏ đi; link Photos vẫn nằm trong badge cấu hình.

## Kiểm tra

- `typecheck` contracts và web: PASS. Trước đó phải xoá cache sinh tự động `apps/web/.next/dev/types`, vì nó còn trỏ tới trang `/users` đã xoá.
- `build` web: PASS (static export, không còn route `/users`).
- `test` web: 20/20 PASS.
- `lint` web: 1 lỗi **có sẵn từ trước** ở `zca-query.ts:25` (`SyncThreadMediaResponse` không dùng). File này không thuộc phạm vi task nên không sửa.
- `docs-drift-check`: PASS. Bản `--all` còn 1 lỗi có sẵn về module `finance`, không liên quan.
- **Chưa kiểm tra trên trình duyệt**: chạy API local sẽ kết nối DB và phiên ZCA thật, và dashboard cần đăng nhập admin qua Zalo.
