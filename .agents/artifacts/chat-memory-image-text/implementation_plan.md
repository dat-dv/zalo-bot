# Kế hoạch: Đọc chữ trong ảnh (OCR) vào trí nhớ hội thoại

- Route: `implement` · Giai đoạn: Phase 1 (lập kế hoạch) · Rủi ro: **MEDIUM–HIGH** (nhiều module, đổi hợp đồng `@zalobot/contracts`, tải CPU, dữ liệu nhạy cảm từ ảnh)
- Nhánh dự kiến: `feat/chat-memory-image-text` tạo từ `main` (nhánh hiện tại `refactor/unify-button-states` sạch, không đụng tới)

## 1. Hiện trạng (đã kiểm tra trong code)

- `ZcaBotFeatureService.onMessage` ghi **mọi** tin của kênh đang listen vào trí nhớ ngắn hạn (Redis) và dài hạn (Postgres `zca_messages`) ngay sau cổng `isListened`, trước bước lọc trigger.
- Với ảnh (`chat.photo`), `buildMemoryText` chỉ lưu `[Ảnh] <caption>` (`chat-memory.mapper.ts`). Nội dung chữ trong ảnh **không** được nhớ.
- OCR (`OcrService`, Sharp + Tesseract `vie+eng`, chạy local) hiện chỉ chạy khi ảnh **gọi bot** (bước 6b ảnh trực tiếp, 5b ảnh được quote) trong `prepareImageOcrContext`; kết quả chỉ dùng cho prompt của lượt đó rồi bỏ.
- Hệ quả: nhóm gửi ảnh menu/lịch/hoá đơn/thông báo mà không tag bot → sau đó hỏi "@bot cái menu lúc nãy có món gì" hoặc "hôm trước ảnh lịch họp ghi mấy giờ" thì bot không biết gì ngoài `[Ảnh]`.

## 2. Mục tiêu

Ảnh gửi trong kênh đã bật trí nhớ được OCR **local** ở chế độ nền; chữ đọc được (đã lọc rác) gắn vào bản ghi của chính tin ảnh đó trong:

- **Trí nhớ ngắn hạn**: để câu nối tiếp hiểu ảnh vừa gửi (cắt ngắn, tối đa 500 ký tự phần chữ ảnh/tin).
- **Trí nhớ dài hạn**: để `SEARCH_CHAT_HISTORY` tìm được theo chữ trong ảnh (full-text, không dấu), tối đa 2000 ký tự/tin như hiện tại.

Ví dụ dòng nhớ: `[2026-10-23 12:05] Nam: [Ảnh] menu trưa nay — chữ trong ảnh: CƠM GÀ 45.000 / BÚN BÒ 50.000 / TRÀ ĐÁ 5.000`

Không thay đổi: luồng ảnh gọi bot (6a/6b/5a/5b) vẫn trả lời như cũ; không gửi bytes ảnh cho LLM; không OCR video/file/sticker.

## 3. Quyết định cần anh duyệt

1. **Công tắc theo kênh** `chatMemory.readImageText` — *đề xuất: có, mặc định BẬT*.
   - Chỉ có tác dụng khi ít nhất một loại trí nhớ đang bật, nên kênh mới (trí nhớ tắt) vẫn không OCR gì; kênh đã bật trí nhớ thì có ngay tính năng.
   - Lý do cần công tắc: chữ trong ảnh có thể là dữ liệu nhạy cảm (ảnh CCCD, ảnh chụp sao kê/chuyển khoản) và sẽ được lưu Postgres + có thể vào prompt LLM qua cửa sổ ngắn hạn; admin cần tắt được cho từng kênh. Ngoài ra OCR tốn CPU ở nhóm gửi nhiều ảnh.
   - Phương án thay thế: không có công tắc, luôn OCR khi trí nhớ bật (bớt phần contracts + web, nhưng không tắt riêng được).
2. **Giới hạn mặc định** (hằng số trong code, không đưa lên UI): hàng đợi OCR chạy **1 ảnh/lần**, tối đa **20 ảnh chờ** (đầy thì bỏ ảnh mới, ghi log); bỏ kết quả có độ tin cậy Tesseract **< 40**; phần chữ ảnh trong trí nhớ ngắn hạn **≤ 500 ký tự**.

## 4. Thiết kế

### 4.1 `OcrService` (`apps/api/src/ocr/ocr.service.ts`)

- Thêm `recognize(buffer): Promise<{ text: string; confidence: number }>` (lấy `data.confidence` của tesseract.js v7).
- `extractTextFromBuffer` gọi lại `recognize` và chỉ trả `text` → các nơi đang dùng (finance, pending-image bill, `prepareImageOcrContext`) không đổi hành vi.

### 4.2 Hàm thuần trong `chat-memory.mapper.ts`

- `cleanOcrTextForMemory(raw, confidence): string`
  - `confidence < IMAGE_TEXT_MIN_CONFIDENCE (40)` → `''`.
  - Từng dòng: gom khoảng trắng; giữ dòng có ≥ 3 ký tự chữ/số (`\p{L}\p{N}`) và tỉ lệ chữ/số ≥ 0.5 (loại `| ~ ee '` mà Tesseract hay sinh từ ảnh chân dung/phong cảnh).
  - Tổng < 8 ký tự chữ/số → `''` (ảnh không có chữ).
  - Nối các dòng bằng ` / ` để dòng nhớ vẫn là một dòng.
- `buildImageMemoryText(baseText, imageText, maxChars): string` → `"[Ảnh] caption — chữ trong ảnh: …"`, cắt theo `maxChars`, có `…` khi bị cắt.

### 4.3 Trí nhớ dài hạn — `ChatMemoryService.attachImageText(channelId, msgId, text)`

- `UPDATE zca_messages SET text = :text WHERE channel_id = :c AND msg_id = :m AND recalled_at IS NULL AND NOT is_bot`.
- `search_vector` là cột generated nên tự cập nhật → tìm được theo chữ trong ảnh. **Không cần migration.**
- Điều kiện `recalled_at IS NULL` bảo đảm ảnh đã bị thu hồi trong lúc OCR không bị "sống lại". Không bao giờ throw.

### 4.4 Trí nhớ ngắn hạn — `ShortTermMemoryService.recordImageText(channelId, data, text, days)`

- **Chỉ append** một bản sao của tin ảnh (cùng `msgId`, `sentAt`, người gửi) với text đã gắn chữ ảnh; không viết lại list Redis (tránh mất tin đến cùng lúc như kiểu rewrite).
- Chỉ append khi list còn tin có `msgId` đó (tin bị thu hồi trước khi OCR xong thì bỏ qua).
- `getRecent`: khi gộp các bản trùng `msgId`, giữ **text dài hơn** (bản có chữ ảnh), giữ quy tắc cờ bot như cũ.
- `SHORT_TERM_MEMORY_MAX_ENTRIES`: 2 × 30 → **3 × 30 = 90**, vì một ảnh chiếm 2 ô (giữ đủ cửa sổ 30 tin khi nhóm gửi album).
- `markRecalled` hiện đã lọc theo `msgId` nên xoá cả hai bản.

### 4.5 Service mới `ImageTextMemoryService` (`apps/api/src/zca/memory/image-text-memory.service.ts`)

Nằm trong `ChatMemoryModule` (module này import thêm `OcrModule`; `OcrModule` không phụ thuộc gì → không tạo vòng module).

- `enqueue(job)` với `{ channelId, channelType, data, imageUrl, shortTermDays?, longTerm, afterStored? }`:
  - Khoá chống trùng `channelId:msgId` (echo self-listen, gửi lại).
  - Hàng đợi trong process, chạy tuần tự 1 job; đầy 20 job → bỏ job mới (log warn). Mất khi restart: chấp nhận (best-effort, giống buffer hiện tại).
  - Job: chờ `afterStored` (bản ghi Postgres đã insert) → `fetchImageBuffer` → `ocr.recognize` → `cleanOcrTextForMemory` → nếu có chữ: `attachImageText` (nếu `longTerm`) và `recordImageText` (nếu có `shortTermDays`).
  - Không bao giờ throw; lỗi tải ảnh/OCR chỉ log.
- `recognizeNow(channelId, msgId, buffer): Promise<string | null>` cho ảnh **gọi bot** (6b), để mỗi ảnh chỉ OCR **một lần**:
  - Job đang chạy → chờ kết quả; job còn trong hàng đợi → rút ra chạy ngay (không bắt người dùng chờ hàng đợi) với buffer đã tải; đã xong gần đây (cache nhỏ 50 mục / 10 phút) → trả lại; không có job → `null` (caller tự OCR như cũ).
  - Trả **text thô** cho prompt (giữ hành vi `buildImageOcrPrompt` hiện tại); bản lọc rác chỉ dùng cho trí nhớ.

### 4.6 `ZcaBotFeatureService` (`apps/api/src/zca/zca-bot-feature.service.ts`)

- Ngay sau 2 lệnh ghi trí nhớ trong `onMessage`: giữ promise của `chatMemoryService.record(...)`; nếu `msgType === 'chat.photo'`, `chatMemory.readImageText` bật, ít nhất một trí nhớ bật và `extractMediaMeta(content).url` có → `imageTextMemory.enqueue(...)` (fire-and-forget, `afterStored` = promise trên).
  - Áp cho mọi ảnh của kênh, kể cả ảnh không tag bot (đúng mục tiêu "nắm context"); không gửi gì cho LLM ở bước này.
- `prepareImageOcrContext` nhận thêm `messageId`; với `source: 'direct'` gọi `recognizeNow` trước, `null` mới tự OCR như hiện tại. `source: 'quoted'` giữ nguyên.
- Inject `ImageTextMemoryService` theo kiểu `@Optional()` như 2 memory service hiện có.

### 4.7 Hợp đồng & dashboard (nếu duyệt quyết định 1)

- `packages/contracts/src/index.ts`: `ThreadChatMemoryConfig.readImageText: boolean`, `CHAT_MEMORY_DEFAULTS.readImageText = true`, `normalizeChatMemoryConfig`: thiếu/không phải boolean → `true` (config cũ đã lưu vẫn đọc được, không cần migration vì `chat_memory` là jsonb).
- Web `/zca/thread?id=…`: card nhỏ "🖼️ Đọc chữ trong ảnh" dưới hai card trí nhớ (file mới `image-text-memory-section.tsx`, dùng `ConfigSectionCard` + `ConfigSwitch` sẵn có), bị làm mờ kèm ghi chú khi cả hai trí nhớ tắt. Nội dung giải thích ngắn: đọc chữ local trên server, chỉ ảnh trong kênh này, chữ được lưu vào trí nhớ đang bật và có thể nằm trong ngữ cảnh gửi AI; nên tắt nếu nhóm hay gửi giấy tờ cá nhân.
- `thread-config-form.ts`: `resolveChatMemory` truyền `readImageText`. Giữ bo góc nhỏ hiện tại (`rounded-[3px]`), không đổi style chung.

## 5. File dự kiến thay đổi

| Khu vực | File |
| --- | --- |
| OCR | `apps/api/src/ocr/ocr.service.ts`, `ocr.service.spec.ts` |
| Memory | `apps/api/src/zca/memory/chat-memory.mapper.ts` (+spec), `chat-memory.service.ts` (+spec), `short-term-memory.service.ts` (+spec), `chat-memory.module.ts`, **mới** `image-text-memory.service.ts` (+spec) |
| Bot | `apps/api/src/zca/zca-bot-feature.service.ts` (+spec) |
| Contracts | `packages/contracts/src/index.ts` (+test normalize) |
| Web | `apps/web/src/modules/zca/model/thread-config-form.ts`, `presentation/components/thread-config/thread-config-form.tsx`, **mới** `image-text-memory-section.tsx` |
| Knowledge (EN) | `.agents/knowledge/modules/zca/chat-memory.md`, `.agents/knowledge/global/local-first-ai-usage.md` (exception chat memory: thêm chữ OCR của ảnh), `.agents/knowledge/global/backend-runtime-services.md` (hàng đợi OCR nền) |
| Docs (VI) | `.agents/docs/modules/zca/chat-memory.md`, docs tương ứng của 2 file global, `.agents/docs/README.md` nếu đổi mục lục |
| Thuật ngữ | `CONTEXT.md` mục "Trí nhớ hội thoại": thêm "Chữ trong ảnh" |

## 6. Kiểm thử & xác minh

- Unit:
  - mapper: lọc rác (ảnh không chữ → rỗng, confidence thấp → rỗng), giữ tiếng Việt có dấu, nối ` / `, cắt độ dài.
  - short-term: append bản có chữ ảnh; `getRecent` chọn bản dài; tin đã thu hồi không bị thêm lại; cap 90.
  - long-term: câu `UPDATE` có `recalled_at IS NULL` và `NOT is_bot`.
  - `ImageTextMemoryService`: chạy tuần tự, chống trùng, đầy hàng đợi thì bỏ, `recognizeNow` rút job đang chờ (OCR đúng 1 lần), lỗi không throw.
  - bot feature: ảnh không tag bot → enqueue khi trí nhớ + công tắc bật; không enqueue khi trí nhớ tắt / công tắc tắt / không có URL; 6b dùng `recognizeNow`.
  - contracts: `normalizeChatMemoryConfig` thiếu `readImageText` → `true`.
- Lệnh: `npm run typecheck`, `npm run lint`, `npm run test` (workspace `@zalobot/api`, `@zalobot/contracts`, `@zalobot/web`), `npm run build --workspace @zalobot/web`, `node .claude/hooks/docs-drift-check.mjs`.
- Chưa kiểm được tự động: chất lượng OCR trên ảnh thật của Zalo và ngưỡng lọc rác — cần thử tay trên một kênh test sau khi deploy.

## 7. Rủi ro & giới hạn

- **CPU**: mỗi ảnh ~1–3 giây Tesseract (tạo worker mỗi lần như hiện tại); giới hạn 1 job/lần + 20 job chờ. Album lớn trong nhóm đông có thể bị bỏ bớt ảnh cuối.
- **Rác OCR**: heuristic có thể vẫn để lọt ít ký tự vô nghĩa hoặc bỏ sót chữ mờ; ngưỡng là hằng số, chỉnh sau khi thử thật.
- **Riêng tư**: chữ từ ảnh giấy tờ được lưu và có thể vào prompt LLM (cùng mức lộ như tin nhắn chữ hiện nay); có công tắc theo kênh (nếu duyệt quyết định 1).
- **Race nhỏ** ở trí nhớ ngắn hạn: thu hồi ảnh đúng trong vài ms giữa bước kiểm tra và append có thể để lại bản sao; trí nhớ dài hạn không bị (điều kiện nằm trong câu `UPDATE`).

## 8. Ngoài phạm vi

- OCR lại các ảnh đã lưu trước đây (URL CDN đã bỏ/hết hạn) và ảnh nhập từ backfill lúc khởi động.
- Tái dùng chữ đã nhớ khi quote một ảnh cũ (5b vẫn OCR lại như hiện tại).
- Video, ghi âm (speech-to-text), file PDF; worker Tesseract dùng lại lâu dài; xem nội dung đã nhớ trên dashboard.
