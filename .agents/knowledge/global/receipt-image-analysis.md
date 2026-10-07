# Receipt Image Analysis

zalo photos are transcribed locally with Tesseract `vie+eng` before semantic analysis. Gemini receives only normalized OCR text; it never receives image bytes, base64 image data, or zalo file URLs.

The model returns one of three states: `ready`, `missing_fields`, or `not_receipt`. Only `ready` with a valid income/expense type, positive VND amount, and note can enqueue `create_finance_transaction`. The existing confirmation action remains mandatory before the finance record is written.

For a `ready` receipt, the downloaded image is compressed locally before persistence: EXIF orientation is applied, the longest edge is limited to 2048px without enlargement, and it is encoded as progressive JPEG at quality 82. The file is stored under `RECEIPT_STORAGE_DIR/<zalo-user-id>/` and its private `/api/receipts/<uuid>` URL is attached to the pending transaction. Cancellation or a failed finance write removes the unreferenced file. A receipt endpoint requires the dashboard bearer token and verifies transaction ownership before streaming the image.

The service has bounded download timeout and byte size. Blurry, unrelated, or incomplete images must prompt for a clearer image or the specific missing field; they must not create a transaction.
