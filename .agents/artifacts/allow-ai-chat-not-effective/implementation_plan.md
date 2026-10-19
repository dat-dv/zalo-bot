# Implementation plan: chit-chat chạy đúng khi `allowAiChat=true`

Liên quan: [diagnosis.md](diagnosis.md) · Rủi ro: **MEDIUM** (thay đổi hành vi LLM, tăng số lần gọi LLM, sửa 1 file service + spec + docs)

## Mục tiêu
Khi chit-chat được phép (`allowAiChat !== false`, không ở chế độ passive), bot phải trả lời tự nhiên các câu hỏi tổng quát (kiến thức, giải trí, tư vấn…) thay vì từ chối với lý do "em chỉ là trợ lý tài chính". Khi `allowAiChat === false` hoặc ở chế độ `passiveOnly`, hành vi giữ nguyên.

## Thay đổi

### 1. Thêm đoạn chit-chat vào system prompt — `apps/api/src/zalo/text/text-input.service.ts`
- Tạo hằng `CHIT_CHAT_INSTRUCTION` (private, cùng file), nội dung đại ý:
  - Ngoài các tác vụ có tool, bạn ĐƯỢC PHÉP và NÊN trả lời mọi câu hỏi tổng quát (kiến thức, giải trí, phim ảnh, ẩm thực, tư vấn, học tập…) một cách tự nhiên, hữu ích, ngắn gọn bằng tiếng Việt.
  - KHÔNG từ chối với lý do "chỉ là trợ lý tài chính/lịch/công việc".
  - Với câu hỏi cần dữ liệu thời gian thực (lịch chiếu, giá, thời tiết, tin tức): trả lời bằng kiến thức hiện có và nói ngắn gọn rằng thông tin có thể chưa cập nhật, gợi ý nguồn để kiểm tra.
  - Chỉ gọi tool khi người dùng thực sự yêu cầu một thao tác có tool tương ứng.
- Ở nhánh không passive, nối `CHIT_CHAT_INSTRUCTION` vào `systemInstruction` chỉ khi `input.allowAiChat !== false` (mặc định `undefined` được coi là bật, đúng với comment ở `agent-input.type.ts`). Dòng hiện có "Nếu người dùng chỉ chào hỏi…" vẫn giữ nguyên.

### 2. Gọi LLM thêm một lần, không kèm tool, khi không có tool call
- Tạo private method `generateChitChatReply(text, dtSnippet): Promise<string | undefined>`:
  - Gọi `llmService.generate(text, undefined, chitChatSystemInstruction)`. Prompt riêng gồm: "Bạn là trợ lý cá nhân thông minh trên Zalo", ngữ cảnh ngày giờ, `CHIT_CHAT_INSTRUCTION`, và không có danh sách tool.
  - Trả về `response.text` đã trim; nếu rỗng hoặc có lỗi (`catch (err: unknown)`) thì trả `undefined` và ghi log `warn`.
- Trong nhánh "Plain AI conversational reply" (sau khi đã qua các check `passiveOnly` và `allowAiChat === false`):
  - `aiReplyText = (await this.zaloService.withChatAction(chatId, () => this.generateChitChatReply(...))) ?? response.text`.
  - Tức là ưu tiên câu trả lời của lần gọi thứ hai; nếu lần đó thất bại thì dùng câu trả lời của lần gọi đầu, như hiện tại.
- Không áp dụng cho nhánh `catch` fallback (khi lần gọi đầu đã lỗi thì chỉ giữ fallback hiện có, tránh gọi LLM thêm khi provider đang lỗi), và không áp dụng cho luồng chỉnh sửa (`edit <code>`).

**Đánh đổi**: mọi tin nhắn không gọi tool (kể cả "chào bot") sẽ tốn 2 lần gọi LLM và chậm hơn khoảng một lần gọi. Chấp nhận, vì đây là đề xuất đã được chọn; nếu chi phí là vấn đề, sau này có thể chỉ gọi lần hai khi câu trả lời đầu có dấu hiệu từ chối.

### 3. Test — `apps/api/src/zalo/text/text-input.service.spec.ts`
- Mở rộng mock `generate` để lưu lại lịch sử các lần gọi (`prompt`, tên tool, instruction). Thêm option `chitChatResponse` để lần gọi không kèm tool trả về nội dung khác.
- Test mới:
  1. `allowAiChat=true`, lần gọi đầu không có tool call → có 2 lần gọi LLM; lần thứ hai có `tools` rỗng và instruction chứa đoạn chit-chat; tin gửi đi là text của lần thứ hai.
  2. Lần gọi thứ hai trả text rỗng hoặc ném lỗi → gửi text của lần gọi đầu.
  3. System prompt của lần gọi đầu chứa đoạn chit-chat khi `allowAiChat` là `true`/`undefined`, và không chứa khi `false`.
  4. `allowAiChat=false` / `passiveOnly` → vẫn chỉ 1 lần gọi (hoặc 0) và bot im lặng (giữ các test hiện có).
- Rà các test hiện có đang kiểm tra `getLlmCallCount() === 1` hoặc `lastLlmInstruction` trong nhánh conversational, rồi cập nhật kỳ vọng (ví dụ test ở dòng ~230 và test "shared context inheritance" phải đọc instruction của lần gọi **đầu tiên**).

### 4. Docs (Hard Completion Gate)
- `.agents/knowledge/global/zalo-command-intake.md` (bước 5) và `.agents/knowledge/global/llm-providers.md`: ghi rõ khi chit-chat được phép thì system prompt có thêm đoạn chit-chat, và khi không có tool call thì bot gọi LLM lần hai không kèm tool.
- `.agents/knowledge/modules/zca/README.md`: cột `allowAiChat` mô tả rõ ảnh hưởng tới prompt.
- Các file `.agents/docs/` tương ứng (tiếng Việt): `global/zalo-command-intake.md`, `global/llm-providers.md` (nếu đã có, nếu chưa thì tạo cặp theo quy tắc 1-1), `modules/zca/README.md`.

## Không nằm trong phạm vi
- Google Search grounding / dữ liệu thời gian thực (đề xuất 3).
- Luồng ảnh/OCR (`create-bill-pending-image.strategy.ts`), luồng chỉnh sửa, và chế độ passive.
- Không thay đổi schema DB, contracts hay UI.

## Kiểm tra
1. `npm run test --workspace @zalobot/api`
2. `npm run typecheck --workspace @zalobot/api`
3. `npm run lint --workspace @zalobot/api`
4. `node .claude/hooks/docs-drift-check.mjs`
5. Kiểm tra thủ công (do bạn thực hiện sau khi deploy): hỏi "@bot có phim gì hay chiếu rạp không" trong thread `7120342145544273834` → bot phải trả lời nội dung về phim, kèm lưu ý thông tin có thể chưa cập nhật.
