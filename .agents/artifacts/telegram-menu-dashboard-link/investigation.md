# Chẩn đoán menu zalo và liên kết Dashboard

## Hiện tượng

- Menu hiển thị khi `/start` và `/help` tạo cảm giác không đồng nhất.
- Bấm **📊 Xem báo cáo** không mở Dashboard ngay.

## Bằng chứng

1. `/start` và `/help` cùng gọi `zaloUiService.buildMainMenuInlineMarkup(...)` tại `apps/api/src/zalo/zalo.update.ts` (lần lượt khoảng dòng 173 và 197). Hai luồng không tự duy trì hai danh sách nút riêng.
2. Hàm dựng menu tạo nút **📊 Xem báo cáo** bằng `Markup.button.callback(..., 'action:view_reports')` tại `apps/api/src/zalo/services/zalo-ui.service.ts:58`, dù đã nhận được `reportsUrl`.
3. Callback `action:view_reports` chỉ phản hồi bằng một tin nhắn mới chứa nút URL tại `apps/api/src/zalo/zalo.update.ts:787-798`. Vì vậy thao tác hiện cần hai lần bấm, không phải một liên kết Dashboard trực tiếp.
4. Khi một phản hồi không kèm inline markup, `sendSafeReply` chỉ gửi lệnh xoá reply keyboard. Menu cũ do zalo/BotFather hoặc tin nhắn trước đó vẫn có thể còn hiển thị, khiến người dùng thấy nó khác với inline menu nằm dưới `/help`.

## Kết luận

Nguyên nhân liên kết Dashboard: xác nhận với độ tin cậy cao. Nút được tạo sai kiểu (`callback` thay vì URL), dù URL đã có sẵn.

Nguyên nhân menu “lệch”: mã dùng cùng một menu cho `/start` và `/help`; khác biệt nhìn thấy đến từ phần nội dung riêng của mỗi lệnh và/hoặc reply keyboard cũ còn lưu ở zalo. Cần chuẩn hoá một quy tắc hiển thị menu: chỉ dùng inline menu gắn dưới thông điệp, đồng thời xoá reply keyboard cũ khi phát menu.

## Đề xuất khắc phục tối thiểu

1. Đổi **📊 Xem báo cáo** thành `Markup.button.url('📊 Xem báo cáo', reportsUrl)` trong hàm menu chung, để mở ngay với một lần bấm.
2. Loại bỏ callback `action:view_reports` không còn được gọi, hoặc giữ lại chỉ để tương thích với các tin nhắn cũ đã gửi.
3. Chuẩn hoá `/start` và `/help` theo cùng một mẫu: mỗi lệnh có thể có nội dung khác nhau, nhưng dùng cùng inline menu và xoá reply keyboard cũ khi gửi.
4. Thêm kiểm thử đơn vị cho cấu trúc `reply_markup`: `/start` và `/help` có cùng danh sách nút theo cùng trạng thái người dùng; nút Dashboard phải có trường `url`, không có `callback_data`.

## Xác minh đã chạy

- `npm run agent-system:validate`: đạt (67 artifacts, 119 dependencies, 52 pairs, 1 imports, 0 cyclic groups).
- Đã rà soát toàn bộ các nơi tạo keyboard, handler `action:view_reports`, và luồng cấp exchange token. Dự án hiện không có bộ test zalo để chạy một kiểm thử tái hiện độc lập.
