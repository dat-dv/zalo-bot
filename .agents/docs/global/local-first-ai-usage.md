---
metadata:
  agent-artifact:
    id: docs-global-local-first-ai-usage
    type: documentation
    depends_on:
      - .agents/knowledge/global/local-first-ai-usage.md
      - apps/api/src/ocr/ocr.service.ts
      - apps/api/src/llm/llm.service.ts
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
- **Tin nhắn thoại**: không được chuyển thành văn bản; file âm thanh chỉ được sao lưu lên Drive khi kênh bật `mediaBackup.uploadAudios`. Hệ thống không có dịch vụ speech-to-text.
- Chuyển đổi file, đọc metadata, checksum, parse dữ liệu và trích xuất text không được gọi AI mặc định.
- Kết quả OCR hoặc AI không được tự ghi dữ liệu: tool call của AI chỉ tạo thao tác chờ duyệt, người dùng vẫn phải xác nhận.
- Khi cần AI chạy nội bộ hoàn toàn, đặt `LLM_PROVIDER=qwen` để gọi model qua endpoint tương thích Ollama (`QWEN_BASE_URL`).

## Ngoại lệ và backlog

Mọi ngoại lệ phải ghi rõ: công cụ cục bộ nào thiếu/không đáp ứng, phần dữ liệu tối thiểu gửi ra ngoài, chi phí dự kiến và fallback. Không tự cài package, tải model ngôn ngữ hoặc đổi Docker image nếu chưa có kế hoạch được duyệt.

Ngoại lệ đã duyệt:
- **9router đứng đầu chuỗi LLM** (dự phòng Gemini): mọi prompt `LlmService` gửi đi, gồm tin nhắn gọi bot, chữ OCR hoá đơn và đoạn trí nhớ, đều đi qua 9router tới model phía sau (hiện là DeepSeek bản free); khi 9router lỗi thì đi sang Gemini. Chủ dự án chọn đánh đổi này vì chi phí và độ sẵn sàng. Các quy tắc tối thiểu hoá dữ liệu ở trên giữ nguyên. Muốn giữ dữ liệu nội bộ thì đặt `LLM_PROVIDER=qwen`.
- **Trí nhớ hội thoại** ([chi tiết](../modules/zca/chat-memory.md)): tìm kiếm full-text chạy hoàn toàn trên Postgres, nhưng để hiểu câu hỏi và viết câu trả lời thì cần LLM. Chỉ gửi các đoạn tin khớp (tối đa 80 dòng, không có link media) khi kênh bật trí nhớ dài hạn, và vài tin gần nhất (tối đa 30, chỉ tin gửi trong số ngày kênh cấu hình, 1–7 ngày, giữ trong Redis) khi kênh bật trí nhớ ngắn hạn; không bao giờ gửi cả lịch sử. Chi phí: thêm 1 lượt gọi LLM cho mỗi câu hỏi về chuyện cũ. Câu trả lời dùng chung chuỗi provider; muốn giữ nội bộ thì đặt `LLM_PROVIDER=qwen`; mỗi kênh mặc định tắt cả hai loại trí nhớ, admin bật riêng từng loại cho kênh cần.
