# Implementation plan: Gọn cấu hình Trí nhớ của kênh

Risk: MEDIUM (đổi contract `ChatMemoryConfig`, hành vi bot, nhiều file api/web/contracts; không có migration DB).

## Quyết định của anh

1. **Ghi nhớ**: bỏ phần UI trên FE.
2. **Trí nhớ ngắn hạn**: xoá hẳn tính năng và cấu hình. Luồng `yes/cancel <code>` và tin bổ sung dùng danh sách thẻ chờ trong Redis (TTL 5 phút).
3. **Số kết quả mỗi lần tra**: để agent tự quyết định, bỏ khỏi cấu hình.

## Đã kiểm tra

- Luồng sửa/bổ sung thẻ chờ **không** dùng trí nhớ ngắn hạn. `AMEND_PENDING` đọc thẻ chờ của người nhắn (`apps/api/src/zca/text/amend-pending.tool.ts`). `yes/cancel <code>` đi qua `TransactionConfirmationService`. Xoá trí nhớ ngắn hạn không làm hỏng xác nhận.
- Trí nhớ ngắn hạn chỉ là `loadRecentLines` trong `text-input.service.ts`. Hàm này đọc vài tin gần nhất từ `zca_messages`, theo `contextWindow` và `shortTermDays`.
- `shortTermEnabled` hiện cũng bật ba việc khác: lưu tin vào `zca_messages` (`zca.service.ts:657`), ghi thao tác đã duyệt (`memory/action-memory.ts:32`) và đọc chữ trong ảnh (`zca-bot-feature.service.ts:837/845`, `image-text-memory.service.ts:72`).
- `chatMemory` là cột JSON và `normalizeChatMemoryConfig` (contracts) là chỗ duy nhất làm sạch nó. Bỏ field thì chỉ cần sửa normalizer. Key cũ trong DB tự bị bỏ qua, không cần migration.

## Thay đổi

### 1. Bỏ UI Ghi nhớ (FE)
- Bỏ `<ChannelNotesSection>` khỏi `thread-config-form.tsx`. Xoá `channel-notes-section.tsx`.
- Xoá code FE không còn ai dùng: `getThreadNotes`/create/update/delete trong `zca-api.ts`, `useThreadNotesQuery` và `useThreadNoteMutations` trong `zca-query.ts`, `noteTextError` cùng test của nó trong `channel-memory(.spec).ts`.
- **Backend giữ nguyên.** Bot vẫn nhớ và quên qua chat, ghi nhớ vẫn vào prompt. API `zcaThreadNotes` của controller vẫn còn nhưng FE không gọi nữa.
- Hệ quả: admin không còn xem, sửa, xoá ghi nhớ trên dashboard. Chỉ quản lý được trong chat ("nhớ nhé…", "quên vụ … đi").

### 2. Xoá trí nhớ ngắn hạn
- **contracts**: bỏ `shortTermEnabled`, `contextWindow` và `shortTermDays` khỏi `ChatMemoryConfig`, `CHAT_MEMORY_DEFAULTS` và `CHAT_MEMORY_LIMITS`. Normalizer bỏ nhánh tương thích `contextWindow: 0`.
- **api**:
  - `AgentInput.shortTermMemory`: xoá. `zca-bot-feature.service.ts` thôi truyền nó.
  - `text-input.service.ts`: xoá `loadRecentLines` và block "ngữ cảnh gần đây" trong prompt. `buildProfileBlock` chỉ lấy người gửi và người được tag (trước đây lấy thêm người trong cửa sổ gần đây).
  - Xoá `ShortTermMemoryService` và đăng ký của nó trong `chat-memory.module.ts`. Nếu `formatRecentContextBlock` và `ChatMemoryService.getRecent` không còn ai dùng thì xoá luôn.
  - Lưu tin, ghi thao tác đã duyệt và đọc chữ trong ảnh: chỉ còn chạy khi `chatMemory.enabled` (nhớ lâu dài). `ImageTextJob.shortTermDays` bị xoá.
- **web**:
  - Xoá `short-term-memory-section.tsx` và bỏ nó khỏi form.
  - `ChatMemoryDraft` bỏ `contextWindow` và `shortTermDays` (`thread-config-form.ts`).
  - Bỏ nhãn "Ngữ cảnh" ở `chat-row-parts.tsx:141`.
  - `image-text-memory-section.tsx` chỉ xét `memory.enabled`.
- Hệ quả:
  - Bot không còn hiểu câu nối tiếp dựa vào tin trước, ví dụ "còn cái kia?". Mỗi tin được xử lý riêng, trừ khi đó là tin bổ sung cho thẻ đang chờ.
  - Kênh đang bật ngắn hạn mà tắt dài hạn sẽ thôi lưu tin vào `zca_messages`. Tin đã lưu vẫn còn.

### 3. Số kết quả tra do agent tự quyết
- Tool `SEARCH_CHAT_HISTORY` (`text-tool.definitions.ts`) có thêm tham số không bắt buộc `limit` (NUMBER), mô tả: câu hỏi rộng hoặc cần liệt kê thì tăng, câu hỏi cụ thể thì giảm.
- Strategy đọc `limit`, giới hạn trong `CHAT_MEMORY_LIMITS.SEARCH_LIMIT_MIN..MAX` (1–50), mặc định 15 khi agent không truyền. Trần 80 dòng gửi cho AI giữ nguyên.
- Bỏ `searchLimit` khỏi `ChatMemoryConfig` và `CHAT_MEMORY_DEFAULTS`. `AgentInput.longTermMemory` đổi thành cờ bật/tắt (vẫn dùng để báo "Kênh này chưa bật ghi nhớ…").
- web: bỏ mục "Nâng cao" và field `searchLimit` khỏi `long-term-memory-section.tsx` và `ChatMemoryDraft`. Nếu draft không còn field số nào thì bỏ luôn `ChatMemoryDraft`, `onDraftChange`, `onDraftCommit` và `resolveChatMemory` cùng phần nối dây trong `use-thread-config-form.ts`.

### Ngoài phạm vi
- Default của cột trong `zca-thread-config.entity.ts` vẫn nhắc `contextWindow`/`searchLimit`. Không sửa vì đổi default cần migration; normalizer đã bỏ qua các key đó.
- `dist/` không sửa tay.

## Tests
- Sửa các test đang dùng field cũ: `thread-config.service.spec.ts`, `zca-bot-feature.service.spec.ts`, `text-input.service.spec.ts`, `image-text-memory.service.spec.ts`, `confirmed-action-memory.spec.ts`, `remember-note-tool.strategy.spec.ts`, `search-chat-history-tool.strategy.spec.ts`, `web thread-config-form.spec.ts`, `channel-memory.spec.ts`. Xoá `short-term-memory.service.spec.ts`.
- Thêm test cho strategy: dùng `limit` của agent, giới hạn trong 1–50, mặc định 15 khi không có.
- Thêm test cho normalizer: bỏ key cũ.
- Chạy `npm run typecheck`, `npm run lint`, `npm run test`, sau đó `npm run build --workspace @zalobot/web`.

## Tài liệu (completion gate)
- `.agents/knowledge/modules/zca/chat-memory.md`, `README.md` và `global/local-first-ai-usage.md` (EN).
- `.agents/docs/modules/zca/chat-memory.md`, `README.md`, `global/zalo-command-intake.md` và `global/local-first-ai-usage.md` (VI). Cập nhật `.agents/docs/README.md` nếu bảng mapping thay đổi.
- `CONTEXT.md`:
  - Xoá mục "Trí nhớ ngắn hạn".
  - "Trí nhớ hội thoại" chỉ còn Ghi nhớ, dài hạn và điều tự học.
  - "Ghi nhớ" bỏ câu "admin xem, sửa, xoá được trên trang cấu hình kênh".
  - "Chữ trong ảnh" chỉ phụ thuộc trí nhớ dài hạn.
- Chạy `node .claude/hooks/docs-drift-check.mjs` cho tới khi exit 0.

## Câu hỏi mở
- Mục 1: có xoá luôn API ghi nhớ ở backend (`GET/POST/PATCH/DELETE zcaThreadNotes`) không? Plan hiện giữ lại để sau này cần thì làm lại UI.
