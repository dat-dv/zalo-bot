---
metadata:
  agent-artifact:
    id: docs-module-recurring
    type: documentation
    depends_on:
      - .agents/knowledge/modules/recurring/README.md
      - apps/api/src/finance/recurring/recurring-transaction.service.ts
      - apps/api/src/finance/recurring/recurring-transaction.controller.ts
      - apps/api/src/zca/recurring/recurring-scan.processor.ts
      - apps/api/src/zca/text/strategies/confirm-recurring-tool.strategy.ts
      - apps/web/src/modules/recurring/view/recurring-screen.tsx
---

# Module Khoản cố định

Tài liệu cho AI (tiếng Anh): [`README.md`](../../../knowledge/modules/recurring/README.md)

## Vì sao cần

Tiền nhà, điện nước, lương lặp lại đều đặn nhưng vẫn phải nhập tay, nên hay sót. Mỗi **khoản cố định** là một quy tắc, đến kỳ hệ thống tự tạo một **kỳ**. Khoản này thuộc sổ chung: ai đăng nhập cũng xem và quản lý được.

## Hai chế độ

| Chế độ | Dùng cho | Đến kỳ thì sao |
| --- | --- | --- |
| Tự ghi | Số tiền cố định (tiền nhà, lương) | Tự ghi giao dịch và báo vào kênh. Sai thì xoá hoặc sửa như giao dịch thường |
| Chờ nhập | Số tiền thay đổi (điện, nước) | Tạo kỳ chờ và báo vào kênh. Người dùng nhập số tiền hoặc bỏ qua, không hết hạn |

**Vì sao không dùng thẻ xác nhận:** thẻ hết hạn sau 5 phút, nên thẻ gửi lúc 8 giờ sáng thường hết hạn trước khi có người đọc. Kỳ được lưu trong DB nên chờ được bao lâu cũng được.

## Cách ghi một kỳ đang chờ

- Trên trang `/recurring`: nhập số tiền rồi bấm Ghi, hoặc bấm Bỏ qua.
- Trên Zalo: nhắn "đã đóng tiền điện 1tr2" hoặc "bỏ qua tiền nước tháng này". Bot hiện thẻ xác nhận như mọi thao tác khác.
- Trang Tổng quan đếm các kỳ đang chờ trong mục Cần chú ý và dẫn tới `/recurring`; ghi hoặc bỏ qua xong thì số này tự cập nhật.

## Quy tắc nghiệp vụ

- **Bắt đầu từ quá khứ**: tính từ kỳ kế tiếp, không tạo các kỳ cũ.
- **Server tắt qua ngày đến kỳ**: khi chạy lại vẫn tạo bù các kỳ bị lỡ. Khác lời nhắc, vì đây là tiền thật đã phát sinh.
- **Tạm dừng**: không tạo kỳ nào, và chạy lại cũng không tính bù các kỳ đã dừng.
- **Không ghi trùng**: mỗi quy tắc chỉ có một kỳ cho mỗi ngày đến hạn. Hai người bấm ghi cùng lúc thì chỉ một người thành công.
- **Sửa quy tắc** không đổi các kỳ đã có. **Xoá quy tắc** xoá các kỳ của nó, còn giao dịch đã ghi vẫn giữ.
- **Ghi vào sổ không cần Zalo**: bot mất kết nối thì sổ vẫn đúng, tin báo gửi sau khi kết nối lại.
- **Kênh báo** phải là kênh đang listen; để trống thì không nhắn Zalo.

## Hạn chế

- Chỉ tạo quy tắc trên dashboard, chưa tạo được từ Zalo.
- Trên form, lặp hằng tuần theo đúng thứ của kỳ đầu. Chọn nhiều thứ mới chỉ có ở API.

## Kiểm thử

Unit test ở `recurring-input.spec.ts`, `confirm-recurring-tool.strategy.spec.ts` và `recurring-form.spec.ts`. Phần khoá dòng và tạo bù cần Postgres thật nên không nằm trong unit test: khi sửa `processRule` hoặc `recordOccurrence` hãy kiểm tra lại trên một DB tạm.
