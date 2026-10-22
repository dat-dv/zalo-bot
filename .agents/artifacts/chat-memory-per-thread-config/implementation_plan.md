# Implementation Plan: Cấu hình trí nhớ hội thoại theo từng nhóm

Route: implement · Phase 1 (inspect-and-plan) · Rủi ro: **HIGH** (đổi contracts dùng chung, thêm cột DB, đổi hành vi lưu và đọc tin)

## 1. Mục tiêu

Bỏ hết 3 biến env `CHAT_MEMORY_ENABLED`, `CHAT_MEMORY_CONTEXT_WINDOW`, `CHAT_MEMORY_SEARCH_LIMIT`. Thay bằng nhóm cấu hình **`chatMemory` của từng kênh** (cùng chỗ với `directInteraction`, `mediaBackup`, `confirmationRules`), chỉnh trong modal "Cấu hình kênh" trên dashboard:

| Trường | Mặc định | Giới hạn | Ý nghĩa |
| --- | --- | --- | --- |
| `enabled` | `false` | | Kênh này có lưu và tra lại tin không |
| `contextWindow` | `10` | 0–30 | Số tin gần nhất đưa vào prompt (`0` = tắt riêng phần này) |
| `searchLimit` | `15` | 1–50 | Số tin khớp nhất mỗi lần tra |

Mặc định **tắt** cho mọi kênh, kể cả kênh đang listen. Admin bật riêng từng nhóm muốn bot nhớ.

## 2. Hiện trạng (đã khảo sát)

- Các nhóm cấu hình là cột `jsonb` trong `zca_thread_configs` (`zca-thread-config.entity.ts:23-44`). Kiểu dữ liệu nằm trong `packages/contracts/src/index.ts` (`ThreadBotConfig` :2322, `UpdateThreadBotConfigDto` :2339).
- `ThreadConfigService` (`apps/api/src/zca/thread-config.service.ts`):
  - mặc định ở `createDefaultThreadConfig` :119
  - map entity → config ở `entityToConfig` :160
  - chuẩn hoá cache cũ ở `normalizeCachedConfig` :109
  - merge từng nhóm ở `updateConfig` :573-585
  - liệt kê cột khi lưu ở `saveConfigToDb` :647
  - cache Redis 24h
- `PUT /api/zca/thread-configs/:threadId` nhận `UpdateThreadBotConfigDto` (type, không có class-validator), nên service phải tự chuẩn hoá giá trị.
- Modal `apps/web/src/modules/zca/view/thread-config-modal.tsx`:
  - giữ một state `ThreadBotConfig`
  - mỗi nhóm là một card có toggle (mẫu: `confirmationRules` :584-670)
  - `handleSave` gửi đủ mọi nhóm
- Badge cấu hình ở `chat-table-row.tsx:95-134`.
- Trí nhớ hiện bật/tắt **toàn cục** qua `ChatMemoryService.isEnabled()` (env). Các chỗ ghi/đọc:
  - `onMessage` (`zca-bot-feature.service.ts:808`)
  - `init` backfill (:1259)
  - `recordBotReply` (`zca.service.ts:648`)
  - `TextInputService.buildRecentContextBlock` (:409)
  - `SearchChatHistoryToolStrategy`

## 3. Thiết kế

### 3.1 Contracts (`packages/contracts/src/index.ts`)

- Thêm `interface ThreadChatMemoryConfig { enabled: boolean; contextWindow: number; searchLimit: number }`.
- Thêm `CHAT_MEMORY_DEFAULTS` và `CHAT_MEMORY_LIMITS` (`contextWindow` 0–30, `searchLimit` 1–50).
- Thêm hàm `normalizeChatMemoryConfig(value: unknown): ThreadChatMemoryConfig`: ép kiểu, làm tròn, kẹp trong giới hạn, thiếu thì lấy mặc định. API và web dùng chung hàm này.
- `ThreadBotConfig.chatMemory: ThreadChatMemoryConfig` (bắt buộc, giống các nhóm khác).
- `UpdateThreadBotConfigDto.chatMemory?: Partial<ThreadChatMemoryConfig>`.

### 3.2 DB

- Migration `1724820000000-AddChatMemoryToZcaThreadConfigs`: `ADD COLUMN IF NOT EXISTS "chat_memory" jsonb NOT NULL DEFAULT '{"enabled": false, "contextWindow": 10, "searchLimit": 15}'`. `down` drop cột.
- Entity thêm cột `chat_memory`. Đăng ký migration ở `data-source.ts` và `database.module.ts`.

### 3.3 `ThreadConfigService`

`chatMemory` đi qua `normalizeChatMemoryConfig` ở mọi chỗ đọc và ghi:
- default
- `entityToConfig`
- `normalizeCachedConfig` (cache Redis hoặc file JSON cũ chưa có khoá này)
- merge trong `updateConfig`
- danh sách cột trong `saveConfigToDb`

### 3.4 Chặn ghi/đọc theo kênh

`ChatMemoryService` bỏ `isEnabled`, `getContextWindowSize`, `getSearchLimit` và phụ thuộc `ConfigService`. Service chỉ còn làm việc với DB; **nơi gọi** quyết định có dùng trí nhớ không. Làm vậy để `ChatMemoryModule` không phải kéo `ZcaModule` vào, tránh vòng phụ thuộc.

| Chỗ | Điều kiện mới |
| --- | --- |
| `onMessage`: ghi tin | `config.chatMemory.enabled` (đã có `config` sẵn) |
| `onUndo`: xoá nội dung tin bị thu hồi | **Luôn chạy** khi có dữ liệu, kể cả kênh đã tắt trí nhớ, để tin đã lưu trước đó vẫn bị quên khi thu hồi |
| `init`: backfill | Chỉ các kênh listen có `chatMemory.enabled` (`findStoredConfig`) |
| `ZcaService`: ghi tin bot | Kênh listen và `findStoredConfig(threadId)?.chatMemory.enabled` |
| Cửa sổ ngắn hạn + tool tra cứu | `onMessage` gắn `chatMemory: { contextWindow, searchLimit }` vào `AgentInput` khi kênh bật (cả 2 bản `AgentInput`), không bật thì bỏ trống |
| `TextInputService` | Dùng `input.chatMemory?.contextWindow` |
| `SearchChatHistoryToolStrategy` | Dùng `context.input.chatMemory?.searchLimit`. Không có (kênh tắt, webhook, chat không listen) thì trả lời "Kênh này chưa bật ghi nhớ hội thoại, admin bật trong Cấu hình kênh trên dashboard." |

Bật trí nhớ cho một kênh: bot bắt đầu lưu từ lúc đó. Tin cũ trong buffer Redis (≤200 tin, 7 ngày) chỉ được nạp vào ở lần khởi động sau.

Tắt trí nhớ: ngừng lưu, ngừng tra, ngừng chèn ngữ cảnh. **Tin đã lưu vẫn còn trong DB**, xem câu hỏi 2 ở mục 7.

### 3.5 Dashboard (`apps/web/src/modules/zca`)

- **`thread-config-modal.tsx`**: thêm card "🧠 Trí nhớ hội thoại", đặt cùng mẫu với card thả tim:
  - toggle `enabled`
  - khi bật thì hiện thêm 2 ô số "Số tin ngữ cảnh gần đây" (0–30) và "Số kết quả mỗi lần tra" (1–50)
  - một dòng mô tả: bot lưu mọi tin của nhóm, kể cả người không dùng bot
  - state mặc định và payload lưu dùng `normalizeChatMemoryConfig`
  - chữ hardcode tiếng Việt như các card khác, bo góc nhỏ như hiện tại
- **`chat-table-row.tsx` `ConfigBadges`**: thêm badge "🧠 Nhớ" khi kênh bật trí nhớ.

### 3.6 Env

- Xoá `chatMemory` khỏi `configuration.ts`.
- Xoá 3 biến `CHAT_MEMORY_*` khỏi `.env.example`, `apps/api/.env.example`, `.env` và `.env.production`.

## 4. File thay đổi

- **Contracts**: `packages/contracts/src/index.ts`.
- **API**:
  - **Mới**: migration `1724820000000-AddChatMemoryToZcaThreadConfigs.ts`
  - **Sửa**:
    - `zca-thread-config.entity.ts`, `data-source.ts`, `database.module.ts`
    - `thread-config.service.ts`, `zca-bot-feature.service.ts`, `zca.service.ts`
    - `zca/memory/chat-memory.service.ts`
    - `zalo/text/text-input.service.ts`, `zalo/text/strategies/search-chat-history-tool.strategy.ts`
    - 2 file `agent-input.type.ts`
    - `config/configuration.ts`
- **Web**: `thread-config-modal.tsx`, `chat-table-row.tsx`.
- **Env**: `.env.example`, `apps/api/.env.example`, `.env`, `.env.production`.
- **Docs**:
  - `knowledge|docs/modules/zca/chat-memory.md`
  - `knowledge|docs/modules/zca/README.md` (bảng cấu hình kênh)
  - `knowledge|docs/global/environment-guard.md` (bỏ `CHAT_MEMORY_*`)
  - `knowledge|docs/global/local-first-ai-usage.md`
  - `CONTEXT.md` (trí nhớ bật theo kênh)

## 5. Kiểm thử

- `thread-config.service.spec.ts`:
  - mặc định `chatMemory` tắt
  - update merge và kẹp giới hạn (vd `contextWindow: 99` → 30, `searchLimit: 0` → 1)
  - cache cũ thiếu khoá → mặc định
- `normalizeChatMemoryConfig`: giá trị rác, số âm, chuỗi.
- `zca-bot-feature.service.spec.ts`:
  - kênh bật thì ghi và gắn `AgentInput.chatMemory`
  - kênh listen nhưng tắt thì không ghi, `AgentInput.chatMemory` trống
  - `onUndo` vẫn chạy khi đã tắt
  - cập nhật các fixture `ThreadBotConfig` có sẵn
- `chat-memory.service.spec.ts`: bỏ các test "no-op khi env tắt".
- `search-chat-history-tool.strategy.spec.ts`: không có `input.chatMemory` thì trả câu hướng dẫn bật; có thì dùng `searchLimit` của kênh.
- Lệnh chạy:
  - `npm run typecheck` (api, web, contracts)
  - `npm run test --workspace @zalobot/api`
  - test web
  - eslint trên file sửa
  - `npm run build --workspace @zalobot/web`
  - `node .claude/hooks/docs-drift-check.mjs`

## 6. Điều kiện trước khi code

Working tree đang có thay đổi **chưa commit**: chuỗi LLM 9router → Gemini và việc gỡ `MEMORY_LLM_*`. Cả hai đã pass test. Đề xuất commit phần đó thành một commit riêng trước khi bắt đầu plan này, để hai thay đổi không lẫn vào nhau.

## 7. Cần anh xác nhận

1. Mặc định **tắt** cho mọi kênh, admin tự bật từng nhóm. Đúng ý anh chứ?
2. Khi **tắt** trí nhớ một kênh, tin đã lưu nên xử lý thế nào:
   - (a) giữ lại trong DB, bật lại thì dùng tiếp (đề xuất)
   - (b) xoá hết tin của kênh đó ngay khi tắt
3. Commit riêng phần chuỗi LLM trước (mục 6) chứ?

## 8. Rollback

Tắt `chatMemory.enabled` ở các kênh trên dashboard. Gỡ hẳn: `migration:revert` (xoá cột) rồi revert commit.
