# Implementation plan: Reply ảnh bắt buộc qua OCR để nạp context

Risk: **MEDIUM** (thay đổi luồng tin nhắn chính của ZCA, không đụng DB/contract).

## Yêu cầu

Khi người dùng quote-reply một ảnh và gọi bot (`@bot …`), hệ thống **bắt buộc** chạy OCR (`OcrService`, Tesseract `vie+eng`) trên ảnh được quote rồi đưa text OCR vào prompt LLM, bất kể ý định là thu chi, lịch, task hay nhắc việc.

## Hiện trạng (đã kiểm chứng trong code)

- Luồng đã tồn tại: `apps/api/src/zca/zca-bot-feature.service.ts:919-1015` (bước 5 "Quoted Image Handling") → `fetchImageBuffer` → `ocrService.extractTextFromBuffer` → `textInputService.process({ type: 'image', text: promptText })`.
- Nhưng có 3 chỗ khiến OCR **không chắc chắn được chạy / không có tác dụng**:
  1. **Không lấy được URL ảnh từ quote thật của Zalo.** `extractMediaMeta` (dòng 57) chỉ đọc `href | url | hdUrl | thumb | link | …` ở cấp 1. Payload thật trong log (`quote.attach`, `cliMsgType: 32`) bắt đầu bằng `title, description, childnumber, action, params` — URL ảnh nằm trong **chuỗi JSON lồng** `params` với key `hd`. Test hiện có (`zca-bot-feature.service.spec.ts:1014`) dùng fixture giả `{ href: … }` nên không bắt được lỗi này. Khi URL null, bước 5 bị bỏ qua hoàn toàn và tin rơi về luồng text thường → đúng như log: "Lịch hẹn chiều nay", địa điểm/mô tả trống.
  2. **OCR thất bại im lặng.** Lỗi fetch/OCR chỉ `warn`, rồi vẫn gửi prompt không có context; không có log nào cho biết đã phát hiện ảnh quote hay OCR được bao nhiêu ký tự gắn với reqId/thread.
  3. **Prompt bị đóng khung là hoá đơn.** `"[Nội dung bóc tách từ ảnh hóa đơn qua OCR…]"` và fallback `"Ghi nhận hóa đơn này"` đẩy LLM về thu chi, trong khi ảnh có thể là thực đơn, lịch, poster sự kiện.

> Lưu ý: đoạn log 11:03:11–11:04:01 anh dán bị `<REDACTED>`, nên em chưa thấy trực tiếp dòng `Tesseract OCR extracted …`. Giả thuyết (1) khớp nhất với kết quả. Anh có thể xác nhận nhanh bằng cách grep log quanh 11:03:18 xem có dòng `Tesseract OCR extracted` hoặc `Auto uploading` hay không.

## Thay đổi đề xuất

### 1. Lấy URL ảnh quote chắc chắn hơn — `zca-bot-feature.service.ts`
- Thêm hàm thuần `extractQuotedImageUrl(quote: unknown): string | null`:
  - Parse `quote.attach` (string JSON hoặc object).
  - Thứ tự ưu tiên: `params.hd` (parse chuỗi `params` lồng) → `params.rawUrl` / `params.oriUrl` → `href` → `hdUrl` → `thumb` → `url`.
  - Chỉ nhận `http(s)://`; dùng `unknown` + type guard, không `any`.
- Bước 5 dùng hàm này thay cho chuỗi `extractMediaMeta(...) || ...` hiện tại. `extractMediaMeta` giữ nguyên (đang dùng cho backup media).

### 2. OCR bắt buộc + log rõ ràng
- Gom bước 5b và 6b (ảnh kèm caption) vào một helper private `buildImageOcrContext(mediaUrl, cleanedText, …)` trả `{ promptText, ocrText, receiptUrl }` để hai luồng dùng chung, không lặp code.
- Luôn gọi OCR khi có ảnh. Log `[ZcaBotFeature] Quoted image detected in thread X → OCR N chars` (không in nội dung OCR ở mức LOG; chỉ DEBUG).
- Khi `ocrService` không có hoặc OCR trả rỗng: log `warn` và vẫn gửi prompt kèm ghi chú `[Ảnh đính kèm không đọc được chữ]` để LLM biết có ảnh.

### 3. Prompt trung tính
```
[Văn bản trích từ ảnh được trả lời (OCR, có thể sai chính tả):
<ocrText>]
Yêu cầu của người dùng: <cleanedText>
```
- Fallback khi người dùng chỉ tag bot không có lời dặn: giữ `"Ghi nhận hóa đơn này"` (giữ hành vi cũ cho ca gửi bill trống).
- Cắt `ocrText` tối đa ~2.000 ký tự để không phình prompt.

### 4. Ngoài phạm vi (không đổi)
- Việc upload ảnh quote lên Drive dạng bill (`uploadBill`) vẫn giữ như cũ. Nếu anh muốn chỉ upload khi tool cuối là thu chi thì tách task riêng.
- Lỗi edit/mention và reaction fallback ở báo cáo trước (`.agents/artifacts/zca-edit-mention-reaction-fallback/`) không nằm trong plan này.

## Test
- `zca-bot-feature.service.spec.ts`:
  - Thêm test với fixture **đúng payload thật** (`attach` có `params` lồng chứa `hd`, `cliMsgType: 32`) → OCR được gọi, `processedInput.text` chứa text OCR và lời dặn "tạo lịch hẹn chiều nay".
  - Test OCR rỗng → prompt có ghi chú ảnh không đọc được, vẫn gọi `process`.
  - Unit test `extractQuotedImageUrl`: `params.hd`, `href`, chuỗi rác → `null`.
- Chạy: `npm run test --workspace @zalobot/api`, `npm run typecheck --workspace @zalobot/api`, `npm run lint --workspace @zalobot/api`.

## Docs (Hard Completion Gate)
- `.agents/knowledge/modules/zca/README.md` (EN): thêm mục "Quoted image → mandatory OCR context" (thứ tự lấy URL, format prompt, fallback).
- `.agents/docs/modules/zca/README.md` (VI): giải thích nghiệp vụ reply ảnh + OCR.
- Chạy `node .claude/hooks/docs-drift-check.mjs`. Lưu ý: hook hiện đang báo drift do các thay đổi web mobile-modal chưa commit (không thuộc task này).
