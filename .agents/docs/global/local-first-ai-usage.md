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
- Khi cần AI chạy nội bộ hoàn toàn, đặt `LLM_PROVIDER=qwen` để gọi model qua endpoint tương thích Ollama (`QWEN_BASE_URL`).

## Ngoại lệ và backlog

Mọi ngoại lệ phải ghi rõ: công cụ cục bộ nào thiếu/không đáp ứng, phần dữ liệu tối thiểu gửi ra ngoài, chi phí dự kiến và fallback. Không tự cài package, tải model ngôn ngữ hoặc đổi Docker image nếu chưa có kế hoạch được duyệt.

Ngoại lệ đã duyệt:
- **9router đứng đầu chuỗi LLM** (dự phòng Gemini): mọi prompt `LlmService` gửi đi, gồm tin nhắn gọi bot, chữ OCR hoá đơn và đoạn trí nhớ, đều đi qua 9router tới model phía sau (hiện là DeepSeek bản free); khi 9router lỗi thì đi sang Gemini. Chủ dự án chọn đánh đổi này vì chi phí và độ sẵn sàng. Các quy tắc tối thiểu hoá dữ liệu ở trên giữ nguyên. Muốn giữ dữ liệu nội bộ thì đặt `LLM_PROVIDER=qwen`.
- **Trí nhớ hội thoại** ([chi tiết](../modules/zca/chat-memory.md)): tìm theo từ khoá chạy hoàn toàn trên Postgres, nhưng để hiểu câu hỏi, giữ tính cách bot đã được dặn và tự học về mọi người thì cần LLM. Mỗi lượt bot trả lời gửi kèm: Ghi nhớ của kênh (tối đa 20 điều), điều bot tự học về bot, người nhắn và người được tag (tối đa 15 dòng); không còn gửi kèm tin gần đây (bỏ trí nhớ ngắn hạn ngày 26/10/2026). Mỗi câu hỏi chuyện cũ gửi tối đa 80 dòng tìm được (agent tự chọn 1–50 kết quả) và ngữ cảnh Cognee của đúng kênh đó. **Mỗi đêm** (chủ dự án quyết định ngày 25/10/2026): toàn bộ chat trong ngày của kênh bật "Nhớ lâu dài" được gửi tới LLM của service `cognee` (dự kiến là 9router); dữ liệu gồm lời người nói và thao tác đã duyệt, số dài từ 12 chữ số bị che, không có link media, không có tin đã thu hồi. Chi phí: khoảng 1 lượt gọi cho mỗi ~1500 token chat, cộng 1 lượt `LlmService` cho mỗi người được tự học. Chữ đọc từ ảnh đi cùng như tin nhắn chữ; bản thân ảnh không rời server. Đường lui: trỏ `COGNEE_LLM_*` và `LLM_PROVIDER` về `qwen` để chạy nội bộ, hoặc để trống `COGNEE_USER_PASSWORD` để tắt Cognee. Mỗi kênh mặc định tắt trí nhớ.
