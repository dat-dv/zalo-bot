# Receipt Image Analysis

zalo photos are transcribed locally with Tesseract `vie+eng` before semantic analysis. Gemini receives only normalized OCR text; it never receives image bytes, base64 image data, or zalo file URLs.

The model returns one of three states: `ready`, `missing_fields`, or `not_receipt`. Only `ready` with a valid income/expense type, positive VND amount, and note can enqueue `create_finance_transaction`. The existing confirmation action remains mandatory before the finance record is written.

For a `ready` receipt, the downloaded image is read into memory for OCR and stored directly to Google Drive & Google Photos via `MediaStorageService`. The file is no longer persisted locally to disk under `./data/receipts` and `RECEIPT_STORAGE_DIR` has been removed. Its Google Drive link (or original image URL) is attached to the pending transaction as `receiptUrl`.

The service has bounded download timeout and byte size. Blurry, unrelated, or incomplete images must prompt for a clearer image or the specific missing field; they must not create a transaction.
