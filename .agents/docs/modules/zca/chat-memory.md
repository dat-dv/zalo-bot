---
metadata:
  agent-artifact:
    id: docs-module-zca-chat-memory
    type: documentation
    depends_on:
      - .agents/knowledge/modules/zca/chat-memory.md
      - apps/api/src/zca/memory/chat-memory.service.ts
      - apps/api/src/zca/memory/short-term-memory.service.ts
      - apps/api/src/zca/text/strategies/search-chat-history-tool.strategy.ts
      - apps/api/src/database/migrations/1724810000000-CreateZcaMessages.ts
      - apps/api/src/database/migrations/1724820000000-AddChatMemoryToZcaThreadConfigs.ts
      - apps/web/src/modules/zca/view/thread-config-screen.tsx
---

# Trí nhớ hội thoại (ZCA)

Tài liệu canonical tương ứng: [`chat-memory.md`](../../../knowledge/modules/zca/chat-memory.md).

## 1. Bài toán và vì sao làm như vậy

Người dùng muốn mention bot rồi hỏi lại chuyện cũ trong nhóm, ví dụ "năm ngoái mình đi đâu?" hay "hôm trước Nam nói gửi file gì?". LLM (Gemini, OpenAI, 9router…) **không tự nhớ**: mỗi lần gọi là độc lập. Ta cũng không nhét được cả năm chat vào prompt, vì một nhóm hoạt động có thể có hàng trăm nghìn tin.

Cách làm:
1. **Lưu tin gốc** của các kênh ZCA đang listen **và đã bật trí nhớ** vào bảng `zca_messages` trong Postgres. Đây là nguồn sự thật; sau này đổi model hay thêm vector thì chỉ cần index lại.
2. Khi được hỏi, LLM gọi tool `SEARCH_CHAT_HISTORY`, tự sinh từ khóa, từ đồng nghĩa và khoảng ngày.
3. Hệ thống tìm full-text bỏ dấu ("da lat" khớp "Đà Lạt") **trong đúng kênh đang hỏi**, lấy thêm vài tin xung quanh mỗi kết quả để đủ ngữ cảnh.
4. Chỉ các đoạn tìm được (tối đa 80 dòng) được gửi cho LLM viết câu trả lời, kèm ngày và người nói.

Ngoài ra, khoảng 10 tin gần nhất của kênh được đưa vào prompt để bot hiểu câu nối tiếp ("thế tháng 5 thì sao?").

## 2. Quy tắc nghiệp vụ

- **Nhớ theo từng kênh**: hỏi ở nhóm A chỉ tìm trong tin của nhóm A; chat 1-1 chỉ tìm trong chat đó. Khác với tài chính (sổ chung), nội dung chat không được lộ sang kênh khác.
- **Chỉ kênh đang listen và đã bật trí nhớ**: các kênh khác không bị lưu gì. Kênh đã bật thì lưu **mọi tin**, kể cả tin không gọi bot. Các tin này chỉ được đọc lại khi có người gọi bot.
- **Thu hồi là quên**: khi ai đó thu hồi tin trên Zalo, nội dung trong trí nhớ bị xoá (chỉ còn dấu mốc `recalled_at`), không bao giờ xuất hiện trong kết quả tìm. Tin do chính bot thu hồi (thẻ xác nhận) được xoá ngay trong `ZcaService.undo`, vì zca-js không báo lại sự kiện thu hồi của chính tài khoản khi tắt `ZCA_SELF_LISTEN`. Khi so theo `cliMsgId` (mã do máy người gửi tự sinh, có thể trùng giữa người này với người khác), hệ thống so kèm người gửi để không xoá nhầm tin của người khác.
- **Kết quả tra cứu không tính câu hỏi đang hỏi và câu trả lời cũ của bot**: câu hỏi luôn khớp từ khóa của chính nó, còn câu trả lời cũ có thể sai nên không được dùng làm bằng chứng (vẫn hiện nếu nằm cạnh một tin khớp).
- **Kênh chưa bật trí nhớ dài hạn không thấy tool tra cứu** (dù có bật ngắn hạn): LLM không được đưa tool `SEARCH_CHAT_HISTORY`, nên câu hỏi chuyện cũ ở kênh này vẫn được trả lời kiểu trò chuyện (hoặc im lặng nếu kênh tắt `allowAiChat`) như trước khi có tính năng.
- **Tin bot gửi cũng được nhớ** (`is_bot = true`), để câu hỏi nối tiếp hiểu được bot vừa trả lời gì.
- **Không lưu link media**: ảnh/video/file chỉ lưu nhãn và chú thích (`[Ảnh] Bãi biển Mũi Né`, `[File: ve.pdf]`), vì link CDN của Zalo hết hạn.
- **Lưu vô hạn** ở Bước 1. Chưa có job xoá theo hạn.
- Tool chỉ đọc nên **không cần xác nhận** (không sinh thẻ chờ duyệt).
- Khối "ngữ cảnh gần đây" trong prompt cấm LLM gọi tool cho các yêu cầu cũ trong khối, để không ghi lại giao dịch cũ lần nữa.

## 3. Bật tính năng cho từng kênh

Bot có **hai loại trí nhớ độc lập**, mỗi loại có card và công tắc riêng trên trang cấu hình kênh (vào "Zalo & Users", bấm **Cấu hình** ở dòng của nhóm). Tắt loại này không làm tắt loại kia.

| | 💬 Trí nhớ ngắn hạn | 🧠 Trí nhớ dài hạn |
| --- | --- | --- |
| Dùng để | Hiểu câu nối tiếp khi đang chat ("còn cái kia?", "ghi giúp cái đó") | Hỏi lại chuyện cũ ("hôm trước Nam nói gửi file gì?") |
| Chạy khi | Mọi lượt bot trả lời | Khi LLM gọi tool `SEARCH_CHAT_HISTORY` |
| Lưu ở | Redis `zca:short_memory:<threadId>` | Postgres `zca_messages` |
| Giữ bao lâu | Tự quên sau 24 giờ không có tin mới | Vô hạn |
| Trường cấu hình | `shortTermEnabled`, `contextWindow` (1–30, mặc định 10) | `enabled`, `searchLimit` (1–50, mặc định 15) |

Vì sao tách: hai loại phục vụ hai nhu cầu và có mức rủi ro riêng tư khác nhau. Có nhóm chỉ cần bot hiểu câu nối tiếp mà không muốn bị lưu lâu dài; có nhóm cần tra lại chuyện cũ. Trước đây trí nhớ ngắn hạn đọc từ bảng `zca_messages`, nên tắt lưu là mất luôn ngữ cảnh. Nay nó có kho Redis riêng.

Vì sao làm theo kênh: mỗi nhóm có nhu cầu riêng tư khác nhau. Nhóm gia đình có thể muốn bot nhớ, nhóm công việc thì không. Kênh phải **đang listen** thì bot mới nhận được tin.

- **Mặc định tắt cả hai** cho mọi kênh mới. Cột "Tính năng" của bảng kênh hiện `Ngữ cảnh` khi bật ngắn hạn và `Nhớ` khi bật dài hạn.
- **Cấu hình cũ** (trước khi tách, chỉ có một công tắc): kênh đang bật trí nhớ và có `contextWindow > 0` được coi là bật cả hai; kênh đang tắt thì tắt cả hai; `contextWindow = 0` cũ nghĩa là tắt ngắn hạn. Không kênh nào bị đổi hành vi.
- **Bật dài hạn**: bot bắt đầu lưu từ lúc đó. Tin trong buffer Redis (≤200 tin, 7 ngày) được nạp vào ở lần khởi động API sau.
- **Tắt dài hạn**: có hiệu lực ngay, không cần restart. Bot ngừng lưu và ngừng tra. **Tin đã lưu vẫn giữ trong DB** và dùng tiếp khi bật lại.
- **Trí nhớ ngắn hạn**: giữ tối đa 60 bản ghi thô (gấp đôi cửa sổ lớn nhất, vì tin bot có thể được ghi hai lần: lúc gửi và lúc Zalo gửi lại bản echo), khi đọc thì gộp bản trùng. Khi Redis không chạy thì dùng bộ nhớ trong tiến trình, mất khi restart. Không nạp lại lúc khởi động.
- Tin bị thu hồi trên Zalo bị xoá khỏi **cả hai** trí nhớ, kể cả khi kênh đang tắt chúng.
- Giá trị nhập ngoài giới hạn được tự kẹp lại (vd 99 → 30), ở cả dashboard lẫn API (`normalizeChatMemoryConfig` trong `@zalobot/contracts`).

- Cả phần chọn tool, sinh từ khóa lẫn phần viết câu trả lời đều đi qua cùng chuỗi provider chung (`LLM_PROVIDER` rồi `LLM_FALLBACK_PROVIDERS`, hiện là 9router → Gemini). Trí nhớ không có cấu hình LLM riêng.
- Migration `1724810000000-CreateZcaMessages` tự chạy khi khởi động (`migrationsRun: true`). Migration chạy `CREATE EXTENSION unaccent`; image `postgres:16-alpine` đã có sẵn, còn DB managed cần user có quyền tạo extension.
- Migration `1724820000000-AddChatMemoryToZcaThreadConfigs` thêm cột `chat_memory` vào `zca_thread_configs`, mặc định tắt cho mọi kênh.

## 4. Quyền riêng tư

- Bot lưu tin của **mọi thành viên** kênh đang listen, kể cả người không dùng bot. Admin cần cân nhắc trước khi listen một nhóm.
- Chỉ các đoạn khớp (≤80 dòng, khi bật dài hạn) và vài tin gần nhất (≤30, khi bật ngắn hạn) được gửi ra LLM, không bao giờ gửi cả lịch sử. Muốn giữ hoàn toàn nội bộ thì đặt chuỗi provider về `qwen` local (`LLM_PROVIDER=qwen`).
- Log raw payload của ZCA đã hạ xuống mức `debug`.

## 5. Kiểm thử

- Unit test: `npm run test --workspace @zalobot/api`. Các file liên quan:
  - `zca/memory/chat-memory.{mapper,query,service}.spec.ts`
  - `zca/memory/short-term-memory.service.spec.ts`
  - `zalo/text/strategies/search-chat-history-tool.strategy.spec.ts`
  - các test trí nhớ trong `zca/zca-bot-feature.service.spec.ts`
- Thử tay:
  1. Bật trí nhớ cho một nhóm đang listen trong Cấu hình kênh, rồi chat vài tin.
  2. `SELECT sender_name, text, sent_at FROM zca_messages WHERE channel_id = '<id>' ORDER BY sent_at DESC LIMIT 10;`
  3. Thu hồi một tin, kiểm tra `text` của nó đã thành `NULL`, `recalled_at` có giá trị.
  4. Mention bot: "@bot hôm nay mình nói gì về <chủ đề>?" → bot trả lời kèm ngày và người nói.

## 6. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp |
| --- | --- |
| Bot không tra lại chuyện cũ mà chỉ trò chuyện | Kênh chưa bật card "🧠 Trí nhớ dài hạn" trong Cấu hình kênh (tool tra cứu không được đưa cho LLM) |
| Bot không hiểu câu nối tiếp ("ghi giúp cái đó") | Kênh chưa bật card "💬 Trí nhớ ngắn hạn", hoặc tin trước đó đã quá 24 giờ |
| Migration lỗi `permission denied to create extension "unaccent"` | User DB không có quyền tạo extension; nhờ admin DB chạy `CREATE EXTENSION unaccent;` rồi khởi động lại |
| Bảng trống dù đang chat | Kênh chưa được listen hoặc chưa bật trí nhớ, hoặc log có `[ChatMemory] Could not store …` (xem lỗi DB) |
| "Không tìm thấy…" dù đã từng nói | Từ khóa LLM sinh ra không khớp, hoặc khoảng ngày sai; hỏi lại cụ thể hơn. Tin trước khi bật tính năng chỉ có từ buffer Redis 7 ngày |
| Câu hỏi tổng hợp kiểu "cả năm đi những đâu" trả lời thiếu | Giới hạn của Bước 1 (tìm theo từ khóa); Bước 2 sẽ thêm tóm tắt theo ngày/tháng |
