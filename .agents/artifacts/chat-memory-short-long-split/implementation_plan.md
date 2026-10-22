# Kế hoạch: Tách trí nhớ ngắn hạn và dài hạn thành hai tính năng độc lập

Route: implement · Phase 1 (Planning) · Rủi ro: TRUNG BÌNH (đổi contract `ThreadChatMemoryConfig`, luồng xử lý tin nhắn ở API, UI cấu hình kênh; không có migration)

## Vấn đề

Card "🧠 Trí nhớ hội thoại" có **một công tắc chính**. Tắt nó là tắt luôn cả "Hiểu câu nối tiếp", vì:

- `toAgentChatMemory` (`zca-bot-feature.service.ts`) trả `undefined` khi `chatMemory.enabled = false`, nên text pipeline không nhận được `contextWindow`.
- Cửa sổ ngữ cảnh đọc từ bảng `zca_messages` (`ChatMemoryService.getRecentWindow`), mà bảng chỉ được ghi khi `enabled = true`.

Mong muốn: hai loại trí nhớ bật/tắt riêng.

| | Trí nhớ ngắn hạn | Trí nhớ dài hạn |
| --- | --- | --- |
| Mục đích | Hiểu câu nối tiếp khi chat liên tục | Tra lại chuyện cũ ("hôm trước Nam nói gì?") |
| Chạy khi | Mọi lượt bot trả lời | Khi LLM gọi `SEARCH_CHAT_HISTORY` |
| Dữ liệu | Vài chục tin gần nhất, **tự hết hạn** | Toàn bộ tin, lưu lâu dài |
| Nơi lưu | Redis (mới) | Postgres `zca_messages` (giữ nguyên) |

## Thiết kế

### 1. Contract (`packages/contracts/src/index.ts`)

```ts
export interface ThreadChatMemoryConfig {
  /** Trí nhớ dài hạn: lưu tin vào Postgres và cho phép tra lại chuyện cũ. Giữ tên cũ để dữ liệu cũ đọc được. */
  enabled: boolean;
  /** Trí nhớ ngắn hạn: gắn các tin gần nhất vào prompt. */
  shortTermEnabled: boolean;
  /** Số tin gần nhất của trí nhớ ngắn hạn (1–30). */
  contextWindow: number;
  searchLimit: number;
}
```

- `normalizeChatMemoryConfig`:
  - Có `shortTermEnabled` kiểu boolean thì dùng.
  - Dữ liệu cũ chưa có trường này → `shortTermEnabled = enabled && contextWindow > 0`. Hành vi kênh hiện tại **giữ nguyên**: kênh đang bật trí nhớ vẫn có ngữ cảnh, kênh đang tắt vẫn không có.
  - `contextWindow` thành 1–30 (0 cũ → mặc định 10, vì đã có `shortTermEnabled` để tắt).
- `CHAT_MEMORY_DEFAULTS.shortTermEnabled = false`: kênh mới không gửi tin của ai cho AI khi admin chưa bật.
- Cột `zca_thread_configs.chat_memory` là jsonb, nên **không cần migration**.

### 2. Kho trí nhớ ngắn hạn (API, mới)

`apps/api/src/zca/memory/short-term-memory.service.ts`, đăng ký trong `ChatMemoryModule`:

- Redis list `zca:short_memory:<threadId>`, mỗi phần tử là `{ msgId, cliMsgId, senderUid, senderName, isBot, text, sentAt }`. `text` dựng bằng `buildMemoryText`, nên ảnh hiện là `[Ảnh] …` giống trí nhớ dài hạn.
- Giữ tối đa `CHAT_MEMORY_LIMITS.CONTEXT_WINDOW_MAX` (30) tin (`ltrim`). **Hết hạn sau 24 giờ** kể từ tin cuối (`expire`). Chat mới cách đó hơn một ngày thì không kéo theo chuyện cũ.
- Redis không sẵn sàng thì dùng Map trong bộ nhớ (cùng cách `bufferRecentMessage` đang làm).
- `getRecent(threadId, limit, excludeMsgId)` trả `MemoryLine[]` cũ → mới, để `formatMemoryLine` dùng lại được.
- `markRecalled(threadId, msgId, byClient?)` bỏ tin bị thu hồi khỏi list (đọc, lọc, ghi lại; list ≤30 phần tử). Cần thêm `del` (hoặc `lrem`) vào `RedisService` nếu chưa có.
- Không bao giờ throw, chỉ log warn (giống `ChatMemoryService`).

Không dùng lại `zca:buffered_msgs`: bộ đệm đó phục vụ quét media và nạp lại trí nhớ dài hạn, không có tin bot gửi, không xoá tin thu hồi và giữ 7 ngày.

### 3. Luồng ghi / đọc (API)

| Chỗ | Thay đổi |
| --- | --- |
| `zca-bot-feature.service.ts` `toAgentChatMemory` | Tách thành `{ shortTerm?: { contextWindow }, longTerm?: { searchLimit } }`, mỗi phần chỉ có khi phần tương ứng bật. |
| `ZcaBotFeatureService.onMessage` | `shortTermEnabled` → `shortTermMemory.record(...)`; `enabled` → `chatMemoryService.record(...)` như cũ. |
| `ZcaService.recordBotReplyInMemory` | Ghi tin bot vào kho tương ứng với từng phần đang bật. |
| `ZcaBotFeatureService.onUndo`, `ZcaService.undo` | Gọi thêm `shortTermMemory.markRecalled` (luôn gọi, như trí nhớ dài hạn). |
| `AgentInput` (`types/agent-input.type.ts`) | `chatMemory?: { contextWindow; searchLimit }` → `shortTermMemory?: { contextWindow }` + `longTermMemory?: { searchLimit }`. |
| `TextInputService.buildRecentContextBlock` | Đọc từ `ShortTermMemoryService.getRecent` theo `input.shortTermMemory`; header cấm gọi tool giữ nguyên. |
| `textToolDefinitionsFor`, dòng prompt `SEARCH_CHAT_HISTORY`, `SearchChatHistoryToolStrategy` | Gate theo `input.longTermMemory`. |
| `ChatMemoryService.getRecentWindow` | Bỏ (không còn ai dùng). |

### 4. UI cấu hình kênh (web)

Thay một card bằng **hai card độc lập**, mỗi card có công tắc riêng, đặt cạnh nhau ở cột phải:

```
💬 Trí nhớ ngắn hạn                                        [công tắc]
   Nhớ vài tin gần nhất để bot hiểu "còn cái kia?", "ghi giúp cái đó"
   ⚠ Tin gần nhất của mọi người trong kênh được gửi cho AI ở mỗi lượt; tự xoá sau 24 giờ.
   [Số tin gần đây: 10]

🧠 Trí nhớ dài hạn                                         [công tắc]
   Lưu tin nhắn của kênh để hỏi lại chuyện cũ, ví dụ "@bot hôm trước Nam nói gửi file gì?"
   ⚠ Bot lưu mọi tin nhắn của kênh, kể cả của người không dùng bot. Tắt thì ngừng lưu và ngừng tra cứu, tin đã lưu vẫn được giữ.
   [Số kết quả mỗi lần tra: 15]
```

- `chat-memory-section.tsx` → tách thành `short-term-memory-section.tsx` và `long-term-memory-section.tsx` (dùng lại `ConfigSectionCard`, `ConfigField`).
- Bỏ `contextWindowAfterToggle` cùng test của nó (commit `9066bed`), vì đã có công tắc riêng.
- Ô "Số tin gần đây" `min = 1`.
- Cột "Tính năng" của bảng kênh (`chat-row-parts.tsx`): `Nhớ` cho dài hạn như cũ, thêm `Ngữ cảnh` cho ngắn hạn.

## Test

- `packages/contracts`: normalize dữ liệu cũ (có/không `enabled`, `contextWindow = 0`) ra đúng `shortTermEnabled`; giữ trường mới khi có.
- API:
  - `short-term-memory.service.spec.ts`: ghi, giới hạn 30, lọc `excludeMsgId`, thu hồi, fallback khi Redis không sẵn sàng.
  - Cập nhật `zca-bot-feature.service.spec.ts`: chỉ bật ngắn hạn → ghi Redis, không ghi Postgres.
  - Cập nhật `text-input.service.spec.ts`: chỉ bật ngắn hạn → có khối ngữ cảnh, không có tool `SEARCH_CHAT_HISTORY`; chỉ bật dài hạn → ngược lại.
  - Cập nhật `search-chat-history-tool.strategy.spec.ts`, `thread-config.service.spec.ts`.
- Web: `thread-config-form.spec.ts` (payload gửi đủ `shortTermEnabled`).
- Chạy `npm run test`, `npm run typecheck`, `npm run lint` cho `@zalobot/contracts`, `@zalobot/api`, `@zalobot/web`.
- Kiểm tra trên trình duyệt nếu dev server chạy được (đang bị lỗi `EPERM uv_cwd`), không thì báo rõ là chưa kiểm.

## Docs

- `.agents/knowledge/modules/zca/chat-memory.md` (EN) và `.agents/docs/modules/zca/chat-memory.md` (VI): mô tả hai loại trí nhớ, kho Redis, TTL 24 giờ, cách đọc dữ liệu cũ.
- `.agents/knowledge/global/local-first-ai-usage.md` và bản docs tương ứng: ngoại lệ gửi dữ liệu cho AI nay gồm hai công tắc riêng.
- `CONTEXT.md`: cập nhật mục "Trí nhớ hội thoại" và "Cửa sổ ngữ cảnh ngắn hạn".
- `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## Cần anh quyết

1. **Thời hạn trí nhớ ngắn hạn**: em đề xuất 24 giờ. Nếu muốn bot vẫn nối được chuyện từ hôm qua sang hôm nay thì có thể để 3 hoặc 7 ngày.
2. **Mặc định cho kênh mới**: em đề xuất tắt cả hai, admin tự bật. Nếu muốn kênh mới bật sẵn trí nhớ ngắn hạn thì báo em.
