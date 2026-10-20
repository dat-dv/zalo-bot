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
      - apps/api/src/finance/finance.controller.ts
      - apps/api/src/finance/finance-contact-link.spec.ts
      - apps/api/src/database/entities/debt-contact.entity.ts
---

# Module danh bạ công nợ (contacts)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/contacts/README.md).

## Vai trò nghiệp vụ

**Danh bạ công nợ** là tập "người liên quan" riêng của mỗi người dùng — những người cho mượn, đi vay hoặc gắn với giao dịch. Trang `/contacts` giúp người dùng xem, sửa thông tin (số điện thoại, tài khoản ngân hàng...) và **gộp** các bản ghi trùng (ví dụ bot tạo "Trí" và "Trí Đen" cho cùng một người). Nơi chốn (quán, cửa hàng) **không** thuộc module này; chúng được quản lý ở `/places` trong module dashboard.

## API và cache

- `GET /api/contacts` (`ReportsController`): chỉ trả liên hệ của người đang đăng nhập, sắp theo tên A→Z rồi ngày tạo mới nhất, tối đa 200 dòng. Mỗi liên hệ có: tên, biệt danh, mô tả (`descriptor`), số điện thoại, số tài khoản, mã/tên ngân hàng, avatar, `linkedUserId` và `linkedUser` (tài khoản Zalo được liên kết), `debtCount`, `transactionCount`, thời điểm tạo/cập nhật.
- `PATCH /api/contacts/:id`: sửa thông tin. `POST /api/contacts/combine`: gộp. `DELETE /api/contacts/:id`: xoá (có hook `useDeleteContactMutation` nhưng giao diện hiện **không** có nút xoá).
- Sau khi sửa/xoá: làm mới cache `contacts`, `users`, `debts`, `dashboard`. Sau khi gộp: thêm cả `transactions` và `expenses` vì giao dịch cũng được chuyển chủ. `users` được làm mới để số "🔗 N người liên quan" trên trang ZCA luôn đúng.

## Màn hình danh bạ

- Tiêu đề trang, nút Làm mới/Đăng xuất do `WorkspaceHeader` của layout chung hiển thị; `ContactsScreen` chỉ render bảng.
- Các cột: chọn (checkbox), Tên (không ẩn được), Biệt danh, Mô tả, Số điện thoại, Số tài khoản, Ngân hàng, Tài khoản liên kết (badge `Tên (@username)` hoặc `#<mã>`), Tài nguyên (số khoản nợ / số giao dịch), Ngày tạo, Thao tác (rộng tối thiểu 120px, chỉ có nút Sửa).
- Dữ liệu hiển thị dạng chữ thường, **không** có link gọi điện hay Google Maps.
- Sửa trực tiếp: nhấp đúp ô hoặc bấm Sửa để sửa Tên (bắt buộc), Biệt danh, Mô tả, Số điện thoại, Số tài khoản, Tên ngân hàng; `Enter` lưu, `Escape` huỷ. Admin còn thấy ô chọn **Tài khoản User** ở cột liên kết (có lựa chọn "Không liên kết"); xem mục "Liên kết với tài khoản User".
  - Hạn chế đã biết: để trống biệt danh/mô tả sẽ xoá giá trị cũ, nhưng để trống số điện thoại/ngân hàng thì backend **giữ nguyên** giá trị cũ (client gửi `undefined`), nên hiện không xoá được các trường này từ giao diện.
- Thanh công cụ: nút Gộp (khi chọn từ 2 dòng), chọn/bỏ chọn tất cả, chip số dòng đã chọn, ô tìm kiếm theo tên/biệt danh/mô tả.
- Trạng thái: đang tải, rỗng, lỗi kèm nút Thử lại, toast sau khi lưu/gộp.

## Liên kết với tài khoản User

**Vì sao cần**: Người liên quan chỉ là một cái tên trong danh bạ công nợ của một người dùng. Liên kết cho biết "anh Trí trong sổ nợ của tôi chính là tài khoản Zalo X trong hệ thống" (`users.id`). Trang **Zalo & Người dùng** dùng liên kết này để hiện chiều ngược lại: một tài khoản đang được gắn trong danh bạ của những ai.

Quy tắc nghiệp vụ:

- **Chỉ admin được gắn hoặc bỏ gắn.** Muốn chọn user phải xem được toàn bộ danh sách user, mà danh sách này chỉ admin được xem. Nếu người dùng thường gửi `linkedUserId` (kể cả `null`), API trả **403**. Không gửi trường này thì liên kết giữ nguyên.
- **Trong một danh bạ, mỗi tài khoản chỉ gắn với tối đa một Người liên quan.** Nếu trùng, API trả **409** kèm tên liên hệ đang giữ liên kết. Khi đó hãy dùng **Gộp liên hệ**, vì hai bản ghi này thực chất là cùng một người. Danh bạ của những người khác nhau vẫn có thể cùng gắn tới một tài khoản.
- Không được gắn Người liên quan với chính chủ danh bạ, và tài khoản được gắn phải tồn tại. Vi phạm một trong hai điều này thì API trả **400**.
- Bỏ liên kết: chọn "Không liên kết" rồi lưu, web sẽ gửi `linkedUserId: null`. Trước đây thao tác này không có tác dụng vì TypeORM lưu theo relation cũ đã nạp sẵn. Giờ backend gán cả cột lẫn relation.
- Bot **không** tự liên kết khi ghi nợ; liên kết chỉ được tạo trên web.
- Kiểm thử: `apps/api/src/finance/finance-contact-link.spec.ts`.

## Gộp liên hệ

- Dialog tự xếp hạng ứng viên làm **liên hệ chính**: ưu tiên liên hệ đã liên kết tài khoản Zalo → nhiều khoản nợ + giao dịch nhất → tạo sớm nhất. Người dùng có thể chọn liên hệ chính khác.
- Điền sẵn tên/biệt danh từ liên hệ chính, mô tả ghép từ mô tả của tất cả liên hệ được chọn, tài khoản liên kết lấy từ liên hệ chính hoặc bất kỳ liên hệ nào có.
- Ô chọn tài khoản liên kết chỉ hiện với admin (danh sách lấy từ `GET /api/users`, API chỉ dành cho admin). Người dùng thường không thấy ô này; khi gộp, backend tự kế thừa liên kết từ liên hệ nguồn nếu liên hệ chính chưa có.
- Ô "Gom nợ" (`consolidateDebts`) bật sẵn: sau khi gộp, các khoản nợ gốc cùng chiều và cùng loại tiền của liên hệ chính được gom thành một khoản nợ cha.
- Phía backend, thứ tự xử lý: cập nhật liên hệ chính (kế thừa số điện thoại, ngân hàng, avatar còn thiếu từ liên hệ nguồn) → chuyển nợ và giao dịch của liên hệ nguồn sang → xoá liên hệ nguồn → gom nợ nếu được chọn.
- **Lưu ý quan trọng**: thao tác gộp liên hệ **không** chạy trong một database transaction duy nhất. Nếu lỗi giữa chừng (ví dụ khi gom nợ), các bước trước đó đã được lưu. Mỗi lần gom nợ (`combineDebts`) thì có transaction riêng.

- Dialog dùng khung `Modal` dùng chung: trên mobile là bottom-sheet, tiêu đề và nút hành động luôn nằm trên bàn phím ảo. Chi tiết xem [web-ui-direction](../../global/web-ui-direction.md#modal-trên-mobile--bàn-phím-ảo).

## Kiểm thử

`npm run typecheck`, `npm run lint`, `npm run build` (scope `--workspace @zalobot/web`).
