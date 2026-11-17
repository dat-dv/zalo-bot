---
metadata:
  agent-artifact:
    id: docs-module-zca-chat-memory
    type: documentation
    depends_on:
      - .agents/knowledge/modules/zca/chat-memory.md
      - apps/api/src/zca/memory/chat-memory.service.ts
      - apps/api/src/zca/memory/memory-kind.ts
      - apps/api/src/zca/memory/channel-notes.service.ts
      - apps/api/src/zca/memory/learned-facts.service.ts
      - apps/api/src/zca/memory/long-term/local-embedder.ts
      - apps/api/src/zca/memory/long-term/embedding-text.ts
      - apps/api/src/zca/memory/long-term/memory-embedding.service.ts
      - apps/api/src/zca/memory/long-term/memory-embedding.scheduler.ts
      - apps/api/src/zca/memory/chat-memory.query.ts
      - apps/api/src/database/migrations/1725040000000-AddMessageEmbeddings.ts
      - apps/api/src/zca/text/strategies/sync-memory-tool.strategy.ts
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
      - apps/api/src/zca/text/text-input.service.ts
      - apps/api/src/zca/text/strategies/search-chat-history-tool.strategy.ts
      - apps/api/src/zca/text/strategies/remember-note-tool.strategy.ts
      - apps/api/src/zca/text/strategies/forget-memory-tool.strategy.ts
      - apps/api/src/database/migrations/1724810000000-CreateZcaMessages.ts
      - apps/api/src/database/migrations/1724820000000-AddChatMemoryToZcaThreadConfigs.ts
      - apps/api/src/database/migrations/1724980000000-AddChatMemoryV2.ts
      - apps/api/src/zca/memory/image-text-memory.service.ts
      - apps/api/src/ocr/ocr.service.ts
      - docker-compose.yml
      - docker/postgres/Dockerfile
      - apps/api/Dockerfile
      - apps/web/src/modules/zca/view/thread-config-screen.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/channel-notes-section.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/long-term-memory-section.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/learned-facts-panel.tsx
      - apps/web/src/modules/zca/presentation/components/thread-config/image-text-memory-section.tsx
---

# Trí nhớ hội thoại (ZCA)

Tài liệu canonical tương ứng: [`chat-memory.md`](../../../knowledge/modules/zca/chat-memory.md).

## 1. Bài toán và vì sao làm như vậy

LLM không tự nhớ: mỗi lần gọi là độc lập. Bản trước chỉ có hai trí nhớ (ngắn hạn trong Redis, dài hạn trong Postgres) và gặp lỗi thật: anh Đạt dặn "mày là con mèo đen 2 mái", vài chục phút sau bot đã quên. Chẩn đoán ở `.agents/artifacts/chat-memory-persona-forgetting/` cho thấy ba nguyên nhân:

1. Cửa sổ ngắn hạn là 15 tin **của cả kênh**, trong đó 4 chỗ bị thẻ xác nhận và thông báo "Hết hạn" chiếm mất.
2. Trí nhớ dài hạn chỉ chạy khi AI tự quyết định tra, mà câu "mày là con gì" không giống câu hỏi chuyện cũ.
3. Câu "Bạn là trợ lý cá nhân thông minh trên Zalo" được viết cứng trong prompt, nên lời dặn trôi đi là câu này thắng.

Bản v2 giải quyết bằng các tầng trí nhớ chia theo kênh. Hiện còn ba tầng:

| Tầng | Ví dụ | Bot thấy khi nào | Ai ghi |
| --- | --- | --- | --- |
| 📌 **Ghi nhớ** | "Bot là con mèo đen 2 mái" | Mọi lượt, ngay sau câu danh tính | Người trong kênh, lưu ngay khi dặn trong chat |
| 🤖 **Bot đã học** | "Diệu Hằng: Ăn chay" | Mọi lượt, chỉ về bot và những người đang nói chuyện | Job chạy đêm trước đây (đã bỏ từ 17/11/2026, điều cũ vẫn dùng) |
| 🧠 **Nhớ lâu dài** | Toàn bộ tin, tìm được theo từ khoá và theo ý nghĩa | Khi có người hỏi chuyện cũ | Tự động, model chạy trên máy chủ |

**Đã bỏ "Nhớ đoạn chat gần đây"** (26/10/2026, quyết định của anh Đạt). Trí nhớ ngắn hạn chủ yếu dùng cho lúc người dùng xác nhận yes/no hay bổ sung một thẻ đang chờ. Việc đó đã có danh sách thẻ chờ trong Redis (hạn 5 phút) lo: bot đưa các thẻ chờ của chính người nhắn vào prompt, nên "tag @Nam nha" hay `yes 358` vẫn đúng mà không cần đọc lại tin cũ. Bỏ đi thì prompt gọn hơn, bot không còn bị tin cũ (gồm cả yêu cầu đã xử lý) làm nhiễu. Đổi lại, câu nối tiếp không gắn với thẻ nào (ví dụ "còn cái kia?") sẽ không hiểu được; khi đó người dùng nói đầy đủ một câu. Cấu hình cũ còn `shortTermEnabled`, `contextWindow`, `shortTermDays` được tự bỏ khi đọc.

## 2. Quy tắc nghiệp vụ

- **Theo từng kênh**: nhóm A không bao giờ đọc được trí nhớ của nhóm B. Mọi câu tìm (từ khoá lẫn ý nghĩa) đều lọc theo `channel_id`.
- **Một kho tin duy nhất** (`zca_messages`): mỗi tin lưu một lần, kèm **loại tin** (`memory_kind`) quyết định tin đó được dùng ở đâu:
  - `chat`: tin người nói chuyện bình thường → tìm được theo từ khoá và theo ý nghĩa.
  - `request`: tin người nhờ bot làm việc (đã thành tool call) hoặc gõ `yes/cancel/edit <mã>` → tìm được như `chat`.
  - `action`: dòng "(đã duyệt) Chi 70.000đ · …" chỉ được tạo **sau khi thao tác được duyệt và chạy thành công** → tìm được như `chat`.
  - `bot_chat`, `tool`, `reminder`: tin bot trò chuyện, kết quả tra cứu, tin nhắc → chỉ hiện làm tin xung quanh một kết quả. Không bao giờ là kết quả chính, để câu bot bịa hay số liệu cũ không thành "ký ức".
  - `card`, `system`, `result`: thẻ xác nhận, thông báo hết hạn/huỷ/tim, tin báo lắng nghe, tin "✅ [358] …" → không vào đâu cả.
  - `secret`: link và mã đăng nhập dashboard → chỉ lưu chữ "[Link đăng nhập dashboard]".
- **Thẻ xác nhận vẫn ở Redis**: mã 3 số, hạn 5 phút, duyệt đúng một lần. Redis làm việc này tốt hơn mọi kho trí nhớ. Huỷ, hết hạn, sửa giữa chừng hay chạy lỗi thì không có gì vào trí nhớ.
- **Số liệu hiện tại luôn tra bằng tool**: prompt có luật riêng, vì khoản chi có thể đã bị sửa hoặc xoá trên dashboard sau đó.
- **Thu hồi là quên**: tin bị thu hồi trên Zalo bị xoá nội dung ngay, cùng "dấu ý nghĩa" (embedding) của nó và của các tin ngay sau nó (vì các tin đó đọc kèm nó làm ngữ cảnh). Khoảng 20 giây sau các tin sau được tính lại, không còn tin đã thu hồi.
- **Chỉ lưu khi bật "Nhớ lâu dài"**: tắt thì không lưu tin, không ghi thao tác đã duyệt, không đọc chữ trong ảnh. Các dòng có `expires_at` là dữ liệu còn sót từ thời có trí nhớ ngắn hạn: job đêm xoá khi hết hạn, tìm kiếm và embedding bỏ qua chúng, nên lời hứa "chỉ nhớ từ lúc bật" vẫn đúng.
- Bot tự gửi tin thì zca-js có thể trả lại bản echo; bản echo không bị lưu thành tin của người, và tin `secret` không giữ chữ.

## 3. Ghi nhớ (📌)

- Trong chat: "mày là con mèo đen 2 mái 10 tuổi", "từ giờ xưng em", "nhớ là Hằng ăn chay" → bot **lưu ngay** và trả lời theo đúng giọng vừa được dặn, ví dụ "dạ em nhớ rồi, em là mèo đen 2 mái 10 tuổi nè 🐈‍⬛". Từ lượt sau, điều đó nằm trong prompt ở **mọi lượt** của kênh, ưu tiên hơn mô tả mặc định của bot.
- Vì sao không bắt duyệt nữa: bản đầu bắt duyệt thẻ 5 phút, không ai duyệt nên lời dặn bị bỏ (đoạn chat 26/10). Ghi nhớ chỉ đổi cách bot nói chuyện, không đụng tiền hay dữ liệu chung, và xoá được bất cứ lúc nào.
- Dặn điều mới cùng chủ đề (ví dụ đổi "mèo trắng" thành "mèo đen"): AI chỉ ra mã `[n2]` của dòng cũ và bot thay dòng đó.
- "Quên vụ mèo đen đi" → bot quên ngay (tối đa 5 điều khớp, gồm cả điều bot đã học trước đây; khớp nhiều hơn thì hỏi lại cho rõ).
- Câu trả lời do AI viết qua trường `reply` của tool; AI không viết thì bot dùng câu mặc định "Dạ em nhớ rồi: …".
- Cách bot phân biệt Ghi nhớ với lời nhắc, việc cần làm và trò chuyện: xem [Nhận lệnh Zalo](../../global/zalo-command-intake.md).
- Giới hạn 20 điều, mỗi điều 200 ký tự, vì tất cả đều được gửi cho AI ở mọi lượt.
- Ghi nhớ **không phụ thuộc** công tắc trí nhớ nào: kênh tắt hết vẫn dùng được.
- Ghi nhớ chỉ quản lý trong chat: dặn để thêm, "quên vụ … đi" để xoá. Trang cấu hình kênh không còn mục Ghi nhớ (bỏ ngày 26/10/2026). API ghi nhớ ở backend vẫn giữ để sau cần thì làm lại giao diện.

## 4. Nhớ lâu dài (🧠): tìm theo ý nghĩa bằng model chạy trên máy chủ

### Vì sao bỏ Cognee (anh Đạt chốt 17/11/2026)

Trước đây trí nhớ dài hạn dùng **Cognee**: mỗi đoạn chat được gửi cho LLM để dựng sơ đồ quan hệ. Log prod ngày 16–17/11/2026 cho thấy cách này không chạy được với key Google miễn phí:

- Khoảng **19.000 lượt** gọi LLM trong 24 giờ, chỉ **313 lượt** thành công. Cả hai AI trong chuỗi (`ggstudio`, `gemini`) đều trả 429 vì hết quota.
- Cognee gọi song song nhiều đoạn, đoạn nào lỗi lại tự thử lại, một đoạn lỗi là cả ngày hỏng. 49 ngày chat ở trạng thái `failed`.
- Trí nhớ dùng chung quota với bot trả lời chat, nên Cognee đốt hết quota thì bot chat cũng bị 429.
- Lúc rảnh container Cognee vẫn chiếm 1,84 GB RAM, image 3,9 GB.

Dữ liệu thật ra rất ít (khoảng 65 tin/ngày), nên chỉ cần **tìm theo ý nghĩa** là đủ. Việc này không cần LLM.

### Cách hoạt động

- **Embedding** là cách đổi một câu thành một dãy 384 con số; hai câu cùng ý (dù khác chữ) cho ra hai dãy gần nhau. Ví dụ "tối qua đi ăn lẩu ở đâu" và "hôm qua ăn lẩu quán nào" giống nhau 0,84, còn với "tiền điện tháng này bao nhiêu" chỉ 0,08.
- Model `paraphrase-multilingual-MiniLM-L12-v2` (đa ngôn ngữ, khoảng 120 MB) chạy **ngay trong API** bằng thư viện transformers.js. Không gọi AI bên ngoài, không tốn quota, tin không rời máy chủ.
- Dãy số được lưu trong bảng `zca_message_embeddings` của Postgres, nhờ extension **pgvector** (tìm dãy gần nhau nhất).
- **Khi nào nạp**: mỗi khi kênh có thay đổi (tin mới, thu hồi, đọc xong chữ trong ảnh), bot hẹn giờ cho kênh đó. Kênh ngớt tin **20 giây** thì nạp; nói liên tục thì chậm nhất **2 phút**. Một tin mất vài mili giây. Khởi động lại API thì sau 1 phút bot quét bù toàn bộ, và 03:00 mỗi đêm quét bù lần nữa. Vì vậy deploy xong, các tin cũ (kể cả 49 ngày từng lỗi với Cognee) tự được nạp.
- **Tin ngắn có ngữ cảnh**: mỗi tin được nạp kèm tối đa 2 tin ngay trước nó (trong vòng 10 phút), để câu như "ok chốt" vẫn mang nghĩa của chuyện đang bàn.
- **Không bao giờ "fail vì quota"**: model lỗi (ví dụ thiếu file) thì không đánh dấu gì, lần sau thử lại; trong lúc đó tìm theo từ khoá vẫn chạy bình thường.
- **Gõ `/sync`** (hoặc `@bot /sync`): nạp ngay các tin chưa nạp của kênh, xong báo "🧠 Đã cập nhật trí nhớ: N tin mới." hoặc "🧠 Trí nhớ đã đủ, không có tin mới.". Gần như không còn cần dùng vì nạp đã rất nhanh.
- **Ghi gì nhớ nấy** (anh Đạt chốt 26/10/2026): tin được nạp đúng như đã nhắn, không che gì.

### Khi có người hỏi chuyện cũ

`SEARCH_CHAT_HISTORY` chạy song song hai cách tìm trong đúng kênh đang hỏi:

1. **Theo từ khoá** (như trước): bắt tốt tên riêng, số tiền, tên miền, mã.
2. **Theo ý nghĩa**: câu hỏi được đổi thành dãy số rồi so với các tin đã nạp, lấy các tin đủ gần (khoảng cách cosine dưới 0,6). Bắt được câu nói khác chữ cùng ý.

Hai danh sách được gộp bằng cách xếp hạng chung (RRF): tin được cả hai cách tìm ra đứng đầu. Mỗi kết quả kèm vài tin xung quanh, tối đa 80 dòng, rồi gửi cho **AI đang dùng** để viết câu trả lời kèm ngày và người nói. Đây là lượt LLM duy nhất, giống một câu chat bình thường. Model chưa sẵn sàng thì chỉ tìm theo từ khoá.

**Tìm theo từ khoá bền hơn** (sửa sau đoạn chat 26/10, hỏi tài khoản admin `c.datintech.site` mà bot không tìm ra):

- Postgres coi `c.datintech.site` là **một chữ**, nên tìm "datintech" không ra. Từ khoá có dấu `.`, `@`, `/` (tên miền, email, link) giờ được tìm thêm theo chuỗi (`ILIKE`) và xếp lên đầu.
- Mỗi chữ của cụm nhiều chữ cũng được tìm riêng, nên tin chỉ ghi "admin" vẫn ra khi hỏi "tài khoản admin". Các chữ quá phổ biến (có, là, nói, đã…) không được tìm riêng.
- Mô tả tool nhắc AI sinh từ khoá ngắn, thêm từ viết tắt (mk, pass, tk, stk, sdt) và giữ nguyên tên miền.
- Khi kênh bật Nhớ lâu dài, prompt có thêm luật: hỏi lại, hoặc nhờ bot nói lại cho ai đó, một thông tin đã nhắn trong chat thì gọi tra lịch sử, không trò chuyện.

**Số kết quả mỗi lần tra do agent tự chọn** (tham số `limit`, 1–50, mặc định 15). Trần 80 dòng gửi cho AI vẫn giữ.

**Hạn chế**: không còn sơ đồ quan hệ, nên câu cần nối nhiều chuyện xa nhau ("Nam hay đi với ai nhất, người đó làm ở đâu") chỉ trả lời được khi các tin liên quan được tìm ra cùng lúc. Câu trống không như "lúc nãy a có nói r" vẫn khó tìm; nói kèm chủ đề.

### "Bot đã học" không học thêm

Job tự học mỗi đêm cần LLM nên đã bỏ cùng Cognee. Các điều đã học trước đó vẫn được đưa vào prompt và vẫn xoá được (trên dashboard hoặc "@bot quên vụ … đi"). Công tắc "Tự học về mọi người" đã bị ẩn; trường `learnPeople` trong cấu hình chỉ còn để tương thích.

## 5. Cài đặt và vận hành

- **Postgres** dùng image tự build `docker/postgres/Dockerfile`: `postgres:16-alpine` + pgvector 0.8.1. Giữ bản Alpine vì volume dữ liệu được tạo trên Alpine: image pgvector chính thức chạy Debian, collation `en_US.utf8` sắp xếp chữ khác, phải `REINDEX` toàn bộ. Compose build image này thành `zalobot-postgres:16-pgvector`, dùng lại volume cũ.
- **API** chạy trên `node:22-bookworm-slim` thay cho Alpine, vì runtime ONNX của model chỉ có bản cho glibc. Model được tải sẵn trong lúc build image (stage `embedding-model`) vào `/app/models` (`EMBEDDING_MODEL_DIR`), nên máy chủ không phải tải lúc chạy. Image API nặng thêm khoảng 120 MB; RAM API thêm khoảng 500 MB khi model đã nạp (bỏ được 1,84 GB của Cognee). Để giữ mức này, bộ embedding nạp theo lô 8 tin, cắt văn bản ở 500 ký tự (MiniLM chỉ học trên 128 token), tắt bộ nhớ đệm của ONNX, chạy 2 luồng, và image đặt `MALLOC_ARENA_MAX=2`. Với cấu hình mặc định, API trên prod lên tới 2,4 GB sau lần nạp lại đầu tiên vì ONNX và glibc giữ lại bộ nhớ của lô lớn nhất.
- Chạy local ngoài Docker: lần đầu cần model, nó tự tải về `DATA_DIR/models` (cần mạng một lần). Postgres local cũng phải là image có pgvector (`docker-compose.local.yml` đã build sẵn).
- Không có env bắt buộc mới. `EMBEDDING_MODEL` và `EMBEDDING_MODEL_DIR` chỉ để ghi đè; đổi model thì mọi tin tự được nạp lại (bảng lưu tên model của từng dòng).
- Migration `1725040000000-AddMessageEmbeddings` tạo extension `vector`, bảng `zca_message_embeddings`, và xoá hai bảng chỉ dùng cho Cognee (`zca_memory_segments`, `zca_memory_ingestions`). Tin gốc trong `zca_messages` không bị đụng.
- Không có index HNSW: mỗi lần tìm chỉ quét tin của một kênh (vài nghìn dòng), quét chính xác vẫn nhanh và không bỏ sót. Khi một kênh vượt khoảng 100 nghìn tin thì mới cần thêm.
- **Đã gỡ cùng Cognee**: service `cognee` và `cognee-ui`, volume `zalobot-cognee`, cổng AI nội bộ `/api/internal/llm/v1/chat/completions`, script `30-cognee-proxy.sh` và đường `/cognee` trên nginx, env `COGNEE_*`, `COGNEE_UI_HOST`, `COGNEE_UI_PORT`. Sau khi deploy, volume và image Cognee cũ trên máy chủ phải xoá tay (khoảng 4,6 GB); tunnel `cognee-zalobot.datintech.site` không còn dùng.

## 6. Trang cấu hình kênh

Cột phải có nhóm "🧠 Trí nhớ" gồm:

- 🧠 **Nhớ lâu dài**:
  - công tắc bật/tắt;
  - lưu ý quyền riêng tư: tin được lưu nguyên văn trên máy chủ, chỉ các đoạn liên quan được gửi cho AI khi có người hỏi;
  - phần "Cách hoạt động";
  - dòng trạng thái, ví dụ "Đã nhớ 1.957 tin." hoặc "3 tin đang chờ…"; model lỗi thì báo đang tạm tìm theo từ khoá;
  - mục "Điều bot đã học trước đây" có nút xoá, ẩn khi không có gì.
- 🖼️ **Đọc chữ trong ảnh**.

Không còn ô số nào để chỉnh, không còn công tắc tự học. Trên điện thoại hiển thị một cột.

Cấu hình kênh (`chatMemory`): `enabled`, `readImageText` (mặc định bật), `learnPeople` (không còn tác dụng). Các key cũ `shortTermEnabled`, `contextWindow`, `shortTermDays`, `searchLimit` bị bỏ khi đọc.

## 7. Đọc chữ trong ảnh

Không đổi cách đọc: OCR Tesseract chạy trên server, lần lượt từng ảnh, tối đa 20 ảnh chờ, có lọc rác. Chữ đọc được ghi vào **đúng một dòng** của tin ảnh trong trí nhớ lâu dài, rồi tin ảnh được nạp lại kèm chữ đó, nên tìm được cả nội dung bill hay ảnh chụp màn hình. Chỉ có tác dụng khi kênh bật "Nhớ lâu dài". Ảnh không bao giờ được gửi cho AI. Kênh hay gửi giấy tờ cá nhân thì tắt công tắc này.

## 8. Quyền riêng tư

- Bot lưu tin của **mọi thành viên** kênh đang listen, kể cả người không dùng bot.
- Mỗi lượt trả lời: Ghi nhớ và điều tự học (tối đa 15 dòng) được gửi cho LLM. Không gửi kèm tin nhắn gần đây.
- Khi hỏi chuyện cũ: tối đa 80 dòng tìm được (agent chọn 1–50 kết quả, mỗi kết quả kèm vài tin xung quanh) được gửi cho AI đang dùng để viết câu trả lời.
- **Nạp trí nhớ không gửi gì ra ngoài**: embedding tính ngay trên máy chủ. Trước đây (Cognee) mọi tin được gửi nguyên văn tới LLM vài phút sau khi nhắn; nay không còn.

## 9. Kiểm thử

- Unit test: `npm run test --workspace @zalobot/api`. Các file chính:
  - `zca/memory/chat-memory.service.spec.ts` (gộp kết quả từ khoá và ý nghĩa, thu hồi xoá embedding), `memory-text.util.spec.ts`, `image-text-memory.service.spec.ts`
  - `zca/memory/chat-memory.query.spec.ts` (tách chữ, tên miền, câu tìm theo ý nghĩa, RRF)
  - `zca/memory/long-term/memory-embedding.service.spec.ts` (chọn tin chờ, ghi embedding, model lỗi, trạng thái, câu trả lời `/sync`), `embedding-text.spec.ts`
  - `zca/text/strategies/sync-memory-tool.strategy.spec.ts`, `search-chat-history-tool.strategy.spec.ts`, `zca/text/intent-eval/`
  - `zca/confirmation/confirmed-action-memory.spec.ts` (chỉ ghi khi thành công)
  - `zca/text/strategies/remember-note-tool.strategy.spec.ts`, `zca/text/text-input.service.spec.ts`
- Web: `apps/web/src/modules/zca/model/channel-memory.spec.ts`, `thread-config-form.spec.ts`.
- Thử tay:
  1. Trong nhóm: "@bot tao dặn rồi mày là con mèo đen 2 mái" → bot lưu ngay → hỏi "@bot mày là con gì" sau vài chục tin.
  2. Ghi một khoản chi rồi huỷ thẻ: `SELECT memory_kind, text FROM zca_messages WHERE channel_id = '<id>' ORDER BY sent_at DESC LIMIT 10;` không có dòng `action`. Duyệt một khoản khác thì có dòng `action` "(đã duyệt) …".
  3. Nhắn "tối nay đi ăn lẩu Thái ở Q3 nha", đợi 20 giây, xem `SELECT count(*) FROM zca_message_embeddings WHERE channel_id = '<id>';` tăng. Hỏi "@bot hôm trước hẹn ăn gì" (không có chữ "lẩu") → bot vẫn tìm ra.
  4. Thu hồi tin đó trên Zalo → embedding của nó biến mất, hỏi lại không còn ra.

## 10. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp |
| --- | --- |
| Bot vẫn quên lời dặn | AI không nhận ra đó là lời dặn (không gọi `REMEMBER_NOTE`), hoặc ghi nhớ đã bị quên. Kiểm tra bảng `zca_channel_notes` của kênh |
| Thẻ "Nhớ lâu dài" báo "Chưa nạp được model trí nhớ" | API không đọc được file model: image không có `/app/models` (build lỗi stage `embedding-model`), hoặc chạy local mà không tải được lần đầu. Log API `[Embedder] Could not load …`. Bot tự thử lại sau 10 phút; trong lúc đó tìm theo từ khoá vẫn chạy |
| Migration lỗi `extension "vector" is not available` | Postgres vẫn chạy image `postgres:16-alpine` gốc. Phải dùng image build từ `docker/postgres/Dockerfile` (compose đã cấu hình) |
| Số "tin đang chờ" không giảm | Queue `chat-memory` không chạy (Redis lỗi) hoặc model lỗi. Xem log `[MemoryEmbedding]`; gõ `/sync` để thử ngay |
| Hỏi chuyện cũ không ra dù có tin | Kiểm tra kênh bật "Nhớ lâu dài" và tin thuộc loại `chat`/`request`/`action`. Câu hỏi quá xa nghĩa (khoảng cách > 0,6) thì chỉ còn tìm theo từ khoá; thử hỏi kèm từ khoá chính |
| Container `web` báo `unhealthy` (`wget: can't connect … Connection refused`) | Healthcheck gọi `localhost` (IPv6), nginx chỉ nghe IPv4; đã đổi sang `127.0.0.1` |
| "Bot đã học" có điều sai | Xoá điều đó trên dashboard hoặc nói "@bot quên vụ … đi" |
| Bot không hiểu câu nối tiếp | Bình thường: bot không còn đọc tin gần đây. Chỉ tin bổ sung cho thẻ đang chờ của chính người nhắn mới được hiểu; còn lại hãy nói đầy đủ một câu |
| Câu hỏi chuyện cũ chỉ trò chuyện | Chưa bật "Nhớ lâu dài" (tool tra cứu không được đưa cho AI) |
