---
metadata:
  agent-artifact:
    id: global-receipt-image-analysis-knowledge
    type: documentation
    depends_on:
      - apps/api/src/zca/pending-image/image-batch-handler.service.ts
      - apps/api/src/zca/pending-image/pending-image-action.service.ts
      - apps/api/src/zca/pending-image/strategies/create-bill-pending-image.strategy.ts
      - apps/api/src/zca/pending-image/strategies/storage-upload-pending-image.strategy.ts
      - apps/api/src/zca/pending-image/strategies/cancel-pending-image.strategy.ts
      - apps/api/src/ocr/ocr.service.ts
      - apps/api/src/receipt-storage/media-storage.service.ts
      - apps/api/src/common/utils/image-fetcher.util.ts
      - apps/api/src/finance/receipt-source.ts
---

# Receipt Image Analysis

## Intake

- Images from the official-bot webhook (`InputProcessor`) and ZCA go to `ImageBatchHandlerService`, which debounces per sender (1 s) and stores a pending image action (`receiptUrl`, `receiptUrls`) in memory and Redis with a 5-minute TTL (`PendingImageActionService`).
- The bot then asks: `1` (or `1 <note>`, `tạo bill`) → create bill; `2` (or `lưu drive/ảnh/photo`) → store to Google Drive & Google Photos; `hủy`/`cancel`/`bỏ qua`/`không` → discard. Other messages continue as normal chat.

## Option 1 — Create Bill (`CreateBillPendingImageStrategy`)

1. Clears the pending action and downloads the image into memory via `fetchImageBuffer` (HTTP(S) or data URI; no size or timeout limit is enforced).
2. `OcrService.extractTextFromBuffer`: Sharp normalization, then Tesseract.js `vie+eng`, entirely local.
3. `MediaStorageService.uploadBill` uploads the buffer to Drive (`zalobot/<channelId>/bill/YYYY-MM`) and Google Photos in parallel; on Drive success the Drive `webViewLink` replaces the original URL as `receiptUrl`. Upload failures are only logged. Nothing is written to local disk.
4. `LlmService.generate(prompt, ZALO_TOOL_DEFINITIONS, systemInstruction)`: the prompt holds the OCR text, the user's note, the `receiptUrl` string, and the current date-time anchor. No image bytes or base64 are sent.
5. If the model returns a `RECORD_TRANSACTION` tool call, missing `receiptUrl`/`note` are filled in and `RecordTransactionToolStrategy` creates the usual pending confirmation; the transaction is written only after the user confirms.
6. Otherwise the bot relays the model's text or asks the user to type the amount (e.g. "Ăn trưa 85k"); no transaction is created.

## Option 2 — Store Only

`StorageUploadPendingImageStrategy` uploads every pending image (`receiptUrls`) through `MediaStorageService.uploadImage` (Drive `zalobot/<channelId>/image/...` + Photos) and replies with a per-image summary. No LLM call.

## Viewing a stored receipt
- The stored `receipt_url` (Drive `webViewLink` or Zalo CDN URL) is never sent to the web. The dashboard loads `GET /api/transactions/:id/receipt`, which downloads the Drive file (shared token → creator token → public link) or fetches the Zalo CDN URL and streams the image. Rules: global/finance-domain.md "Transaction creator and receipt".
