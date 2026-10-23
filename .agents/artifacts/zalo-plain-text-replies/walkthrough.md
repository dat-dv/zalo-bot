# Walkthrough: Bỏ markdown khỏi tin bot gửi lên Zalo

Theo `implementation_plan.md` đã duyệt. Chưa commit.

## Đã làm

| File | Thay đổi |
| --- | --- |
| `apps/api/src/zca/text/zalo-plain-text.util.ts` (mới) | `toZaloPlainText` (viết lại markdown thành văn bản thuần, giữ nguyên link), `toZaloPlainMessage` (bỏ qua tin có `mentions`/`styles`), hằng `ZALO_PLAIN_TEXT_INSTRUCTION` |
| `apps/api/src/zca/text/zalo-plain-text.util.spec.ts` (mới) | 12 test: in đậm, in nghiêng, code, tiêu đề, gạch đầu dòng, dòng kẻ, dấu lẻ, link markdown, link giữ nguyên, template của bot không đổi, không trả tin rỗng, tin có tag/style |
| `apps/api/src/zca/zca.service.ts` | `sendMessage` gọi `toZaloPlainMessage` trước khi gửi |
| `apps/api/src/zca/zca.service.spec.ts` | Test `sendMessage`: chuỗi và `{ msg }` được làm sạch, tin có tag giữ nguyên |
| `apps/api/src/zca/text/text-input.service.ts` | Nối `ZALO_PLAIN_TEXT_INSTRUCTION` vào prompt chính, prompt sửa thẻ, prompt trò chuyện |
| `apps/api/src/zca/text/strategies/search-chat-history-tool.strategy.ts` | Nối instruction |
| `apps/api/src/zca/pending-image/strategies/create-bill-pending-image.strategy.ts` | Nối instruction (strategy này có gửi `response.text` khi LLM không gọi tool) |
| `.agents/knowledge/global/zalo-response-layout.md`, `.agents/knowledge/global/README.md` | Quy tắc không markdown, 2 lớp, ngoại lệ tin có tag, `depends_on` |
| `.agents/docs/global/zalo-response-layout.md`, `.agents/docs/global/README.md` | Mục 1.1 giải thích bằng tiếng Việt, bước kiểm tra thủ công |

## Kiểm tra

- `npm run test --workspace @zalobot/api`: 706/706 pass.
- `npm run typecheck --workspace @zalobot/api`: sạch.
- `npm run lint --workspace @zalobot/api`: sạch.
- `node .claude/hooks/docs-drift-check.mjs`: PASS (0 lỗi).
- Chưa thử trên Zalo thật. Cách thử: hỏi bot "gợi ý 3 món ăn sáng" và xem câu trả lời không còn `**`, `#`, dấu `` ` ``.

## Ghi chú

- Working tree đang có thay đổi của việc khác (contact-profile: `apps/api/src/finance/*`, `apps/web/src/modules/contacts/*`, `packages/contracts/src/index.ts`, `CONTEXT.md`, docs contacts/finance-domain). Task này không đụng vào các file đó. Lượt chạy test ở trên bao gồm cả các thay đổi đó.
