---
metadata:
  agent-artifact:
    id: docs-module-contacts
    type: documentation
    depends_on:
      - .agents/knowledge/modules/contacts/README.md
      - apps/web/src/modules/contacts/api/contacts-api.ts
      - apps/web/src/modules/contacts/api/contacts-query.ts
      - apps/web/src/modules/contacts/presentation/components/contacts-screen.tsx
      - apps/web/src/modules/contacts/presentation/components/combine-contacts-dialog.tsx
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/finance/finance.service.ts
---

# Module danh bạ công nợ (contacts)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/contacts/README.md).

## Vai trò nghiệp vụ

**Danh bạ công nợ** là tập "người liên quan" riêng của mỗi người dùng — những người cho mượn, đi vay hoặc gắn với giao dịch. Trang `/contacts` giúp người dùng xem, sửa thông tin (số điện thoại, tài khoản ngân hàng...) và **gộp** các bản ghi trùng (ví dụ bot tạo "Trí" và "Trí Đen" cho cùng một người). Nơi chốn (quán, cửa hàng) **không** thuộc module này; chúng được quản lý ở `/places` trong module dashboard.

## API và cache

- `GET /api/contacts` (`ReportsController`): chỉ trả liên hệ của người đang đăng nhập, sắp theo tên A→Z rồi ngày tạo mới nhất, tối đa 200 dòng. Mỗi liên hệ có: tên, biệt danh, mô tả (`descriptor`), số điện thoại, số tài khoản, mã/tên ngân hàng, avatar, `linkedUserId` và `linkedUser` (tài khoản Zalo được liên kết), `debtCount`, `transactionCount`, thời điểm tạo/cập nhật.
- `PATCH /api/contacts/:id`: sửa thông tin. `POST /api/contacts/combine`: gộp. `DELETE /api/contacts/:id`: xoá (có hook `useDeleteContactMutation` nhưng giao diện hiện **không** có nút xoá).
- Sau khi sửa/xoá: làm mới cache `contacts`, `debts`, `dashboard`. Sau khi gộp: thêm cả `transactions` và `expenses` vì giao dịch cũng được chuyển chủ.

## Màn hình danh bạ

- Tiêu đề trang, nút Làm mới/Đăng xuất do `WorkspaceHeader` của layout chung hiển thị; `ContactsScreen` chỉ render bảng.
- Các cột: chọn (checkbox), Tên (không ẩn được), Biệt danh, Mô tả, Số điện thoại, Số tài khoản, Ngân hàng, Tài khoản liên kết (badge `Tên (@username)` hoặc `#<mã>`), Tài nguyên (số khoản nợ / số giao dịch), Ngày tạo, Thao tác (rộng tối thiểu 120px, chỉ có nút Sửa).
- Dữ liệu hiển thị dạng chữ thường, **không** có link gọi điện hay Google Maps.
- Sửa trực tiếp: nhấp đúp ô hoặc bấm Sửa để sửa Tên (bắt buộc), Biệt danh, Mô tả, Số điện thoại, Số tài khoản, Tên ngân hàng; `Enter` lưu, `Escape` huỷ.
  - Hạn chế đã biết: để trống biệt danh/mô tả sẽ xoá giá trị cũ, nhưng để trống số điện thoại/ngân hàng thì backend **giữ nguyên** giá trị cũ (client gửi `undefined`), nên hiện không xoá được các trường này từ giao diện.
- Thanh công cụ: nút Gộp (khi chọn từ 2 dòng), chọn/bỏ chọn tất cả, chip số dòng đã chọn, ô tìm kiếm theo tên/biệt danh/mô tả.
- Trạng thái: đang tải, rỗng, lỗi kèm nút Thử lại, toast sau khi lưu/gộp.

## Gộp liên hệ

- Dialog tự xếp hạng ứng viên làm **liên hệ chính**: ưu tiên liên hệ đã liên kết tài khoản Zalo → nhiều khoản nợ + giao dịch nhất → tạo sớm nhất. Người dùng có thể chọn liên hệ chính khác.
- Điền sẵn tên/biệt danh từ liên hệ chính, mô tả ghép từ mô tả của tất cả liên hệ được chọn, tài khoản liên kết lấy từ liên hệ chính hoặc bất kỳ liên hệ nào có.
- Ô chọn tài khoản liên kết lấy danh sách từ `GET /api/users` — API chỉ dành cho admin, nên người dùng thường chỉ thấy lựa chọn "chưa đặt".
- Ô "Gom nợ" (`consolidateDebts`) bật sẵn: sau khi gộp, các khoản nợ gốc cùng chiều và cùng loại tiền của liên hệ chính được gom thành một khoản nợ cha.
- Phía backend, thứ tự xử lý: cập nhật liên hệ chính (kế thừa số điện thoại, ngân hàng, avatar còn thiếu từ liên hệ nguồn) → chuyển nợ và giao dịch của liên hệ nguồn sang → xoá liên hệ nguồn → gom nợ nếu được chọn.
- **Lưu ý quan trọng**: thao tác gộp liên hệ **không** chạy trong một database transaction duy nhất. Nếu lỗi giữa chừng (ví dụ khi gom nợ), các bước trước đó đã được lưu. Mỗi lần gom nợ (`combineDebts`) thì có transaction riêng.

## Kiểm thử

`npm run typecheck`, `npm run lint`, `npm run build` (scope `--workspace @zalobot/web`).
