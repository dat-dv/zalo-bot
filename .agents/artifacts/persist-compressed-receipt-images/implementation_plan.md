# Kế hoạch: Lưu ảnh bill đã nén tại máy chủ

RequestFeedback: true

## Mục tiêu

Khi người dùng gửi ảnh hóa đơn/biên lai trên zalo và xác nhận tạo một khoản thu hoặc chi, hệ thống lưu một bản ảnh JPEG đã nén vào ổ đĩa persistent cục bộ. Giao dịch đã tạo sẽ tham chiếu đến ảnh này qua trường `receiptUrl` sẵn có.

## Hiện trạng đã xác nhận

- Luồng `@On('photo')` trong `apps/api/src/zalo/zalo.update.ts` tải ảnh zalo, OCR local bằng Tesseract, rồi chỉ đưa phần văn bản OCR đã chuẩn hoá sang Gemini.
- Sau khi OCR đọc được bill, hệ thống tạo một yêu cầu xác nhận `create_finance_transaction`; payload hiện chưa có `receiptUrl`.
- Entity `finance_transactions` và các DTO/service tài chính đã có cột/trường `receipt_url`/`receiptUrl`, vì vậy không cần migration cơ sở dữ liệu.
- API hiện không có dịch vụ xử lý ảnh, không mount thư mục dữ liệu persistent cho container API; filesystem bên trong image sẽ mất khi redeploy nếu không thêm volume.
- Dependencies hiện tại chưa có thư viện nén ảnh. Docker runner đã có `ffmpeg`, nhưng dùng nó để giải mã/chuyển ảnh đơn lẻ là không phù hợp bằng thư viện ảnh native chuyên dụng.

## Quyết định thiết kế đề xuất

1. Thêm `sharp` để xử lý ảnh hoàn toàn local: tự xoay theo EXIF, giới hạn cạnh dài 2048px (không phóng lớn), chuyển JPEG chất lượng 82 và xuất progressive JPEG.
2. Tạo dịch vụ `ReceiptImageStorageService` thuộc zalo module. Dịch vụ nhận buffer ảnh đã tải, kiểm tra định dạng ảnh, nén, ghi file atomically vào `RECEIPT_STORAGE_DIR/<zalo-user-id>/<uuid>.jpg`, rồi trả URL nội bộ ổn định `/api/receipts/<user-id>/<file>.jpg`.
3. Phục vụ đường dẫn `/api/receipts/...` bằng handler có kiểm tra đăng nhập/chủ sở hữu giao dịch, thay vì static public folder. API chỉ trả ảnh khi `userId` đang đăng nhập trùng với giao dịch chứa URL đó.
4. Trong handler nhận ảnh zalo, lưu ảnh nén ngay sau khi OCR thành công, rồi đính `receiptUrl` vào payload xác nhận. Khi người dùng bấm xác nhận, tool hiện hữu ghi URL vào `finance_transactions.receipt_url`.
5. Khi yêu cầu bị từ chối/hết hạn hoặc OCR không tạo được bill, xóa file tạm chưa được tham chiếu. Bổ sung quét dọn giới hạn theo tuổi cho các ảnh chưa có transaction để tránh file mồ côi.
6. Đặt mặc định `RECEIPT_STORAGE_DIR=/app/data/receipts`; mount named volume `zalobot-receipts` vào `/app/data` trong Docker Compose. Cập nhật `.env.example` và hướng dẫn Coolify để mount persistent storage cùng đường dẫn, tránh mất ảnh khi redeploy.

## Phạm vi thay đổi dự kiến

| Khu vực                                                        | Thay đổi                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/api/package.json`, lockfile, `apps/api/Dockerfile`       | Bổ sung runtime `sharp` tương thích Alpine.                                      |
| `apps/api/src/zalo/services/receipt-image-storage.service.ts`  | Nén, lưu/xóa, dọn ảnh mồ côi và tạo định danh file an toàn.                      |
| `apps/api/src/zalo/services/receipt-image-analysis.service.ts` | Trả/tiếp nhận buffer ảnh đã xác thực để không tải ảnh zalo lần hai.              |
| `apps/api/src/zalo/zalo.update.ts`, module                     | Đính kèm `receiptUrl` vào payload xác nhận; dọn file khi huỷ/lỗi.                |
| API/finance hoặc controller mới                                | Endpoint đọc ảnh có xác thực quyền sở hữu.                                       |
| `apps/api/src/config/*`, `.env.example`                        | Biến `RECEIPT_STORAGE_DIR` và validation.                                        |
| `docker-compose.yml`, `docs/deployment.md`                     | Volume persistent local và thao tác cấu hình Coolify.                            |
| Tests zalo/storage/finance                                     | Kiểm tra nén, URL/payload, chỉ chủ sở hữu tải được ảnh, và file mồ côi được xóa. |
| `.agents/knowledge/`, `.agents/docs/`                          | Đồng bộ hợp đồng lưu ảnh receipt bằng English/Vietnamese và chỉ mục docs.        |

## Tiêu chí nghiệm thu

- Gửi ảnh bill, OCR thành công, bấm xác nhận: giao dịch có `receiptUrl` và ảnh có thể xem lại bởi đúng chủ tài khoản.
- Ảnh lưu là JPEG đã nén, không vượt cạnh dài 2048px; lỗi decode, file rỗng, hoặc vượt giới hạn hiện tại bị từ chối mà không tạo transaction/file rác.
- Bấm từ chối, hết hạn, hoặc bill thiếu dữ liệu: không còn ảnh chưa được tham chiếu sau chu trình dọn dẹp.
- Người dùng khác/không đăng nhập không truy cập được URL ảnh.
- Redeploy container không làm mất ảnh khi volume persistent được cấu hình.
- `npm run typecheck`, `npm run lint`, test API liên quan và Docker build pass.

## Rủi ro và giả định

- Đây là thay đổi medium/high risk vì thêm dữ liệu cá nhân bền vững và endpoint phân quyền. Không thay đổi schema nhờ `receipt_url` đã có sẵn.
- Ảnh receipt có thể chứa thông tin nhạy cảm; không gửi ảnh gốc sang Gemini, chỉ tiếp tục gửi text OCR theo quy tắc local-first hiện tại.
- Kế hoạch chọn JPEG chất lượng 82 và cạnh dài 2048px như mặc định cân bằng dung lượng/khả năng đọc. Có thể đưa thành biến môi trường nếu anh muốn tinh chỉnh sau.
- Ảnh được ghi trong lúc chờ xác nhận để tránh phải tải lại URL zalo; file chưa được transaction tham chiếu sẽ được dọn an toàn.

## Xác minh sau triển khai

1. Gửi một ảnh bill thật, xác nhận, mở ảnh từ dashboard/API dưới đúng tài khoản.
2. Gửi ảnh rồi bấm hủy và kiểm tra không còn file sau khi cleanup chạy.
3. Thử URL ảnh dưới tài khoản khác để xác minh trả 403/404.
4. Redeploy với volume đã mount và xác minh ảnh cũ còn truy cập được.
