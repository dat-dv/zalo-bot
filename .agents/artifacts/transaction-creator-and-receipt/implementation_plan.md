# Kế hoạch: Hiển thị người tạo và ảnh hoá đơn trên trang Thu chi

> **Đã thay thế** bởi `.agents/artifacts/shared-ledger-with-creator/implementation_plan.md` (2026-10-20): người dùng chốt dùng sổ chung toàn hệ thống.

- Route: `implement` · Phase 1 (inspect-and-plan) · Rủi ro: **MEDIUM** (thêm cột DB + migration, endpoint mới, UI)
- Ngày: 2026-10-20 · Base: `main` @ `820ff07` (working tree sạch)
- Phạm vi đã chốt: **chỉ trang Thu chi trên dashboard**; "người tạo" = **người gửi tin nhắn** tạo giao dịch.

## 1. Hiện trạng (đã xác minh)
| Hạng mục | Hiện tại |
| --- | --- |
| Người tạo | Không lưu. Giao dịch chỉ có `user_id` = người gửi (`record-transaction-tool.strategy.ts:128-140`). Tên hiển thị (`context.displayName`) có sẵn lúc tạo nhưng bị bỏ. |
| Kênh nguồn | Không lưu. `chatId` (nhóm / chat 1-1) có sẵn trong pending action. |
| Ảnh hoá đơn | Cột `receipt_url` đã có. Với ảnh gửi qua ZCA: là **Drive `webViewLink`** (upload bằng token Google của người gửi, fallback token chung — `media-storage.service.ts`, `google-auth.service.ts:117-124`); nếu upload Drive lỗi thì là **URL CDN Zalo** gốc. |
| Hiển thị ảnh | `webViewLink` là trang xem của Drive, **không nhúng `<img>` được**; file `drive.file` là private. API danh sách giao dịch **không trả `receiptUrl`** (`toTransactionItem`). |

**Lưu ý nghiệp vụ:** vì giao dịch luôn thuộc về người gửi, trên dashboard của mỗi người cột "Người tạo" luôn là chính họ. Để cột có ích, em đề xuất hiển thị kèm **nguồn**: `Văn Đạt · Nhóm <tên nhóm>` / `Văn Đạt · Chat riêng` / `Dashboard`. (Xem câu hỏi duyệt #1.)

## 2. Thiết kế

### 2.1 Database (migration mới, không sửa migration cũ)
`finance_transactions` thêm 3 cột nullable:
- `created_by_name varchar` — tên hiển thị Zalo của người gửi tại thời điểm tạo.
- `source varchar` — `'zalo'` | `'dashboard'` | `null` (giao dịch cũ hoặc do hệ thống sinh như thanh toán nợ).
- `source_chat_id varchar` — `threadId` Zalo nơi gửi tin.
Dữ liệu cũ để `null` → UI hiện "—". Migration `up`/`down` đầy đủ.

### 2.2 Backend
- `FinanceTransactionEntity` + `CreateFinanceTransactionDto`: thêm `createdByName?`, `source?`, `sourceChatId?`; `createTransaction` lưu các trường này.
- `record-transaction-tool.strategy.ts`: đưa `createdByName: context.displayName`, `source: 'zalo'`, `sourceChatId: context.chatId` vào payload (đi qua pending action trong Redis → `TransactionConfirmationService` commit nguyên payload, không cần sửa nhánh commit).
- `FinanceController POST /transactions` (dashboard): `source: 'dashboard'`, `createdByName` = `firstName` của user trong token (nếu có).
- `toTransactionItem`: trả thêm `createdByName`, `source`, `sourceChatName` (tra `zca_thread_configs.thread_name` theo `source_chat_id`, một truy vấn `IN (...)` cho cả trang — không N+1), `sourceChatType` (`group`/`user`), và `hasReceipt: boolean`. **Không** trả `receiptUrl` thô cho web (link Drive private, không dùng được).
- Endpoint mới `GET /api/transactions/:id/receipt` (route constant `API_ROUTES.transactionReceipt(id)`):
  - Kiểm tra giao dịch thuộc user trong token; không có ảnh → 404.
  - `receipt_url` là link Drive (`/file/d/<id>/`) → tải bằng `getDriveClient(tx.userId).files.get({ fileId, alt: 'media' })`, stream về với `Content-Type` của file, `Cache-Control: private, max-age=3600`.
  - `receipt_url` là URL Zalo CDN (http/https) → fetch phía server (giới hạn 10MB, timeout 10s) rồi stream; host khác → 404 (tránh SSRF: chỉ cho phép host CDN Zalo đã thấy trong code, danh sách cụ thể sẽ xác minh khi implement).
  - Lỗi Drive (token hết hạn, file bị xoá) → 404/502 kèm thông báo, không làm hỏng trang.

### 2.3 Contracts
- `ITransactionItem`: thêm `createdByName?`, `source?: 'zalo' | 'dashboard'`, `sourceChatName?`, `sourceChatType?: 'group' | 'user'`, `hasReceipt?: boolean`.
- `API_ROUTES.transactionReceipt(id)`; i18n keys vi/en: cột "Người tạo", "Chat riêng", "Nhóm", "Dashboard", "Ảnh hoá đơn", "Không tải được ảnh", "Mở ảnh".

### 2.4 Web (`apps/web/src/modules/dashboard`)
- `transactions-table.tsx`:
  - Cột mới **Người tạo** (ẩn/hiện được qua TableColumnSettings): dòng 1 tên người tạo, dòng 2 nhỏ: nguồn (`Nhóm <tên>` / `Chat riêng` / `Dashboard`); `null` → "—".
  - Cột mới **Ảnh** (hẹp): nếu `hasReceipt` → thumbnail 32px; bấm mở lightbox (dùng `Modal` dùng chung) hiển thị ảnh đầy đủ + nút "Mở ảnh" tab mới.
  - Dòng mở rộng (`renderExpandedRow`) đã có cho phân bổ → bổ sung khối chi tiết đầy đủ: người tạo, nguồn, ghi chú đầy đủ (không cắt), phương thức, tiền tệ, thời điểm tạo, ảnh lớn. Nút mở rộng hiện cho mọi dòng có ảnh hoặc có phân bổ.
- Ảnh tải qua `httpClient` (cần Bearer token, nên không dùng `<img src>` trực tiếp): hook `useTransactionReceiptQuery(id, enabled)` lấy blob → `URL.createObjectURL`, thu hồi URL khi unmount; chỉ tải khi thumbnail vào viewport hoặc khi mở lightbox (lazy, `staleTime` 1 giờ).
- Responsive: trên mobile cột Ảnh vẫn hiện thumbnail; cột Người tạo mặc định ẩn ở màn < 640px (bật lại được), thông tin vẫn có trong dòng mở rộng.

### 2.5 Ngoài phạm vi
- Thẻ xác nhận trên Zalo, sổ chung trong nhóm, người duyệt (❤️) — đã chốt không làm.
- Lưu nhiều ảnh cho một giao dịch (hiện mỗi giao dịch 1 `receipt_url`).
- Backfill người tạo cho giao dịch cũ (không có dữ liệu nguồn).

## 3. Kiểm thử
- API: strategy đưa `createdByName/source/sourceChatId` vào payload; `createTransaction` lưu đủ; `toTransactionItem` + tra tên nhóm; endpoint receipt: sai chủ → 404, không ảnh → 404, link Drive → gọi `files.get` đúng `fileId`, host lạ → 404.
- Web: `transactions-api` gọi đúng `API_ROUTES.transactionReceipt` với `responseType: 'blob'`.
- `npm run typecheck`, `npm run test`, `npm run lint` (file đã sửa), `npm run build --workspace @zalobot/web`, chạy migration trên DB local nếu có.
- Thủ công (cần anh hỗ trợ trên prod sau deploy): gửi ảnh bill qua Zalo → xác nhận → thấy thumbnail + người tạo trên trang Thu chi.

## 4. Tài liệu
- `knowledge/modules/dashboard` + `docs/modules/dashboard`: cột Người tạo, Ảnh, dòng mở rộng.
- `global/finance-domain.md`, `global/backend-crud-api.md` (EN+VI): cột mới, endpoint receipt.
- `global/receipt-image-analysis.md` (EN+VI): ảnh được xem lại qua proxy.
- Drift check pass + `walkthrough.md`.

## 5. Cần anh duyệt
1. Cột "Người tạo" hiển thị kèm **nguồn** (Nhóm / Chat riêng / Dashboard) — đồng ý? (Nếu không, cột sẽ luôn là tên của chính anh.)
2. Thêm 3 cột DB qua migration mới (dữ liệu cũ để trống) — đồng ý?
3. Ảnh xem qua endpoint proxy của API (cần token Google của người gửi còn hiệu lực) — đồng ý?
