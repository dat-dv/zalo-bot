---
metadata:
  agent-artifact:
    id: docs-module-zca-chat-memory
    type: documentation
    depends_on:
      - .agents/knowledge/modules/zca/chat-memory.md
      - apps/api/src/zca/memory/chat-memory.service.ts
      - apps/api/src/zalo/text/strategies/search-chat-history-tool.strategy.ts
      - apps/api/src/database/migrations/1724810000000-CreateZcaMessages.ts
---

# Trí nhớ hội thoại (ZCA)

Tài liệu canonical tương ứng: [`chat-memory.md`](../../../knowledge/modules/zca/chat-memory.md).

## 1. Bài toán và vì sao làm như vậy

Người dùng muốn mention bot rồi hỏi lại chuyện cũ trong nhóm, ví dụ "năm ngoái mình đi đâu?" hay "hôm trước Nam nói gửi file gì?". LLM (Gemini, OpenAI, 9router…) **không tự nhớ**: mỗi lần gọi là độc lập. Ta cũng không nhét được cả năm chat vào prompt, vì một nhóm hoạt động có thể có hàng trăm nghìn tin.

Cách làm:
1. **Lưu tin gốc** của mọi kênh ZCA đang listen vào bảng `zca_messages` trong Postgres. Đây là nguồn sự thật; sau này đổi model hay thêm vector thì chỉ cần index lại.
2. Khi được hỏi, LLM gọi tool `SEARCH_CHAT_HISTORY`, tự sinh từ khóa, từ đồng nghĩa và khoảng ngày.
3. Hệ thống tìm full-text bỏ dấu ("da lat" khớp "Đà Lạt") **trong đúng kênh đang hỏi**, lấy thêm vài tin xung quanh mỗi kết quả để đủ ngữ cảnh.
4. Chỉ các đoạn tìm được (tối đa 80 dòng) được gửi cho LLM viết câu trả lời, kèm ngày và người nói.

Ngoài ra, khoảng 10 tin gần nhất của kênh được đưa vào prompt để bot hiểu câu nối tiếp ("thế tháng 5 thì sao?").

## 2. Quy tắc nghiệp vụ

- **Nhớ theo từng kênh**: hỏi ở nhóm A chỉ tìm trong tin của nhóm A; chat 1-1 chỉ tìm trong chat đó. Khác với tài chính (sổ chung), nội dung chat không được lộ sang kênh khác.
- **Chỉ kênh đang listen**: kênh không listen không bị lưu gì. Kênh đang listen thì lưu **mọi tin**, kể cả tin không gọi bot. Các tin này chỉ được đọc lại khi có người hỏi.
- **Thu hồi là quên**: khi ai đó thu hồi tin trên Zalo, nội dung trong trí nhớ bị xoá (chỉ còn dấu mốc `recalled_at`), không bao giờ xuất hiện trong kết quả tìm.
- **Tin bot gửi cũng được nhớ** (`is_bot = true`), để câu hỏi nối tiếp hiểu được bot vừa trả lời gì.
- **Không lưu link media**: ảnh/video/file chỉ lưu nhãn và chú thích (`[Ảnh] Bãi biển Mũi Né`, `[File: ve.pdf]`), vì link CDN của Zalo hết hạn.
- **Lưu vô hạn** ở Bước 1. Chưa có job xoá theo hạn.
- Tool chỉ đọc nên **không cần xác nhận** (không sinh thẻ chờ duyệt).
- Khối "ngữ cảnh gần đây" trong prompt cấm LLM gọi tool cho các yêu cầu cũ trong khối, để không ghi lại giao dịch cũ lần nữa.

## 3. Bật tính năng

Trong `.env.local` (hoặc env của server):

```bash
CHAT_MEMORY_ENABLED=true
CHAT_MEMORY_CONTEXT_WINDOW=10
CHAT_MEMORY_SEARCH_LIMIT=15
```

- Cả phần chọn tool, sinh từ khóa lẫn phần viết câu trả lời đều đi qua cùng chuỗi provider chung (`LLM_PROVIDER` rồi `LLM_FALLBACK_PROVIDERS`, hiện là 9router → Gemini). Trí nhớ không có cấu hình LLM riêng.
- Migration `1724810000000-CreateZcaMessages` tự chạy khi khởi động (`migrationsRun: true`). Migration chạy `CREATE EXTENSION unaccent`; image `postgres:16-alpine` đã có sẵn, còn DB managed cần user có quyền tạo extension.
- **Tắt khẩn cấp**: đặt `CHAT_MEMORY_ENABLED=false` rồi restart; bot ngừng ghi, đọc và chèn ngữ cảnh. Gỡ hẳn: `npm run migration:revert --workspace @zalobot/api` (xoá bảng).

## 4. Quyền riêng tư

- Bot lưu tin của **mọi thành viên** kênh đang listen, kể cả người không dùng bot. Admin cần cân nhắc trước khi listen một nhóm.
- Chỉ các đoạn khớp (≤80 dòng) và ~10 tin gần nhất được gửi ra LLM, không bao giờ gửi cả lịch sử. Muốn giữ hoàn toàn nội bộ thì đặt chuỗi provider về `qwen` local (`LLM_PROVIDER=qwen`).
- Log raw payload của ZCA đã hạ xuống mức `debug`.

## 5. Kiểm thử

- Unit test: `npm run test --workspace @zalobot/api`. Các file liên quan:
  - `zca/memory/chat-memory.{mapper,query,service}.spec.ts`
  - `zalo/text/strategies/search-chat-history-tool.strategy.spec.ts`
  - các test trí nhớ trong `zca/zca-bot-feature.service.spec.ts`
- Thử tay:
  1. Bật env, restart, chat vài tin trong một nhóm đang listen.
  2. `SELECT sender_name, text, sent_at FROM zca_messages WHERE channel_id = '<id>' ORDER BY sent_at DESC LIMIT 10;`
  3. Thu hồi một tin, kiểm tra `text` của nó đã thành `NULL`, `recalled_at` có giá trị.
  4. Mention bot: "@bot hôm nay mình nói gì về <chủ đề>?" → bot trả lời kèm ngày và người nói.

## 6. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp |
| --- | --- |
| Bot trả "chưa bật tính năng ghi nhớ" | `CHAT_MEMORY_ENABLED` chưa là `true`, hoặc chưa restart |
| Migration lỗi `permission denied to create extension "unaccent"` | User DB không có quyền tạo extension; nhờ admin DB chạy `CREATE EXTENSION unaccent;` rồi khởi động lại |
| Bảng trống dù đang chat | Kênh chưa được listen, hoặc log có `[ChatMemory] Could not store …` (xem lỗi DB) |
| "Không tìm thấy…" dù đã từng nói | Từ khóa LLM sinh ra không khớp, hoặc khoảng ngày sai; hỏi lại cụ thể hơn. Tin trước khi bật tính năng chỉ có từ buffer Redis 7 ngày |
| Câu hỏi tổng hợp kiểu "cả năm đi những đâu" trả lời thiếu | Giới hạn của Bước 1 (tìm theo từ khóa); Bước 2 sẽ thêm tóm tắt theo ngày/tháng |
