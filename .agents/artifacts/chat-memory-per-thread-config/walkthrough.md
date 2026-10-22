# Walkthrough: Trí nhớ hội thoại theo từng nhóm

Plan đã duyệt: [implementation_plan.md](implementation_plan.md). Chốt: mặc định tắt; khi tắt thì giữ tin đã lưu (a); commit riêng chuỗi LLM trước (`41bbef4`).

## Đã làm

- **Contracts**:
  - Thêm `ThreadChatMemoryConfig`, `CHAT_MEMORY_DEFAULTS`, `CHAT_MEMORY_LIMITS`, `normalizeChatMemoryConfig`.
  - `ThreadBotConfig.chatMemory` (bắt buộc) và `UpdateThreadBotConfigDto.chatMemory`.
- **DB**: migration `1724820000000-AddChatMemoryToZcaThreadConfigs` (cột `chat_memory` jsonb, mặc định tắt), cập nhật entity, đăng ký ở `data-source.ts` và `database.module.ts`.
- **`ThreadConfigService`**: đưa `chatMemory` qua `normalizeChatMemoryConfig` ở default, `entityToConfig`, cache cũ, merge khi update và khi lưu DB.
- **Chặn theo kênh**:
  - `ChatMemoryService` bỏ `isEnabled`/`getContextWindowSize`/`getSearchLimit` và `ConfigService`.
  - `onMessage` chỉ ghi khi kênh bật, và gắn `AgentInput.chatMemory` cho cả luồng text lẫn ảnh.
  - `onUndo` luôn xoá nội dung tin bị thu hồi.
  - `init` chỉ backfill kênh đã bật.
  - Tin bot gửi chỉ được ghi khi kênh bật (`recordBotReplyInMemory`).
  - `TextInputService` lấy cửa sổ ngữ cảnh từ `input.chatMemory.contextWindow`.
  - Tool tra cứu dùng `input.chatMemory.searchLimit`; kênh chưa bật thì hướng dẫn admin bật.
- **Env**: xoá `chatMemory` khỏi `configuration.ts` và 3 biến `CHAT_MEMORY_*` khỏi `.env.example`, `apps/api/.env.example`, `.env`, `.env.production`.
- **Dashboard**:
  - Card "🧠 Trí nhớ hội thoại" trong modal Cấu hình kênh: toggle, 2 ô số có giới hạn, dòng cảnh báo về quyền riêng tư.
  - Badge "🧠 Nhớ" trong bảng kênh.
- **Docs**: cập nhật `chat-memory`, `zca/README`, `environment-guard`, `local-first-ai-usage` (bản EN và VI) và `CONTEXT.md`.

## Kiểm tra đã chạy

- **Typecheck**: `npm run typecheck` của contracts, api và web đều PASS. Contracts đã build lại `dist`.
- **Test API**: `npm run test --workspace @zalobot/api` 433/433 PASS. Test mới:
  - mặc định, kẹp giá trị khi update, `normalizeChatMemoryConfig`
  - kênh tắt thì không ghi; kênh bật thì truyền cấu hình vào `AgentInput`
  - tool dùng `searchLimit` của kênh
- **Test web**: `npm run test --workspace @zalobot/web` 36/36 PASS.
- **Build web**: `npm run build --workspace @zalobot/web` PASS.
- **Lint**: eslint trên các file sửa sạch, trừ các lỗi có sẵn từ trước trong `zca-bot-feature.service.ts`, phần cũ của spec, và `text-input.service.ts:347`.
- **Docs**: `node .claude/hooks/docs-drift-check.mjs` PASS.

## Chưa kiểm chứng

- Migration chưa chạy trên Postgres thật.
- Modal chưa được xem trên trình duyệt, mới chỉ qua typecheck và build.

## Ghi chú

- Ở cuối `.env` và `.env.production` còn 2 dòng comment `# ---` thừa sau khi xoá khối `CHAT_MEMORY_*`. Lệnh dọn bằng python bị chặn quyền; 2 dòng này vô hại.
- Hook an toàn chặn một lệnh sửa docs có chứa chuỗi lệnh revert migration, nên docs `chat-memory` được sửa bằng công cụ Edit.
