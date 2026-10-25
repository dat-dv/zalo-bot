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
      - apps/api/src/zca/memory/short-term-memory.service.ts
      - apps/api/src/zca/memory/long-term/cognee.client.ts
      - apps/api/src/zca/memory/long-term/memory-ingest.service.ts
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
      - apps/web/nginx.conf
      - apps/web/30-cognee-proxy.sh
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

Bản v2 giải quyết bằng bốn tầng trí nhớ, tất cả chia theo kênh:

| Tầng | Ví dụ | Bot thấy khi nào | Ai ghi |
| --- | --- | --- | --- |
| 📌 **Ghi nhớ** | "Bot là con mèo đen 2 mái" | Mọi lượt, ngay sau câu danh tính | Người trong kênh (qua thẻ xác nhận), admin trên dashboard |
| 💬 **Nhớ đoạn chat gần đây** | 15 tin gần nhất | Mọi lượt | Tự động |
| 🤖 **Bot đã học** | "Diệu Hằng: Ăn chay" | Mọi lượt, chỉ về bot và những người đang nói chuyện | Job chạy đêm |
| 🧠 **Nhớ lâu dài** | Toàn bộ tin + nhật ký từng ngày trong Cognee | Khi có người hỏi chuyện cũ | Tự động + job chạy đêm |

## 2. Quy tắc nghiệp vụ

- **Theo từng kênh**: nhóm A không bao giờ đọc được trí nhớ của nhóm B. Trong Cognee mỗi kênh là một dataset riêng (`zca-<channelId>`), và Cognee phải bật access control thì bộ lọc dataset mới có hiệu lực.
- **Một kho tin duy nhất** (`zca_messages`): mỗi tin lưu một lần, kèm **loại tin** (`memory_kind`) quyết định tin đó được dùng ở đâu:
  - `chat`: tin người nói chuyện bình thường → vào cửa sổ gần đây và vào Cognee.
  - `request`: tin người nhờ bot làm việc (đã thành tool call) hoặc gõ `yes/cancel/edit <mã>` → vào cửa sổ gần đây để hiểu câu nối tiếp, **không** vào Cognee.
  - `action`: dòng "(đã duyệt) Chi 70.000đ · …" chỉ được tạo **sau khi thao tác được duyệt và chạy thành công** → vào cả hai.
  - `bot_chat`, `tool`, `reminder`: tin bot trò chuyện, kết quả tra cứu, tin nhắc → chỉ vào cửa sổ gần đây. Không vào Cognee, để câu bot bịa hay số liệu cũ không thành "ký ức".
  - `card`, `system`, `result`: thẻ xác nhận, thông báo hết hạn/huỷ/tim, tin "✅ [358] …" → không vào đâu cả.
  - `secret`: link và mã đăng nhập dashboard → chỉ lưu chữ "[Link đăng nhập dashboard]".
- **Thẻ xác nhận vẫn ở Redis**: mã 3 số, hạn 5 phút, duyệt đúng một lần. Redis làm việc này tốt hơn mọi kho trí nhớ. Huỷ, hết hạn, sửa giữa chừng hay chạy lỗi thì không có gì vào trí nhớ.
- **Số liệu hiện tại luôn tra bằng tool**: prompt có luật riêng, vì khoản chi có thể đã bị sửa hoặc xoá trên dashboard sau đó.
- **Thu hồi là quên**: tin bị thu hồi trên Zalo bị xoá nội dung ngay. Nếu ngày đó đã nạp vào Cognee thì ngày đó bị đánh dấu `stale` và được nạp lại vào đêm sau, không còn tin đó. Điều tự học từ tin đó có thể còn tối đa tới đêm sau.
- **Kênh chỉ bật "Nhớ đoạn chat gần đây"**: tin vẫn lưu vào `zca_messages` nhưng có hạn (`expires_at` = lúc gửi + 7 ngày) và bị xoá mỗi đêm. Bật "Nhớ lâu dài" sau đó cũng không làm lộ các tin này, nên lời hứa "chỉ nhớ từ lúc bật" vẫn đúng.
- Bot tự gửi tin thì zca-js có thể trả lại bản echo; bản echo không bị lưu thành tin của người, và tin `secret` không giữ chữ.

## 3. Ghi nhớ (📌)

- Trong chat: "mày là con mèo đen 2 mái 10 tuổi", "từ giờ xưng em", "nhớ là Hằng ăn chay" → bot **lưu ngay** và trả lời theo đúng giọng vừa được dặn, ví dụ "dạ em nhớ rồi, em là mèo đen 2 mái 10 tuổi nè 🐈‍⬛". Từ lượt sau, điều đó nằm trong prompt ở **mọi lượt** của kênh, ưu tiên hơn mô tả mặc định của bot.
- Vì sao không bắt duyệt nữa: bản đầu bắt duyệt thẻ 5 phút, không ai duyệt nên lời dặn bị bỏ (đoạn chat 26/10). Ghi nhớ chỉ đổi cách bot nói chuyện, không đụng tiền hay dữ liệu chung, và xoá được bất cứ lúc nào.
- Dặn điều mới cùng chủ đề (ví dụ đổi "mèo trắng" thành "mèo đen"): AI chỉ ra mã `[n2]` của dòng cũ và bot thay dòng đó.
- "Quên vụ mèo đen đi" → bot quên ngay (tối đa 5 điều khớp, gồm cả điều bot tự học; khớp nhiều hơn thì hỏi lại cho rõ).
- Câu trả lời do AI viết qua trường `reply` của tool; AI không viết thì bot dùng câu mặc định "Dạ em nhớ rồi: …".
- Cách bot phân biệt Ghi nhớ với lời nhắc, việc cần làm và trò chuyện: xem [Nhận lệnh Zalo](../../global/zalo-command-intake.md).
- Giới hạn 20 điều, mỗi điều 200 ký tự, vì tất cả đều được gửi cho AI ở mọi lượt.
- Ghi nhớ **không phụ thuộc** công tắc trí nhớ nào: kênh tắt hết vẫn dùng được.
- Admin thêm, sửa, xoá trên trang cấu hình kênh; lưu ngay, không cần bấm "Lưu cấu hình".

## 4. Nhớ lâu dài và Cognee (🧠)

**Cognee** là máy chủ trí nhớ mã nguồn mở (Apache 2.0) chạy thành service riêng trong docker-compose. Nó dùng AI rút thực thể và quan hệ từ văn bản thành sơ đồ tri thức (knowledge graph), nhờ vậy trả lời được câu hỏi tổng hợp kiểu "tháng 5 nhóm đi đâu", "chồng Hằng là ai". Đánh giá và kiểm chứng: `.agents/artifacts/chat-memory-cognee/research.md`.

Mỗi đêm lúc 03:00 (giờ Việt Nam, BullMQ queue `chat-memory`):

1. Xoá các tin hết hạn của kênh chỉ bật ngắn hạn.
2. Với mỗi kênh bật "Nhớ lâu dài", lần lượt từng kênh: lấy tối đa 8 ngày chưa nạp (hôm qua trước, rồi tới ngày cũ chưa nạp, ngày `stale`, ngày lỗi còn lượt thử).
3. Mỗi ngày thành một tài liệu: tiêu đề `Nhật ký cuộc trò chuyện "<tên kênh>" ngày 25/10/2026 (Chủ Nhật)`, mỗi dòng `HH:mm Tên: nội dung`. Chỉ gồm tin `chat` và `action`; số dài từ 12 chữ số (thẻ, tài khoản) bị che còn `***1234`. Ngày có tiêu đề ngày tháng trong chữ thì Cognee mới hiểu được thời gian.
4. Gửi vào Cognee. Lỗi thì ghi `failed` kèm lý do, đêm sau thử lại (tối đa 5 lần).
5. Nếu bật "Tự học về mọi người": hỏi Cognee về bot và 10 người hay nói nhất trong các ngày vừa nạp, rồi nhờ LLM rút tối đa 5 điều **ổn định** mỗi người (bỏ câu đùa, chửi, đe doạ, lịch hẹn, số tiền). Kết quả thay cho các điều cũ của người đó, trừ những điều admin hoặc người dùng đã xoá.

Khi có người hỏi chuyện cũ, `SEARCH_CHAT_HISTORY` chạy song song tìm theo từ khoá (để có câu gốc và tin hôm nay chưa nạp) và hỏi ngữ cảnh từ Cognee, rồi đưa cả hai cho LLM trả lời, kèm ngày và người nói. Cognee tắt hoặc lỗi thì chỉ còn tìm theo từ khoá như bản cũ.

## 5. Cài đặt và vận hành

- Service `cognee` dùng image `cognee/cognee:1.6.5`, không mở cổng ra ngoài, dữ liệu nằm trong volume `zalobot-cognee`. Không đổi image Postgres chính, vì chuyển từ bản alpine sang bản có pgvector (Debian) có thể lệch collation và làm hỏng index chữ.
- Embedding chạy ngay trong container (model đa ngôn ngữ `paraphrase-multilingual-MiniLM-L12-v2`), không cần key.
- Khoá env (khai báo trong `.env.production`, xem [quy tắc env](../../global/environment-guard.md)):
  - `COGNEE_USER_PASSWORD`: mật khẩu tài khoản dịch vụ; để trống là tắt Cognee.
  - `COGNEE_JWT_SECRET`: bí mật ký token của Cognee; thiếu thì token hỏng mỗi lần Cognee khởi động lại.
  - `COGNEE_LLM_PROVIDER` (mặc định `custom`), `COGNEE_LLM_ENDPOINT` (`…/v1`), `COGNEE_LLM_MODEL` (`openai/<model>`), `COGNEE_LLM_API_KEY`: LLM Cognee dùng để dựng graph. Toàn bộ chat từng ngày của kênh bật "Nhớ lâu dài" được gửi tới đây.
  - `COGNEE_URL` do compose đặt cố định là `http://cognee:8000`; chạy API ngoài Docker thì tự khai báo.
- Trạng thái nạp hiện trên thẻ "Nhớ lâu dài": ngày đã nạp gần nhất, số ngày lỗi.
- **Giao diện Cognee**: vào `https://zalobot.datintech.site/cognee`, trang này chuyển sang `https://cognee-zalobot.datintech.site` (biến `COGNEE_UI_HOST`).
  - Đăng nhập UI bằng `zalobot@example.com` + `COGNEE_USER_PASSWORD`. Đây là lớp bảo vệ duy nhất: theo quyết định của anh Đạt ngày 26/10/2026, nginx không có Basic Auth.
  - UI là service `cognee-ui` (image chính thức `cognee/cognee-ui:1.6.5`). Nó không chạy được dưới đường dẫn `/cognee/` vì không có basePath, và đăng nhập bằng cookie gắn theo host, nên UI và API Cognee cùng nằm trên subdomain riêng: `/` là UI, `/api/` là API, cùng một origin nên không vướng CORS.
  - Tài khoản này là superuser: ai đăng nhập được là xem và xoá được trí nhớ của mọi kênh.
  - Tunnel trỏ `cognee-zalobot.datintech.site` vào cổng **3006** của máy chủ (`COGNEE_UI_PORT`). Nginx của `web` nghe riêng cổng này cho UI Cognee. Tên host chỉ một cấp để chứng chỉ SSL miễn phí của Cloudflare (`*.datintech.site`) phủ được; `cognee.zalobot.datintech.site` là hai cấp nên không được phủ.
  - Các trang Activity, Analytics, Memory Coverage chỉ có trên Cognee Cloud; Datasets, Search, Graph dùng được.
- **API Cognee trên domain chính**: `https://zalobot.datintech.site/cognee/api/v1/...` (cần đăng nhập Cognee), ví dụ:
    ```bash
    curl https://zalobot.datintech.site/cognee/api/v1/auth/login -d 'username=zalobot@example.com&password=<COGNEE_USER_PASSWORD>'
    ```
- Bảo vệ chung: thiếu `COGNEE_UI_HOST` thì mọi đường vào Cognee đều trả 404 (mặc định đóng); `/api/v1/auth/register` luôn trả 403, vì người lạ tự đăng ký được thì sẽ đốt key LLM; Cognee hoặc UI tắt thì trả 502, trang web vẫn chạy.

## 6. Trang cấu hình kênh

Cột phải có nhóm "🧠 Trí nhớ" gồm: 📌 Ghi nhớ, 💬 Nhớ đoạn chat gần đây (công tắc, số tin, số ngày), 🧠 Nhớ lâu dài (công tắc, cảnh báo quyền riêng tư, cách hoạt động, công tắc "Tự học về mọi người", trạng thái nạp, danh sách "Bot đã học" có nút xoá, mục "Nâng cao" chứa số kết quả mỗi lần tra), 🖼️ Đọc chữ trong ảnh. Trên điện thoại hiển thị một cột.

Cấu hình kênh (`chatMemory`): `enabled`, `shortTermEnabled`, `contextWindow` (1–30, mặc định 10), `shortTermDays` (1–7, mặc định 1), `searchLimit` (1–50, mặc định 15), `readImageText` (mặc định bật), `learnPeople` (mặc định bật). Cấu hình cũ chưa có `learnPeople` được coi là bật.

## 7. Đọc chữ trong ảnh

Không đổi cách đọc: OCR Tesseract chạy trên server, lần lượt từng ảnh, tối đa 20 ảnh chờ, có lọc rác. Khác ở chỗ chữ đọc được giờ ghi vào **đúng một dòng** của tin ảnh, nên cả hai trí nhớ cùng dùng (cửa sổ gần đây chỉ lấy 500 ký tự đầu). Ảnh không bao giờ được gửi cho AI. Kênh hay gửi giấy tờ cá nhân thì tắt công tắc này.

## 8. Quyền riêng tư

- Bot lưu tin của **mọi thành viên** kênh đang listen, kể cả người không dùng bot.
- Mỗi lượt trả lời: Ghi nhớ, điều tự học (tối đa 15 dòng), vài tin gần nhất (tối đa 30) được gửi cho LLM.
- Khi hỏi chuyện cũ: tối đa 80 dòng tìm được và ngữ cảnh Cognee.
- **Mỗi đêm**: toàn bộ chat trong ngày của kênh bật "Nhớ lâu dài" được gửi tới LLM của Cognee. Anh Đạt đã chấp nhận dùng 9router cho việc này (có thể là model miễn phí của bên thứ ba). Muốn giữ dữ liệu nội bộ thì trỏ `COGNEE_LLM_*` vào Qwen/Ollama local.

## 9. Kiểm thử

- Unit test: `npm run test --workspace @zalobot/api`. Các file chính:
  - `zca/memory/chat-memory.service.spec.ts`, `memory-text.util.spec.ts`, `short-term-memory.service.spec.ts`, `image-text-memory.service.spec.ts`
  - `zca/memory/long-term/cognee.client.spec.ts`, `memory-ingest.service.spec.ts`
  - `zca/confirmation/confirmed-action-memory.spec.ts` (chỉ ghi khi thành công)
  - `zca/text/strategies/remember-note-tool.strategy.spec.ts`, `search-chat-history-tool.strategy.spec.ts`
  - `zca/text/text-input.service.spec.ts` (Ghi nhớ nằm ngay sau câu danh tính)
- Web: `apps/web/src/modules/zca/model/channel-memory.spec.ts`.
- Thử tay:
  1. Trong nhóm: "@bot tao dặn rồi mày là con mèo đen 2 mái" → duyệt thẻ → hỏi "@bot mày là con gì" sau vài chục tin.
  2. Ghi một khoản chi rồi huỷ thẻ: `SELECT memory_kind, text FROM zca_messages WHERE channel_id = '<id>' ORDER BY sent_at DESC LIMIT 10;` không có dòng `action`. Duyệt một khoản khác thì có dòng `action` "(đã duyệt) …".
  3. Có Cognee: chạy job thủ công (đợi 03:00 hoặc thêm job `nightly` vào queue `chat-memory`), xem bảng `zca_memory_ingestions` và danh sách "Bot đã học".

## 10. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp |
| --- | --- |
| Bot vẫn quên lời dặn | Lời dặn chưa được duyệt thành Ghi nhớ (xem danh sách 📌), hoặc đã bị xoá |
| Thẻ "Nhớ lâu dài" ghi "Máy chủ chưa bật Cognee" | Chưa đặt `COGNEE_USER_PASSWORD` cho API, hoặc thiếu `COGNEE_URL` khi chạy ngoài Docker |
| `zca_memory_ingestions` toàn `failed` | LLM của Cognee không gọi được (sai endpoint/model/key). Log API `[Cognee] POST /remember failed …`; log container `cognee` ghi lỗi chi tiết |
| Cognee báo `LLM connection test timed out` | Endpoint LLM không truy cập được từ container, hoặc model đã ngừng phục vụ |
| "Bot đã học" có điều sai | Xoá điều đó trên dashboard hoặc nói "@bot quên vụ … đi"; điều đã xoá không được học lại |
| Bot không hiểu câu nối tiếp | Chưa bật "Nhớ đoạn chat gần đây", hoặc tin trước đã cũ hơn số ngày cấu hình |
| Câu hỏi chuyện cũ chỉ trò chuyện | Chưa bật "Nhớ lâu dài" (tool tra cứu không được đưa cho AI) |
