# Walkthrough: Đọc chữ trong ảnh vào trí nhớ hội thoại

- Plan: [implementation_plan.md](implementation_plan.md), đã duyệt với công tắc `readImageText` mặc định bật và giữ các giới hạn mặc định.
- Nhánh: `feat/chat-memory-image-text` (tạo từ `origin/main` 6013fb8). Chưa commit.

## Đã làm

| Phần | Thay đổi |
| --- | --- |
| OCR | `OcrService.recognize` trả `{ text, confidence }`; `extractTextFromBuffer` gọi lại nó, các luồng cũ không đổi. |
| Mapper | `cleanOcrTextForMemory` (ngưỡng tin cậy 40, bỏ dòng ký hiệu, < 8 chữ/số thì bỏ), `buildImageMemoryText` (`[Ảnh] … — chữ trong ảnh: …`, cắt 2000 / 500). |
| Dài hạn | `ChatMemoryService.attachImageText`: `UPDATE text` theo `channel_id`, `msg_id`, `recalled_at IS NULL`, `NOT is_bot`. Không migration. |
| Ngắn hạn | `ShortTermMemoryService.recordImageText` chỉ append bản sao (không viết lại list); `getRecent` giữ text dài hơn; cap 60 → 90. |
| Hàng đợi | `ImageTextMemoryService` mới trong `ChatMemoryModule` (import `OcrModule`): 1 ảnh/lần, ≤ 20 chờ, chống trùng, cache kết quả 50 mục/10 phút, `recognizeNow` cho ảnh gọi bot. |
| Bot | `onMessage` xếp mọi ảnh vào hàng đợi khi bật trí nhớ + `readImageText`; `prepareImageOcrContext` (ảnh trực tiếp) dùng `recognizeNow` để chỉ OCR một lần. |
| Contracts | `ThreadChatMemoryConfig.readImageText`, mặc định `true`; `normalizeChatMemoryConfig` coi thiếu là `true`. |
| Web | Card "🖼️ Đọc chữ trong ảnh" (`image-text-memory-section.tsx`) dưới hai card trí nhớ; sửa mục "Lưu gì" của card dài hạn. |
| Docs | knowledge + docs `modules/zca/chat-memory.md`, `global/local-first-ai-usage.md`, `global/backend-runtime-services.md`; `CONTEXT.md` thêm "Chữ trong ảnh". |

## Xác minh đã chạy

- `npm run typecheck` (toàn repo): pass.
- `npm run lint` (toàn repo): pass.
- `npm run test --workspace @zalobot/api`: 741/741 pass (gồm test mới cho mapper, 2 memory service, `ImageTextMemoryService`, luồng ảnh của bot, normalize config, OCR confidence).
- `npm run test --workspace @zalobot/web`: 141/141 pass.
- `npm run build --workspace @zalobot/web` và `--workspace @zalobot/api`: pass.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Chưa xác minh

- Chất lượng OCR và ngưỡng lọc rác trên ảnh Zalo thật (cần thử trên kênh test sau deploy, xem mục 5 trong docs `chat-memory.md`).
- Card mới trên dashboard chưa được xem bằng trình duyệt (chỉ typecheck, test, build).
