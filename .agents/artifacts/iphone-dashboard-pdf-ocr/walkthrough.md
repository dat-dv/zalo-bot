# Bàn giao: iPhone, Dashboard text và phân tích ảnh thu-chi

## Đã triển khai

- Rút gọn các nhãn menu dài và thẻ xác nhận thu-chi thành các dòng ngắn, dễ quét trên iPhone. Thẻ thu-chi không còn hiển thị payload JSON dài.
- Nhận thêm các câu `cho anh link dashboard` và `link dashboard`; bot trả nút URL Dashboard mới ngay lập tức.
- Nhận ảnh zalo, chọn ảnh chất lượng cao nhất, giới hạn ảnh tối đa 10 MB và thời gian tải/xử lý 45 giây.
- Gemini đọc ảnh chỉ để phân tích. Khi nhận đủ loại giao dịch, số tiền VND và mô tả, bot tạo thẻ **Xác nhận/Hủy**; chỉ lần bấm xác nhận mới ghi sổ.
- Ảnh không phải hoá đơn, mờ hoặc thiếu dữ liệu không tạo giao dịch. Bot tóm tắt ngắn và hỏi lại thông tin thiếu.
- Ảnh và nội dung trích xuất không được lưu lâu dài hoặc ghi vào log.

## Xác minh

- `./node_modules/.bin/tsx --test apps/api/src/gemini/gemini.service.spec.ts apps/api/src/zalo/services/zalo-ui.service.spec.ts`: 5/5 đạt.
- `npm run lint`: đạt.
- `npm run typecheck`: đạt.
- `npm run build`: đạt.
- `git diff --check`: đạt.

## Cách dùng

Gửi ảnh hoá đơn/bill vào bot. Nếu bot đọc đủ dữ liệu, kiểm tra thẻ thu-chi và bấm **Xác nhận** để ghi. Nếu thiếu dữ liệu, nhắn thêm số tiền hoặc xác định đó là khoản thu hay chi.
