# Walkthrough: chit-chat khi `allowAiChat=true`

Thực hiện theo [implementation_plan.md](implementation_plan.md) đã được duyệt.

## Thay đổi code
- `apps/api/src/zalo/text/text-input.service.ts`
  - Thêm hằng `CHIT_CHAT_INSTRUCTION` và nối vào system prompt gọi tool khi `allowAiChat !== false`.
  - Thêm `generateChitChatReply()`: gọi `llmService.generate(text, undefined, prompt riêng)`; trả `undefined` khi kết quả rỗng hoặc lỗi.
  - Nhánh trả lời hội thoại dùng `chitChatReply ?? response.text`.
- `apps/api/src/zalo/text/text-input.service.spec.ts`
  - Mock LLM ghi các lần gọi không kèm tool vào `chitChatCalls` (tách khỏi bộ đếm hiện có); thêm option `chitChatResponse`.
  - 4 test mới: dùng câu trả lời của lần gọi thứ hai; quay về câu trả lời lần đầu khi lần hai lỗi hoặc rỗng; prompt có/không có đoạn chit-chat theo `allowAiChat`; không gọi lần hai khi đã có tool call.

## Docs
- Knowledge (EN): `global/zalo-command-intake.md`, `global/llm-providers.md`, `modules/zca/README.md`.
- Docs (VI): `global/zalo-command-intake.md`, `global/llm-providers.md`, `modules/zca/README.md`.

## Kiểm tra
- `npm run test --workspace @zalobot/api`: 328/328 pass (đã chạy lại sau lần sửa cuối).
- `npm run typecheck --workspace @zalobot/api`: pass.
- ESLint trên 2 file đã sửa: còn 2 lỗi `no-unsafe-enum-comparison` có từ trước (dòng 237, 383), không do thay đổi này.
- Prettier: pass.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.
- Chưa kiểm tra thủ công trên Zalo sau khi deploy.
