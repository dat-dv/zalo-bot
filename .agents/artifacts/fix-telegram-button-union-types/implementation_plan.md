# Kế hoạch sửa lỗi kiểu `InlineKeyboardButton`

RequestFeedback: true

## Chẩn đoán

`reply_markup.inline_keyboard` có phần tử kiểu union `InlineKeyboardButton`. Union này gồm cả các biến thể không có `callback_data`, như `GameButton`. Vì vậy TypeScript không cho phép đọc trực tiếp thuộc tính này, dù các button do test tạo ra là callback button.

## Thay đổi dự kiến

1. Trong `apps/api/src/zalo/services/zalo-ui.service.spec.ts`, thêm helper type guard cục bộ để kiểm tra `'callback_data' in button` trước khi đọc giá trị.
2. Dùng helper đó ở các assertion đang đọc `callback_data` từ button hoặc button tìm qua `find`.
3. Không thay đổi hành vi UI, markup zalo, hay mã runtime.

## Phạm vi và rủi ro

- Chỉ thay đổi test TypeScript zalo UI.
- Rủi ro thấp; thay đổi chỉ làm việc kiểm tra type-safe hơn.

## Xác minh

1. Chạy typecheck API.
2. Chạy lint API.
3. Chạy test/spec zalo UI phù hợp nếu cấu hình dự án hỗ trợ.
