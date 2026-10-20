# Walkthrough: Bắt buộc mention/tiền tố + nhiều tiền tố

Plan đã duyệt: [implementation_plan.md](implementation_plan.md) (Q1 xoá cột, Q2 luôn bắt buộc trừ chat riêng, Q3 ảnh không chữ chỉ lưu, Q4 tiền tố không phân biệt hoa thường và không có dấu cách).

## Thay đổi

**Contract (`packages/contracts/src/index.ts`)**
- `ThreadDirectInteractionConfig`: bỏ `requireMention`, `triggerPrefix`; thêm `triggerPrefixes: string[]`.
- Xoá `ThreadExpenseConfig`, `ThreadCalendarConfig` và hai trường tương ứng trong `ThreadBotConfig` / `UpdateThreadBotConfigDto`.
- Thêm `TRIGGER_PREFIX_LIMITS`, `TriggerPrefixError`, `validateTriggerPrefix`, `normalizeTriggerPrefixes`, `findTriggerPrefix`. API và web dùng chung các hàm này.

**DB**
- Migration mới `1724800000000-DropZcaPassiveTrackingColumns`: `DROP COLUMN expense_tracking, calendar_extraction`; xoá khoá `requireMention` khỏi `direct_interaction`; đổi default sang `triggerPrefixes: []`. Đã đăng ký trong `data-source.ts` và `database.module.ts`.
- Entity `ZcaThreadConfigEntity` bỏ hai cột.

**API**
- `thread-config.service.ts`: thêm `normalizeDirectInteraction` để gộp `triggerPrefix` cũ vào danh sách và bỏ `requireMention`. Áp dụng khi đọc từ DB, Redis, file JSON cũ và khi update.
- `zca-bot-feature.service.ts`:
  - Quy tắc mới: `isDirectTriggered = hasMention || hasPrefix || (!isGroup && hasText)`.
  - Bỏ luồng L2 thụ động (`resolvePassiveAllowedTools`, `checkPassiveGuards`) và bỏ menu `ImageBatchHandler` cho ảnh 1-1 không chữ.
  - Tin không gọi bot thì `return`, không gọi LLM.
- `bot-mention.util.ts`: `cleanBotMention(text, botName, triggerPrefixes[])` bóc tiền tố khớp dài nhất, không phân biệt hoa thường.
- `text-input.service.ts`: bỏ toàn bộ nhánh `passiveOnly` / `allowedTools` / `buildPassiveSystemInstruction`.
- `text-tool.definitions.ts`: bỏ `PASSIVE_EXPENSE_TOOLS`, `PASSIVE_CALENDAR_TOOLS`. `selectToolDefinitions` vẫn giữ vì `edit <code>` còn dùng.
- `AgentInput` (2 file): bỏ `passiveOnly`, `allowedTools`; đổi `triggerPrefix` thành `triggerPrefixes`.

**Web**
- `trigger-prefix-input.tsx` (mới): ô nhập dạng chip; Enter, dấu phẩy hoặc nút "Thêm" để thêm, × hoặc Backspace để xoá; báo lỗi inline; cảnh báo khi đặt tiền tố `/`.
- `thread-config-modal.tsx`:
  - Bỏ công tắc "Bắt buộc mention", thay bằng ghi chú quy tắc gọi bot cho nhóm và chat riêng.
  - Bỏ hai khối thu chi/lịch.
  - Sửa mô tả Chit-chat.
  - Dùng `TriggerPrefixInput`.
- `chat-table-row.tsx`: badge `🤖 @Bot` (tooltip liệt kê tiền tố) / `🤖 Chat riêng`; bỏ badge Thu chi/Lịch.

**Docs**: knowledge và docs của module zca, reminders, users; global `zalo-command-intake`, `llm-providers`, `backend-crud-api`.

## Kiểm chứng đã chạy
- `npm run build --workspace @zalobot/contracts`, `npm run typecheck --workspace @zalobot/contracts`: OK.
- `npm run typecheck --workspace @zalobot/api`: 0 lỗi.
- `npm run test --workspace @zalobot/api`: 378/378 pass.
- `npm run typecheck --workspace @zalobot/web`, `npm run build --workspace @zalobot/web`: OK.
- ESLint các file thay đổi: không phát sinh lỗi mới so với trước khi sửa. Các file API đã có sẵn lỗi lint cũ (ví dụ `no-base-to-string`) nằm ngoài phạm vi task. ESLint các file web và contracts: sạch. Prettier: sạch.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Chưa kiểm chứng
- Chưa chạy migration trên DB thật. Chưa thử tay trên Zalo (xem mục 6 của plan).
- Không có test UI tự động cho `TriggerPrefixInput`.

## Lưu ý vận hành
- Sau deploy, nhóm đang quen ghi thu chi không cần tag sẽ thấy bot im lặng. Nên báo người dùng dùng `@bot` hoặc tiền tố.
- Chat 1-1: tin chữ nào cũng được xử lý, kể cả kênh từng tắt "Tương tác trực tiếp" (backend không đọc cờ `enabled` khi định tuyến).
- `migration down` chỉ tạo lại cột với giá trị mặc định; không khôi phục được dữ liệu cũ.
