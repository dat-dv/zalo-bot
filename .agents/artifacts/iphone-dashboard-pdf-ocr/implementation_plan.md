---
RequestFeedback: true
---

# Kế hoạch: tối ưu iPhone, link Dashboard từ text và phân tích ảnh thu-chi

## Mục tiêu

1. Nội dung và nút zalo dễ đọc trên iPhone, tránh các nhãn/đoạn dài bị tự xuống hàng khó theo dõi.
2. Khi người dùng nhắn `dashboard` (và các biến thể thông dụng), bot trả ngay nút link Dashboard một lần bấm.
3. Khi người dùng gửi ảnh hoá đơn/sao kê hoặc ảnh chụp màn hình, bot đọc nội dung bằng AI, đề xuất khoản thu-chi và **chỉ ghi sổ sau khi người dùng bấm Xác nhận**.

## Hiện trạng đã xác minh

- `zaloUpdate` đã có `/dashboard` và nhận một số câu text Dashboard; cần chuẩn hoá thêm phản hồi/biến thể và kiểm thử.
- Công cụ `create_finance_transaction` đã nằm trong danh sách thao tác cần xác nhận; đây là lớp bảo vệ sẽ được tái sử dụng cho phân tích ảnh.
- Chưa có handler zalo cho `photo` và chưa có dịch vụ phân tích ảnh hoá đơn/sao kê.
- Có thay đổi chưa bàn giao ở Gemini/Dashboard trong worktree. Phần triển khai mới sẽ không xoá, hoàn tác, hay ghi đè chúng.

## Thiết kế triển khai

### 1. Giao diện zalo trên iPhone

- Tạo các mẫu nội dung gọn cho `/start`, `/help`, Dashboard và thẻ xác nhận: mỗi ý ngắn trên một dòng, không dùng các câu hướng dẫn dài xen giữa danh sách.
- Rút gọn các nhãn inline button có nguy cơ wrap trên màn hình hẹp; vẫn giữ ý nghĩa và emoji nhất quán.
- Giữ menu `/start` và `/help` lấy từ cùng một builder. Bổ sung kiểm thử cấu trúc menu và giới hạn nhãn theo chuẩn mobile đã thống nhất.

### 2. Mở Dashboard từ tin nhắn

- Chuẩn hoá nhận diện text không phân biệt hoa/thường và khoảng trắng: `dashboard`, `mở dashboard`, `xem dashboard`, `cho anh link dashboard`.
- Luôn trả một inline URL button mới qua luồng cấp exchange token hiện có; không ghi token vào log hay trả token dạng text.
- Giữ command `/dashboard` và callback cũ cho các tin nhắn đã phát hành trước đó.

### 3. Phân tích ảnh và đề xuất thu-chi

- Thêm `ReceiptImageAnalysisService` trong zalo: nhận ảnh `photo`, chọn bản có độ phân giải cao nhất, kiểm tra dung lượng và thời gian tải trước khi lấy file từ zalo.
- Gửi ảnh như dữ liệu đa phương thức tới Gemini với yêu cầu trích xuất có cấu trúc: loại giao dịch, số tiền VND, ngày, danh mục, ghi chú, độ tin cậy và các trường còn thiếu. Lệnh phân tích ảnh này không được gọi tool hoặc thay đổi dữ liệu.
- Với kết quả đủ số tiền và loại giao dịch, chuyển bản trích xuất thành yêu cầu thu-chi cho `GeminiService`. `create_finance_transaction` sẽ tự đi vào hàng chờ hiện có và hiển thị nút **Xác nhận/Hủy**.
- Nếu không đủ dữ liệu, không suy đoán; trả phần đã đọc ngắn và hỏi đúng trường còn thiếu. Nếu ảnh không phải hoá đơn/sao kê, chỉ gửi phần tóm tắt/trích xuất, không đề xuất ghi sổ.
- Không lưu ảnh hoặc nội dung đã trích xuất lâu dài; dữ liệu chỉ tồn tại trong bộ nhớ đủ cho lượt xử lý/xác nhận. Không đưa ảnh hay URL zalo vào log.

### 4. Cấu hình, kiểm thử và tài liệu

- Thêm cấu hình giới hạn ảnh (byte, timeout) có giá trị mặc định an toàn.
- Viết test cho: chặn ảnh quá dung lượng; ảnh thiếu trường không tạo giao dịch; ảnh hoá đơn hợp lệ tạo đúng payload chờ xác nhận; text Dashboard trả URL button; cấu trúc menu/mobile labels.
- Cập nhật `apps/api` module, tài liệu canonical tiếng Anh và hướng dẫn tiếng Việt về: quyền riêng tư dữ liệu ảnh, giới hạn file, luồng `received → analysis → proposal → confirmation → recorded/cancelled`, và cách xử lý lỗi.

## Rủi ro và cách giảm thiểu

| Rủi ro                         | Giảm thiểu                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| AI đọc sai số tiền/ngày        | Hiển thị payload rõ ràng và bắt buộc xác nhận; thiếu dữ liệu thì hỏi lại, không tự ghi.      |
| Ảnh quá lớn hoặc quá mờ        | Chặn dung lượng trước khi tải; nếu không đọc được, yêu cầu gửi ảnh rõ hơn.                   |
| Ảnh nhạy cảm                   | Không lưu trữ vĩnh viễn, không log nội dung/file URL, chỉ gửi Gemini để xử lý lượt hiện tại. |
| Link Dashboard một lần hết hạn | Tạo link mới cho từng yêu cầu text/command; link cũ không tái sử dụng.                       |

## Tiêu chí nghiệm thu

1. Trên iPhone, menu và hướng dẫn mới dễ quét: nhãn nút không bị wrap bất thường, nội dung dài được tách thành dòng ngắn.
2. Nhắn `dashboard` hoặc `cho anh link dashboard` nhận được nút **Mở Dashboard** có URL trực tiếp.
3. Gửi ảnh hoá đơn hợp lệ nhận được đề xuất thu-chi và chỉ có bản ghi mới sau lần bấm **Xác nhận**.
4. Ảnh mờ/thiếu số tiền/chưa rõ thu hay chi không tạo giao dịch và hỏi lại đúng thông tin thiếu.
5. Lint, typecheck, build và toàn bộ test liên quan đều đạt.
