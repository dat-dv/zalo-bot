---
RequestFeedback: true
---

# Kế hoạch: Tesseract OCR cục bộ trước Gemini cho ảnh thu-chi

## Mục tiêu bắt buộc

Thay hoàn toàn Gemini Vision/OCR bằng luồng sau:

```
Ảnh zalo → Tesseract OCR chạy cục bộ → text OCR đã làm sạch → Gemini phân tích thu/chi → Xác nhận/Hủy → ghi sổ
```

Gemini **không được nhận ảnh**, base64 ảnh, URL zalo, hoặc dữ liệu nhị phân ảnh.

## Hiện trạng đã xác minh

- `tesseract.js` chưa được khai báo trong dependencies và không có binary `tesseract` trong môi trường hiện tại.
- `ReceiptImageAnalysisService` đang tải ảnh rồi gửi trực tiếp binary ảnh vào `GeminiService.analyzeReceiptImage`; đây là phần sẽ bị thay thế.
- Cơ chế xác nhận `create_finance_transaction` đã có sẵn và được giữ nguyên.

## Thay đổi triển khai

1. Cài `tesseract.js` vào `@zalobot/api` và lockfile.
2. Đóng gói dữ liệu ngôn ngữ Tesseract `vie` và `eng` trong Docker image tại đường dẫn nội bộ, để OCR chạy không cần tải model lúc runtime và không gửi ảnh ra ngoài.
3. Đổi `ReceiptImageAnalysisService` thành owner của toàn bộ xử lý ảnh:
   - Chọn ảnh zalo có độ phân giải cao nhất, kiểm tra byte/timeout.
   - Dùng Tesseract worker cục bộ với `vie+eng` để trích text.
   - Chuẩn hoá text, giới hạn chiều dài, loại phần rỗng và không log nội dung ảnh/text đầy đủ.
4. Thay `GeminiService.analyzeReceiptImage(image, mimeType)` bằng `analyzeReceiptText(ocrText)`:
   - Chỉ truyền text OCR đã làm sạch.
   - Gemini trả JSON có cấu trúc `ready`, `missing_fields`, hoặc `not_receipt`.
   - Không có inline image data/base64 trong Gemini request.
5. Giữ nguyên handler ảnh zalo và hàng chờ xác nhận. Chỉ kết quả `ready` hợp lệ mới tạo payload `create_finance_transaction`; thiếu/sai dữ liệu phải hỏi lại, không suy đoán.
6. Cập nhật cấu hình OCR (ngôn ngữ, đường dẫn data cục bộ, max bytes, timeout), Dockerfile, knowledge/docs và sidecars.

## Kiểm thử và nghiệm thu

- Unit test parser Gemini nhận text OCR, không còn chấp nhận ảnh/binary.
- Unit test OCR service với worker giả: chỉ gửi chuỗi text đã làm sạch sang Gemini; không gửi buffer ảnh.
- Test lỗi: ảnh quá lớn, worker OCR lỗi, text rỗng, text thiếu số tiền/loại giao dịch.
- Test bảo mật: kiểm tra source/service không còn `inlineData` hoặc `image.toString('base64')` trên luồng receipt.
- Chạy test hẹp, lint, typecheck, build Docker/API và kiểm tra rule Local-First.

## Rủi ro và kiểm soát

| Rủi ro                                  | Kiểm soát                                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tesseract OCR tiếng Việt đọc kém ảnh mờ | Dùng `vie+eng`, yêu cầu ảnh rõ hơn khi text không đủ; không fallback gửi ảnh sang Gemini. |
| Tăng kích thước image Docker            | Chỉ đóng gói `vie` và `eng` fast data cần thiết; báo kích thước thực tế sau build.        |
| OCR worker chậm khi khởi động           | Khởi tạo worker dùng lại trong service và giới hạn song song; timeout rõ ràng.            |
| Gemini diễn giải text OCR sai           | Hiển thị payload thu-chi và bắt buộc người dùng xác nhận trước khi ghi.                   |

## Tiêu chí nghiệm thu

1. Ảnh không còn được gửi tới Gemini dưới bất kỳ dạng nào.
2. Text Tesseract OCR là đầu vào duy nhất của Gemini cho luồng ảnh thu-chi.
3. Không có giao dịch được ghi nếu chưa bấm **Xác nhận**.
4. OCR chạy bằng language data cục bộ trong Docker, không tải model tại runtime.
5. Test, lint, typecheck, build và tài liệu mapping đều đạt.
