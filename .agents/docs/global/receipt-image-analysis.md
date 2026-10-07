---
metadata:
  agent-artifact:
    id: docs-global-receipt-image-analysis
    type: documentation
    depends_on:
      - .agents/knowledge/global/receipt-image-analysis.md
---

# Phân tích ảnh hoá đơn và thu-chi

Bot nhận ảnh hoá đơn, bill hoặc ảnh chụp giao dịch từ zalo. Ảnh được OCR trong bộ nhớ; khi OCR xác định đây là bill đủ dữ liệu, hệ thống nén ảnh tại máy chủ rồi lưu cục bộ để gắn với giao dịch sau khi người dùng xác nhận. Không gửi ảnh, base64 hoặc URL zalo sang Gemini.

## Luồng xử lý

1. Người dùng gửi ảnh.
2. Bot chọn bản ảnh có độ phân giải cao nhất, kiểm tra giới hạn dung lượng rồi tải từ zalo.
3. Tesseract OCR cục bộ đọc ảnh bằng dữ liệu ngôn ngữ `vie+eng`, làm sạch text rồi mới gửi phần text đó cho Gemini. Gemini không nhận ảnh, base64 ảnh hoặc URL file zalo và trả một trong ba trạng thái: đủ thông tin, thiếu thông tin, hoặc không phải giao dịch.
4. Khi đủ loại thu/chi, số tiền VND và mô tả, ảnh được tự xoay theo EXIF, thu nhỏ cạnh dài tối đa 2048px và nén thành progressive JPEG chất lượng 82 trước khi lưu tại `RECEIPT_STORAGE_DIR/<zalo-user-id>/`.
5. Bot hiển thị thẻ **Xác nhận/Hủy** cùng URL ảnh nội bộ trong payload chờ xử lý.
6. Chỉ sau khi người dùng bấm **Xác nhận**, giao dịch mới được ghi vào sổ thu-chi với `receiptUrl`. Nếu hủy hoặc ghi giao dịch lỗi, file ảnh chưa gắn giao dịch được xóa.

Ảnh chỉ được tải qua `GET /api/receipts/:receiptId` với dashboard bearer token hợp lệ; API kiểm tra giao dịch thuộc đúng người dùng trước khi trả JPEG.

## Cấu hình và xử lý sự cố

- `RECEIPT_IMAGE_MAX_BYTES`: giới hạn dung lượng ảnh, mặc định 10 MB.
- `RECEIPT_IMAGE_TIMEOUT_MS`: thời gian tải và xử lý, mặc định 45 giây.
- `TESSERACT_LANG_PATH`: đường dẫn dữ liệu ngôn ngữ Tesseract nội bộ, mặc định `/app/assets/tessdata` trong Docker.
- `RECEIPT_STORAGE_DIR`: thư mục lưu receipt đã nén, mặc định `/app/data/receipts`. Với Docker phải mount persistent volume vào `/app/data`; Compose dùng volume `zalobot-receipts`.
- Nếu ảnh mờ hoặc thiếu số tiền/loại giao dịch, bot hỏi lại; không tự đoán và không tạo giao dịch.
- Nếu không tải được ảnh, kiểm tra kết nối zalo và gửi lại ảnh rõ hơn, nhỏ hơn 10 MB.
