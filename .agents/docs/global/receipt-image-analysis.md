---
metadata:
  agent-artifact:
    id: docs-global-receipt-image-analysis
    type: documentation
    depends_on:
      - .agents/knowledge/global/receipt-image-analysis.md
      - apps/api/src/zca/pending-image/image-batch-handler.service.ts
      - apps/api/src/zca/pending-image/strategies/create-bill-pending-image.strategy.ts
      - apps/api/src/ocr/ocr.service.ts
      - apps/api/src/receipt-storage/media-storage.service.ts
      - apps/api/src/finance/receipt-source.ts
---

# Phân tích ảnh hoá đơn và thu-chi

Tài liệu canonical tương ứng: [`receipt-image-analysis.md`](../../knowledge/global/receipt-image-analysis.md).

Người dùng thường chụp bill thay vì gõ lại số tiền. Bot đọc chữ trên ảnh **tại máy chủ** (OCR cục bộ), chỉ gửi phần chữ cho AI để hiểu nội dung, rồi vẫn bắt người dùng xác nhận trước khi ghi sổ. Ảnh gốc được lưu lên Google Drive/Photos của người dùng để đối chiếu sau này.

## Luồng xử lý

1. Người dùng gửi một hoặc nhiều ảnh (qua ZCA). Bot gom ảnh trong 1 giây rồi lưu một "ảnh chờ xử lý" vào bộ nhớ và Redis, hạn 5 phút.
2. Bot hỏi người dùng muốn làm gì:
   - `1` hoặc `1 <ghi chú>` (ví dụ `1 Ăn trưa Highlands`): tạo bill / ghi chi tiêu.
   - `2`: chỉ lưu ảnh lên Google Drive & Google Photos.
   - `hủy`: bỏ qua ảnh. Người dùng cũng có thể tiếp tục trò chuyện bình thường.
3. Với lựa chọn **1**:
   - Ảnh được tải vào bộ nhớ, `OcrService` chuẩn hóa bằng Sharp rồi chạy Tesseract với ngôn ngữ `vie+eng`.
   - `MediaStorageService.uploadBill` đồng thời lưu ảnh lên Drive (`zalobot/<channelId>/bill/YYYY-MM`) và Google Photos. Nếu lưu Drive thành công, link Drive được dùng làm `receiptUrl`; nếu lỗi thì giữ URL ảnh gốc và chỉ ghi log. Không lưu file xuống ổ đĩa máy chủ.
   - `LlmService` nhận prompt gồm text OCR, ghi chú người dùng, chuỗi `receiptUrl` và mốc thời gian hiện tại, cùng danh sách tool `ZALO_TOOL_DEFINITIONS`. AI không nhận bytes ảnh hay base64.
   - Nếu AI gọi `RECORD_TRANSACTION`, bot tạo thẻ xác nhận giao dịch như khi nhắn tay (kèm `receiptUrl`). Giao dịch chỉ được ghi sau khi người dùng xác nhận mã.
   - Nếu AI không trích được số tiền, bot gửi lại câu trả lời của AI hoặc nhắc người dùng nhắn thông tin chi tiêu (ví dụ "Ăn trưa 85k"); không tự tạo giao dịch.
4. Với lựa chọn **2**: mọi ảnh đang chờ được tải lên Drive (`zalobot/<channelId>/image/...`) và Google Photos qua `MediaStorageService.uploadImage`, bot trả tóm tắt từng ảnh; không gọi AI.

## Cấu hình và xử lý sự cố

- Lưu Drive/Photos cần người dùng đã kết nối Google với scope `drive.file` và `photoslibrary.appendonly` (gõ `/login` để kết nối lại nếu thiếu).
- Chất lượng trích xuất phụ thuộc AI provider cấu hình qua `LLM_PROVIDER`.
- Hiện chưa có giới hạn dung lượng hoặc timeout khi tải ảnh; ảnh quá lớn có thể làm chậm OCR.
- Nếu ảnh mờ hoặc OCR không đọc được chữ, prompt ghi rõ là không nhận diện được nội dung; khi AI không gọi tool, bot nhắc người dùng nhắn tay. Dù AI có đoán, người dùng vẫn kiểm tra trên thẻ xác nhận trước khi ghi sổ.

## Xem lại ảnh hoá đơn trên dashboard
- Link ảnh gốc (Drive hoặc CDN Zalo) không gửi ra web vì link Drive là riêng tư. Trang Thu chi gọi `GET /api/transactions/:id/receipt`; API tải ảnh Drive lần lượt bằng token tài khoản Google dùng chung → token người tạo giao dịch → link công khai của file (hoặc tải từ CDN Zalo) rồi trả về. Nhờ link công khai, đổi tài khoản Google vẫn xem được ảnh cũ, trừ khi tài khoản cũ đã bị xoá hoặc Workspace chặn chia sẻ công khai (xem `modules/zca/channel-storage.md`).
