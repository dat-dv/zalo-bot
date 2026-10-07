# Chẩn đoán nút thao tác công nợ theo chiều khoản nợ

## Hiện tượng

Với khoản phải thu `Trí đang nợ anh`, zalo hiển thị các nút `💵 Trả nợ` và `🗑️ Xóa khoản này`. Nhãn `Trả nợ` khiến người dùng hiểu nhầm chủ tài khoản là người đi trả tiền. Không có thao tác `Đóng khoản`.

## Kết quả tái hiện bằng mã nguồn

Lệnh `/debts` biểu diễn đúng chiều khoản nợ: `receivable` thành `Trí đang nợ anh` và `payable` thành `anh đang nợ Trí`. Tuy nhiên, ngay sau đó mọi bản ghi đều gọi `buildDebtActionsMarkup(debt.id)` mà không truyền `direction`.

`buildDebtActionsMarkup` luôn tạo cố định hai callback `debt:pay:<id>` và `debt:delete:<id>`. Callback `debt:pay` cũng luôn nhắc câu “Trí trả anh 200k”, bất kể chiều nợ. Vì vậy UI và hướng dẫn không thể phân biệt khoản phải thu với khoản phải trả. Chưa có callback/handler `debt:close` hay API dịch vụ để đóng khoản trực tiếp.

## Phạm vi ảnh hưởng

- `apps/api/src/zalo/zalo.update.ts`: hiển thị danh sách và xử lý callback.
- `apps/api/src/zalo/services/zalo-ui.service.ts`: tạo bàn phím nút bấm.
- `apps/api/src/finance/finance.service.ts`: hiện chỉ tất toán khi ghi nhận thanh toán làm số còn lại về 0.
- `apps/web/src/app.tsx`: chỉ hiển thị bảng; không có các nút tương ứng.

## Đề xuất tối thiểu

1. Truyền `direction` vào builder bàn phím và đặt nhãn theo ngữ cảnh:
   - `receivable`: `💵 Ghi nhận đã thu`.
   - `payable`: `💵 Trả nợ`.
2. Không hiển thị nút xóa thường trực; thay bằng `✅ Đóng khoản` có xác nhận. Cần chốt nghĩa nghiệp vụ của “đóng”: chỉ cho phép khi còn lại bằng 0, hay cho phép đóng/ghi xóa phần còn lại.
3. Giữ `Xóa` như một thao tác phụ có xác nhận chặt hơn, chỉ dùng khi nhập nhầm, hoặc bỏ hẳn khỏi UI.
4. Thêm kiểm thử cho hai chiều `receivable`/`payable` để tránh gắn lại nút chung.

## Trạng thái

Nguyên nhân gốc đã được xác nhận tĩnh từ đường đi hiển thị. Chưa có kiểm thử tự động cho luồng zalo này, nên chưa có vòng lặp tái hiện runtime độc lập.
