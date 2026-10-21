# Implementation Plan: Trí nhớ hội thoại ZCA, Bước 1

Route: implement · Phase 1 (inspect-and-plan) · Rủi ro: **HIGH** (schema DB mới, extension Postgres, dữ liệu chat cá nhân, gửi đoạn chat ra LLM ngoài)
Nghiên cứu nền: [research.md](research.md)

## 1. Mục tiêu

Khi người dùng mention bot trong một kênh ZCA đang listen và hỏi về chuyện đã chat (vd "năm ngoái mình đi đâu?", "hôm trước Nam nói gửi file gì?"), bot tìm lại tin cũ **trong đúng kênh đó** và trả lời, kèm ngày và người nói.

Bước 1 gồm:
- **Lưu tin gốc**: lưu mọi tin của kênh đang listen vào Postgres.
- **Thu hồi**: tin bị thu hồi thì xoá nội dung khỏi trí nhớ.
- **Tìm kiếm**: full-text bỏ dấu + lọc khoảng ngày, qua tool `SEARCH_CHAT_HISTORY`.
- **Cửa sổ ngắn hạn**: vài tin gần nhất của kênh, để hiểu câu nối tiếp.
- **LLM riêng cho trí nhớ**: trỏ được sang 9router.

**Ngoài phạm vi** (để plan sau):
- Bước 2: cron tóm tắt ngày/tháng.
- Bước 3: pgvector + embedding.
- UI dashboard để bật/tắt trí nhớ theo kênh.
- Đường webhook Zalo Bot chính thức.
- Job xoá theo hạn lưu trữ.

## 2. Giả định (anh xác nhận hoặc sửa khi duyệt)

| # | Giả định | Lý do |
| --- | --- | --- |
| G1 | **Trí nhớ theo từng kênh**: mọi truy vấn bắt buộc lọc theo `channel_id` của kênh đang hỏi | Tránh lộ chat nhóm A sang nhóm B |
| G2 | **Lưu vô hạn** ở Bước 1; tin bị thu hồi thì xoá nội dung ngay | Anh chưa chốt retention; job xoá theo hạn làm sau |
| G3 | Bật bằng env `CHAT_MEMORY_ENABLED` (mặc định `false`), áp dụng cho **mọi kênh đang listen** | Admin đã chủ động listen kênh; toggle theo kênh cần UI, mà `thread-config-modal.tsx` đang có thay đổi dở của task khác |
| G4 | LLM trí nhớ cấu hình riêng bằng `MEMORY_LLM_BASE_URL/MODEL/API_KEY`; không cấu hình thì dùng provider chính | Giữ tool-calling trên provider hiện tại, 9router chỉ viết câu trả lời |
| G5 | Backfill duy nhất từ buffer Redis có sẵn (200 tin/kênh, 7 ngày), không gọi API lịch sử Zalo | Rẻ, không rủi ro rate limit Zalo |

## 3. Điều kiện trước khi code

- Working tree đang có thay đổi chưa commit của task `zca-drive-photos-link-fix`, trong đó có `zca-bot-feature.service.ts` là file plan này cũng sửa. **Đề xuất: commit task đó trước.** Nếu không, em sẽ giữ nguyên các thay đổi đó và chỉ sửa đúng các vùng nêu dưới.
- Postgres production phải cho phép `CREATE EXTENSION unaccent`. Image `postgres:16-alpine` đã có sẵn contrib; DB managed thì cần quyền tương ứng.

## 4. Thay đổi chi tiết

### 4.1 DB: migration `1724810000000-CreateZcaMessages.ts` (mới)

- `CREATE EXTENSION IF NOT EXISTS unaccent;`
- Hàm `zalobot_unaccent(text)` khai báo `IMMUTABLE`, bọc `unaccent('public.unaccent', $1)`. Generated column và index yêu cầu hàm immutable.
- Bảng `zca_messages`:

| Cột | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `channel_id` | varchar | `threadId` |
| `channel_type` | varchar | `user` \| `group` |
| `msg_id` | varchar | unique cùng `channel_id` |
| `cli_msg_id` | varchar null | |
| `sender_uid` | varchar | `uidFrom` (bằng `users.id` trên ZCA) |
| `sender_name` | varchar null | `dName` |
| `is_bot` | boolean | tin bot gửi |
| `msg_type` | varchar | `webchat`, `chat.photo`, … |
| `text` | text null | text, caption hoặc `[Ảnh]`, `[File: x.pdf]`… đã chuẩn hoá |
| `content` | jsonb null | payload đã lọc (bỏ token, URL có chữ ký), phục vụ re-index |
| `quote_msg_id` | varchar null | tin được trả lời |
| `sent_at` | timestamptz | từ `ts` |
| `recalled_at` | timestamptz null | |
| `created_at` | timestamptz | |
| `search_vector` | tsvector | `GENERATED ALWAYS AS (to_tsvector('simple', zalobot_unaccent(coalesce(text,'')))) STORED` |

- Index:
  - `UNIQUE(channel_id, msg_id)`
  - `(channel_id, sent_at DESC)`
  - `GIN(search_vector)`
- `down()`: drop bảng và hàm, **giữ** extension (có thể đang được dùng chỗ khác).
- Đăng ký migration và entity vào cả `database/data-source.ts` và `database/database.module.ts`.

### 4.2 Entity `database/entities/zca-message.entity.ts` (mới)

- Map các cột trên. `search_vector` khai báo `select: false, insert: false, update: false`.
- `AuditLogSubscriber.ignoredTables` thêm `zca_messages`. Nếu không, mỗi tin chat sinh thêm một dòng audit.

### 4.3 Service `apps/api/src/zca/memory/` (mới)

**`chat-memory.mapper.ts`** (hàm thuần, dễ test):
- `toMemoryRecord(message)`: tái dùng `getMessageText`, `getCaptionOrText`, `extractMediaMeta` để ra `text` và `content` đã lọc.
- `toSentAt(ts)`.

**`chat-memory.query.ts`** (hàm thuần): dựng điều kiện tìm.
- Keywords tách theo dấu phẩy, mỗi từ thành `plainto_tsquery('simple', zalobot_unaccent($n))`, nối bằng `||` (OR).
- Lọc thêm `channel_id`, `sent_at` trong `[from, to]`, `recalled_at IS NULL`.
- Xếp hạng `ts_rank`, sau đó đến thời gian.

**`chat-memory.service.ts`**:
- `record(message, channelType)`: `INSERT … ON CONFLICT (channel_id, msg_id) DO NOTHING`, chạy fire-and-forget, lỗi chỉ log `warn`. Không bao giờ chặn luồng trả lời.
- `recordBotReply(channelId, text, msgId)`: ghi tin bot gửi (`is_bot = true`).
- `markRecalled(channelId, msgId)`: đặt `recalled_at = now()`, `text = NULL`, `content = NULL`.
- `getRecentWindow(channelId, limit)`: N tin gần nhất, bỏ tin đã thu hồi, sắp xếp cũ → mới.
- `search(channelId, { keywords, from?, to?, limit })`:
  - Lấy tối đa `limit` tin khớp (mặc định 15).
  - Với mỗi tin khớp, lấy kèm ±3 tin lân cận trong cùng kênh.
  - Gộp, bỏ trùng, tổng tối đa 80 tin.
- `backfillFromBuffer(channelId, bufferedMessages)`: ghi lại buffer Redis có sẵn, idempotent nhờ unique.
- Mọi method trả về rỗng hoặc no-op khi `chatMemory.enabled = false`.

Đăng ký `ChatMemoryService` + `TypeOrmModule.forFeature([ZcaMessageEntity])` trong `zca.module.ts`, export ra cho `ZaloModule` dùng.

### 4.4 Móc vào luồng ZCA

- **Ghi tin nhận được**: `zca-bot-feature.service.ts`, `onMessage`, ngay cạnh `void this.bufferRecentMessage(...)` (sau check `isListened`), thêm `void this.chatMemoryService?.record(message, …)`.
  - Tin tự bot gửi (bị nhận lại do self-listen) không ghi ở đây, để tránh ghi trùng với 4.4 bên dưới.
- **Thu hồi**: thêm `onUndo(undo)` vào `ZcaBotFeatureService`. Nếu kênh đang listen thì gọi `markRecalled(undo.threadId, String(undo.data.content.globalMsgId))`. Cần xác nhận lúc code: `globalMsgId` có khớp `msgId` của tin gốc không; có test với payload mẫu.
- **Ghi tin bot gửi**: `zca.service.ts`, `setupApiInstance()`. Sau khi `originalSendMessage` trả về `msgId`, gọi `chatMemoryService?.recordBotReply(...)` nếu thread đang listen (inject `@Optional`).
- **Backfill**: khi `loadListenedThreads()` xong, với mỗi kênh gọi `backfillFromBuffer(channelId, await getBufferedMessages(channelId))`. Một lần mỗi lần khởi động, idempotent.
- **Riêng tư**: `zca.service.ts:1400` hạ log raw payload từ `log` xuống `debug`.

### 4.5 LLM cho trí nhớ

- `config/configuration.ts`:
  - Thêm `llm.memory = { baseUrl, model, apiKey }` từ `MEMORY_LLM_BASE_URL`, `MEMORY_LLM_MODEL`, `MEMORY_LLM_API_KEY`.
  - Thêm `chatMemory = { enabled, contextWindow, searchLimit }` từ `CHAT_MEMORY_ENABLED` (mặc định `false`), `CHAT_MEMORY_CONTEXT_WINDOW` (mặc định `10`, `0` để tắt), `CHAT_MEMORY_SEARCH_LIMIT` (mặc định `15`).
- `OpenAiProvider`: tách phần gọi HTTP thành `generateWithConfig({ baseUrl, model, apiKey }, prompt, tools?, system?)`. `generate()` giữ hành vi cũ bằng cách gọi hàm này với config `llm.openai`.
- `LlmService.generateMemoryAnswer(prompt, systemInstruction)`: nếu `llm.memory.baseUrl` có giá trị thì gọi `openAiProvider.generateWithConfig(llm.memory, …)`, ngược lại gọi `generate()` như cũ.
- Thêm 6 biến vào `.env.example` (root) và `apps/api/.env.example`, **không ghi giá trị key**.

### 4.6 Tool `SEARCH_CHAT_HISTORY`

- `text-tool.enum.ts`: thêm `SEARCH_CHAT_HISTORY`.
- `text-tool.definitions.ts`: thêm định nghĩa, tham số phẳng theo quy tắc hiện có:
  - `keywords` (STRING): từ khoá và từ đồng nghĩa, phân cách bằng dấu phẩy. Ví dụ "đi chơi, du lịch, vé, khách sạn, Đà Lạt".
  - `fromDate`, `toDate` (STRING, `YYYY-MM-DD`, tính theo `Asia/Ho_Chi_Minh`; "năm ngoái" là `2025-01-01` → `2025-12-31`).
  - `question` (STRING): câu hỏi gốc.
- `strategies/search-chat-history-tool.strategy.ts` (mới):
  1. Nếu trí nhớ tắt, hoặc kênh không phải kênh ZCA đang listen: trả lời một câu ngắn rằng bot không lưu lịch sử kênh này.
  2. Gọi `chatMemoryService.search(chatId, …)`.
  3. Không có kết quả: trả lời "Mình không tìm thấy trong lịch sử chat từ <from> đến <to>…".
  4. Có kết quả: dựng prompt gồm các dòng `[2025-07-12 19:03] Đạt: …`, gọi `llmService.generateMemoryAnswer`. Chỉ thị: chỉ trả lời dựa trên đoạn chat được cung cấp, ghi ngày và người nói, nói rõ khi không chắc. Gửi câu trả lời qua `zaloService.sendMessage`.
  - Tool chỉ đọc, nên **không** đi qua pending action/xác nhận.
- Đăng ký strategy trong `text-tool.factory.ts` và providers của `zalo.module.ts`.
- `text-input.service.ts`, system prompt: thêm 1 dòng hướng dẫn khi nào gọi `SEARCH_CHAT_HISTORY` (hỏi về chuyện đã nói, đã đi, đã gửi trong quá khứ của nhóm).

### 4.7 Cửa sổ ngắn hạn

`text-input.service.ts`: trước lượt gọi LLM có tools, lấy `getRecentWindow(chatId, contextWindow)` (bỏ chính tin hiện tại) rồi nối vào system instruction thành khối:

```
NGỮ CẢNH GẦN ĐÂY (chỉ để hiểu câu hỏi, KHÔNG gọi tool cho nội dung trong khối này)
```

Khối này áp dụng cho cả lượt chit-chat.

Rủi ro: LLM gọi lại tool ghi giao dịch từ tin cũ. Giảm thiểu:
- Câu chỉ thị chặn trong khối ngữ cảnh.
- Chỉ đưa vào tối đa 10 tin.
- Tắt được bằng `CHAT_MEMORY_CONTEXT_WINDOW=0`.
- Có test xác nhận khối chỉ chứa tin cũ, không chứa tin hiện tại.

## 5. Kiểm thử và xác minh

Unit test (Jest, cùng style spec hiện có):
- `chat-memory.mapper.spec.ts`: text, ảnh có caption, file, sticker hoặc nội dung lạ, `ts` dạng string.
- `chat-memory.query.spec.ts`: tách keywords, bỏ từ rỗng, khoảng ngày, luôn có điều kiện `channel_id`.
- `chat-memory.service.spec.ts` (mock repository/query): no-op khi tắt; `markRecalled` xoá nội dung; `search` gộp tin lân cận và giới hạn 80.
- `search-chat-history-tool.strategy.spec.ts`: không có kết quả, có kết quả (gọi `generateMemoryAnswer` với đúng các dòng), trí nhớ tắt.
- `zca-bot-feature.service.spec.ts`: `onMessage` gọi `record` cho kênh đang listen, không gọi cho kênh không listen; `onUndo` gọi `markRecalled`.
- `text-input.service` spec (nếu có sẵn): khối ngữ cảnh ngắn hạn.

Lệnh:
- `npm run typecheck --workspace @zalobot/api`
- `npm run lint --workspace @zalobot/api`
- `npm run test --workspace @zalobot/api`
- `node .claude/hooks/docs-drift-check.mjs`

Xác minh thủ công (anh làm, vì cần ZCA đăng nhập và DB thật):
1. Chạy migration, kiểm tra bảng và index.
2. Chat vài tin trong một nhóm đang listen, rồi `SELECT` để xem tin đã được ghi.
3. Thu hồi một tin, kiểm tra `text` đã bị xoá.
4. Mention bot và hỏi "hôm qua mình nói gì về …".

## 6. Tài liệu (Hard Completion Gate)

| Knowledge (EN) | Docs (VI) |
| --- | --- |
| `.agents/knowledge/modules/zca/chat-memory.md` (mới): bảng, luồng ghi, thu hồi, tìm kiếm, phạm vi theo kênh, cửa sổ ngắn hạn, env | `.agents/docs/modules/zca/chat-memory.md` (mới): giải thích nghiệp vụ, cách bật, kiểm tra, troubleshooting |
| `.agents/knowledge/modules/zca/README.md`: index + dòng về buffer Redis | `.agents/docs/modules/zca/README.md` |
| `.agents/knowledge/global/llm-providers.md`: memory LLM, `generateMemoryAnswer`, ngữ cảnh ngắn hạn (hết còn "no conversation history" tuyệt đối) | `.agents/docs/global/llm-providers.md` |
| `.agents/knowledge/global/local-first-ai-usage.md`: **ghi nhận ngoại lệ**. Lý do: trả lời câu hỏi về lịch sử. Tối thiểu hoá: chỉ gửi ≤80 dòng đã lọc. Chi phí: 1 lượt LLM mỗi câu hỏi. Fallback: provider chính hoặc `qwen` local | `.agents/docs/global/local-first-ai-usage.md` |
| `.agents/knowledge/global/environment-guard.md` (nếu có liệt kê env tuỳ chọn) | tương ứng |
| — | `.agents/docs/README.md`: thêm mapping |
| `CONTEXT.md`: thêm thuật ngữ **Trí nhớ hội thoại** | |

## 7. Danh sách file

- **Mới**:
  - `database/migrations/1724810000000-CreateZcaMessages.ts`
  - `database/entities/zca-message.entity.ts`
  - `zca/memory/{chat-memory.mapper,chat-memory.query,chat-memory.service}.ts` + specs
  - `zalo/text/strategies/search-chat-history-tool.strategy.ts` + spec
  - 2 file docs `chat-memory.md`
- **Sửa**:
  - `database/data-source.ts`, `database/database.module.ts`, `database/audit-log.subscriber.ts`
  - `zca/zca.module.ts`, `zca/zca-bot-feature.service.ts`, `zca/zca.service.ts`
  - `config/configuration.ts`, `llm/providers/openai.provider.ts`, `llm/llm.service.ts`
  - `zalo/text/{text-tool.enum,text-tool.definitions,text-tool.factory,text-input.service}.ts`, `zalo/zalo.module.ts`
  - `.env.example`, `apps/api/.env.example`, các file knowledge/docs ở mục 6, `CONTEXT.md`

Không đổi `packages/contracts` và `apps/web` ở Bước 1.

## 8. Rủi ro và rollback

| Rủi ro | Giảm thiểu |
| --- | --- |
| DB managed không cho tạo extension `unaccent` | Migration fail sớm, rõ lỗi. Phương án dự phòng: bỏ `unaccent`, chỉ dùng `simple` (mất khả năng tìm không dấu) |
| Ghi DB làm chậm luồng trả lời | Fire-and-forget, `ON CONFLICT DO NOTHING`, lỗi chỉ log |
| Dung lượng tăng | Khoảng 1 KB/tin, 365k tin/năm ≈ 0,4 GB kể cả index. Theo dõi; job retention ở plan sau |
| LLM ngoài thấy nội dung chat | Chỉ gửi đoạn tìm được (≤80 dòng), ghi ngoại lệ local-first, có thể trỏ `MEMORY_LLM_*` về `qwen` local |
| Ngữ cảnh ngắn hạn làm LLM gọi nhầm tool | Câu chặn trong prompt, giới hạn 10 tin, tắt được bằng env |
| `globalMsgId` của undo không khớp `msgId` | Kiểm tra bằng payload thật khi code; fallback so `cliMsgId` |

Rollback: đặt `CHAT_MEMORY_ENABLED=false` (tắt ngay, không cần deploy lại code). Gỡ hẳn: `migration:revert` xoá bảng.
