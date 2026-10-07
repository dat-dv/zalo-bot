# Bàn giao: Tesseract OCR cục bộ cho ảnh thu-chi

## Đã thay đổi

- Cài `tesseract.js` cho API.
- Thay Gemini Vision bằng Tesseract OCR cục bộ `vie+eng` trong `ReceiptImageAnalysisService`.
- Ảnh zalo chỉ được tải để Tesseract đọc tại API. Gemini chỉ nhận text OCR đã chuẩn hoá, tối đa 12.000 ký tự.
- Xoá cách gửi `inlineData`/base64 ảnh vào Gemini trên luồng hoá đơn.
- Giữ nguyên cơ chế đề xuất rồi **Xác nhận/Hủy** trước khi tạo giao dịch thu-chi.
- Dockerfile tải sẵn language data `vie` và `eng` vào `/app/assets/tessdata`; không tải model OCR khi bot chạy.

## Xác minh

- Kiểm thử: 7/7 đạt.
- `npm run lint`: đạt.
- `npm run typecheck`: đạt.
- `npm run build`: đạt.
- `npm run agent-system:validate`: đạt.
- Kiểm tra source: không còn `inlineData` hoặc base64 ảnh ở luồng OCR.

## Giới hạn xác minh

Build Docker đầy đủ chưa chạy xong trong môi trường hiện tại vì lần build đầu phải tải nhiều lớp Node/Whisper vượt giới hạn thời gian mỗi lượt. Dockerfile đã khai báo rõ bước tải language data Tesseract trong image; cần chạy `docker compose build api` tại môi trường triển khai để hoàn tất build image lần đầu.
