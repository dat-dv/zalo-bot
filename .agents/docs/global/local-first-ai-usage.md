---
metadata:
  agent-artifact:
    id: docs-global-local-first-ai-usage
    type: documentation
    depends_on:
      - .agents/knowledge/global/local-first-ai-usage.md
      - apps/api/src/ocr/ocr.service.ts
      - apps/api/src/llm/llm.service.ts
      - apps/api/src/zca/memory/image-text-memory.service.ts
---

# Quy tắc xử lý cục bộ trước AI

Tài liệu canonical tương ứng: [`local-first-ai-usage.md`](../../knowledge/global/local-first-ai-usage.md).

Mục tiêu của quy tắc này là tiết kiệm token, giảm dữ liệu gửi ra ngoài và giữ hệ thống ổn định. Khi xử lý ảnh, tài liệu hoặc file, lập trình viên phải ưu tiên công cụ chạy cục bộ trước.

## Thứ tự bắt buộc

1. Dùng thư viện, model, CLI hoặc dịch vụ nội bộ đã cài.
2. Làm sạch và kiểm tra kết quả tại chỗ.
3. Chỉ gửi phần text tối thiểu cho AI (`LlmService`) nếu cần hiểu ngữ cảnh, phân loại hoặc tóm tắt.
4. Chỉ gửi file/ảnh gốc cho AI khi xử lý cục bộ không đáp ứng, có lý do được ghi nhận và người dùng đã chấp thuận nếu tăng chi phí hoặc phạm vi dữ liệu gửi ra ngoài.

## Áp dụng thực tế

- **Ảnh hóa đơn**: `OcrService` chuẩn hóa ảnh bằng Sharp (xoay, grayscale, tăng tương phản) rồi chạy Tesseract.js với ngôn ngữ `vie+eng` ngay trên server. `LlmService` chỉ nhận đoạn text OCR kèm ghi chú người dùng, không nhận bytes ảnh hay base64.
- **Ảnh trong kênh bật trí nhớ hội thoại**: cũng đọc bằng Tesseract trên server, chạy nền. Chỉ phần chữ đã lọc rác được lưu vào trí nhớ; ảnh không bao giờ được gửi cho AI. Admin tắt được cho từng kênh bằng công tắc "Đọc chữ trong ảnh".
- **Tin nhắn thoại**: không được chuyển thành văn bản; file âm thanh chỉ được sao lưu lên Drive khi kênh bật `mediaBackup.uploadAudios`. Hệ thống không có dịch vụ speech-to-text.
- Chuyển đổi file, đọc metadata, checksum, parse dữ liệu và trích xuất text không được gọi AI mặc định.
- Kết quả OCR hoặc AI không được tự ghi dữ liệu: tool call của AI chỉ tạo thao tác chờ duyệt, người dùng vẫn phải xác nhận.
- Khi cần AI chạy nội bộ hoàn toàn, thêm một dòng loại Ollama trên dashboard (Cài đặt → AI đang dùng) và đưa lên đầu chuỗi.

## Ngoại lệ và backlog

Mọi ngoại lệ phải ghi rõ: công cụ cục bộ nào thiếu/không đáp ứng, phần dữ liệu tối thiểu gửi ra ngoài, chi phí dự kiến và fallback. Không tự cài package, tải model ngôn ngữ hoặc đổi Docker image nếu chưa có kế hoạch được duyệt.

Ngoại lệ đã duyệt:
- **9router đứng đầu chuỗi LLM** (dự phòng Gemini): mọi prompt `LlmService` gửi đi, gồm tin nhắn gọi bot, chữ OCR hoá đơn và đoạn trí nhớ, đều đi qua 9router tới model phía sau (hiện là DeepSeek bản free); khi 9router lỗi thì đi sang Gemini. Chủ dự án chọn đánh đổi này vì chi phí và độ sẵn sàng. Các quy tắc tối thiểu hoá dữ liệu ở trên giữ nguyên. Muốn giữ dữ liệu nội bộ thì đưa một dòng Ollama local lên đầu chuỗi AI trên dashboard.
- **Trí nhớ hội thoại** ([chi tiết](../modules/zca/chat-memory.md)): **việc nhớ chạy hoàn toàn trên máy chủ**. Tin được đổi thành embedding bằng model MiniLM chạy trong API và tìm trong Postgres (từ khoá + pgvector). Từ 17/11/2026 không còn tin nào bị gửi ra ngoài để "nhớ": Cognee đã bỏ vì mỗi đoạn chat phải gọi LLM để dựng sơ đồ, đốt hết quota miễn phí dùng chung với bot chat. LLM chỉ cần để hiểu câu hỏi và giữ tính cách bot đã được dặn. Mỗi lượt bot trả lời gửi kèm Ghi nhớ của kênh (tối đa 20 điều) và các điều bot đã học trước đây về bot, người nhắn và người được tag (tối đa 15 dòng); không gửi kèm tin gần đây. Mỗi câu hỏi chuyện cũ gửi tối đa 80 dòng tìm được (agent tự chọn 1–50 kết quả) trong đúng 1 lượt gọi để viết câu trả lời, nguyên văn, không che gì. Chữ đọc từ ảnh đi cùng như tin nhắn chữ; bản thân ảnh không rời server. Không còn job LLM ban đêm. Mỗi kênh mặc định tắt trí nhớ.
