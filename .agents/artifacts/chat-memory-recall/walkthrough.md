# Walkthrough: Trí nhớ hội thoại ZCA, Bước 1

Plan đã duyệt: [implementation_plan.md](implementation_plan.md), giả định G1–G5.

## Đã làm

- **DB**:
  - Migration `1724810000000-CreateZcaMessages`: extension `unaccent`, hàm `zalobot_unaccent`, bảng `zca_messages` có `search_vector` generated, index `(channel_id, sent_at DESC)` và GIN.
  - Entity `ZcaMessageEntity` đã đăng ký ở `data-source.ts` và `database.module.ts`.
  - `AuditLogSubscriber` bỏ qua bảng này.
- **`apps/api/src/zca/memory/`**:
  - `chat-memory.mapper.ts`: chuẩn hoá text, bỏ URL, định dạng dòng `[ngày giờ] người: nội dung`.
  - `chat-memory.query.ts`: dựng SQL tìm có tham số, luôn lọc theo `channel_id`, có khoảng ngày theo múi giờ.
  - `chat-memory.service.ts`: ghi, ghi tin bot, backfill, thu hồi, cửa sổ ngắn hạn, tìm kiếm (tối đa 80 dòng).
  - `ChatMemoryModule` riêng để không tạo vòng phụ thuộc giữa ZCA và Zalo module.
- **Móc ZCA**:
  - `onMessage` ghi mọi tin của kênh đang listen.
  - `onUndo` xoá nội dung tin bị thu hồi.
  - `init` backfill từ buffer Redis.
  - Wrapper `sendMessage` ghi tin bot gửi (`is_bot`).
  - Log raw payload hạ xuống `debug`.
- **LLM**:
  - `OpenAiProvider.generateWithConfig`.
  - `LlmService.generateMemoryAnswer` dùng `MEMORY_LLM_*`; để trống thì dùng provider chính.
  - Config `llm.memory` và `chatMemory`.
- **Tool `SEARCH_CHAT_HISTORY`**:
  - Đã thêm enum, định nghĩa, strategy, đăng ký ở factory và module.
  - Thêm 1 dòng hướng dẫn trong system prompt.
- **Cửa sổ ngắn hạn**:
  - `TextInputService.buildRecentContextBlock` chèn vào prompt, có câu cấm gọi tool cho nội dung cũ.
  - `AgentInput.messageId` dùng để bỏ chính tin đang xử lý. Có 2 bản `AgentInput` trùng (`src/types` và `src/zalo/types`), cả hai đều đã được cập nhật.
- **Env**: thêm 6 biến vào `.env.example` và `apps/api/.env.example`.
- **Docs**:
  - Mới: `knowledge|docs/modules/zca/chat-memory.md`.
  - Cập nhật: README zca (EN/VI), `llm-providers` (EN/VI), `local-first-ai-usage` (ghi ngoại lệ, EN/VI), `environment-guard` (EN/VI), `docs/README.md`, `CONTEXT.md`.

## Kiểm tra đã chạy

- `npm run typecheck --workspace @zalobot/api`: PASS.
- `npm run test --workspace @zalobot/api`: 423/423 PASS, gồm 25 test mới.
- `eslint` trên các file mới/sửa: sạch, trừ lỗi đã có sẵn từ trước ở `zca-bot-feature.service.ts` và `text-input.service.ts:347`. `npm run lint` toàn API vốn đã fail sẵn (60 lỗi cũ).
- `node .claude/hooks/docs-drift-check.mjs --all`: PASS.

## Chưa kiểm chứng

- **Migration và SQL tìm kiếm chưa chạy trên Postgres thật**: máy local không có Docker/psql. Cần chạy khi khởi động API lần đầu.
- **`undo.data.content.globalMsgId` khớp `msgId` của tin gốc**: chưa test với payload thật. Hiện đã có fallback so khớp theo `cliMsgId`.
- **Chất lượng sinh từ khóa và khoảng ngày** của LLM với câu hỏi thật.

## Lưu ý khi chạy

- `npm run lint` có `--fix` nên tự sửa cả file không liên quan. `welcome-group-event.strategy.spec.ts` bị sửa theo cách đó và đã được revert.
