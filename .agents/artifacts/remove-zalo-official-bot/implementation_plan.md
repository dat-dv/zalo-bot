# Kế hoạch: Bỏ Zalo Bot chính thức, gộp vào module ZCA, đăng nhập dashboard bằng mã cố định trong env

- Route: implement · Phase 1 (Planning) · Rủi ro: **HIGH** (xoá endpoint public, đổi luồng đăng nhập/auth, đụng nhiều module)
- Trạng thái: chờ anh duyệt + trả lời 2 câu hỏi ở mục 6

## 1. Hiện trạng (đã kiểm tra trong code)

`apps/api/src/zalo/` thực ra gồm **2 phần khác nhau**:

| Phần | File | Còn cần? |
| --- | --- | --- |
| Kênh Zalo Bot chính thức (webhook + Bot API) | `zalo.controller.ts` (GET/POST `/webhook`), `zalo-message-parser.service.ts`, `dto/zalo-webhook.dto.ts`, `zalo.constants.ts` (`ZALO_EVENTS`, `ZALO_API_URLS`), phần gọi `bot-api.zaloplatforms.com` trong `zalo.service.ts`, `apps/api/scripts/zalo-webhook.ts`, `scripts/tunnel.sh` (tự set webhook) | ❌ Trùng với ZCA → bỏ |
| Pipeline xử lý tin dùng chung | `input-processor.service.ts`, `text/**` (40 tool strategy, `TextToolFactory`, `text-tool.definitions.ts` = `ZALO_TOOL_DEFINITIONS`), `types/agent-input.type.ts`, phần ZCA của `zalo.service.ts` (`undoMessage`, `deleteMessage`, gửi qua ZCA) | ✅ ZCA đang dùng → **chuyển sang `zca/`** |

- `ZcaModule` ↔ `ZaloModule` đang import vòng (`forwardRef`). `ZaloService` được dùng ở 59 file (zca, google-auth, health/deploy-notify, reminders, toàn bộ strategy).
- Khi không có `ZALO_BOT_TOKEN`, `ZaloService` đã tự gửi qua ZCA → bỏ Bot API không làm mất chức năng gửi tin.
- Env liên quan: `ZALO_BOT_TOKEN` (đang **bắt buộc** trong `env.validator.ts`), `ZALO_WEBHOOK_URL`, `ZALO_WEBHOOK_SECRET_TOKEN`; `main.ts` bật `rawBody: true` + log webhook; `DashboardToolStrategy.resolveAppUrl()` đọc `ZALO_WEBHOOK_URL` từ file `.env`.
- Đăng nhập bằng mã hiện tại: `POST /access/code` → `ReportsTokenService.consumeExchangeCode()` (mã 1 lần, 20 phút, sinh từ lệnh `/dashboard`). **Rate limit đã có**: `AccessCodeRateLimiter` — 10 lần / IP / 15 phút và 200 lần / toàn hệ thống / 15 phút (Redis, fallback đếm trong process).
- Mã `HRYJ-ZP2T` hợp lệ với định dạng hiện tại (8 ký tự, bảng chữ `DASHBOARD_ACCESS_CODE_ALPHABET`), nên form nhập mã trên web (`access-code-form.tsx`) **không cần sửa**.

## 2. Phần A — Bỏ Zalo Bot chính thức, gộp vào `zca/`

1. **Xoá** (cùng spec tương ứng):
   - `zalo/zalo.controller.ts`, `zalo/zalo-message-parser.service.ts`, `zalo/dto/`, `zalo/zalo.constants.ts`
   - `zalo/guards/*`, `zalo/pending-image/*`, `zalo/confirmation/*`, `zalo/pending-image-action.service.ts`, `zalo/transaction-confirmation.service.ts` (đều là bản cũ/re-export, bản thật đã nằm trong `zca/`)
   - `apps/api/scripts/zalo-webhook.ts` + 4 script `zalo:webhook:*` ở `package.json` gốc và `apps/api`
   - Phần set webhook trong `scripts/tunnel.sh` (giữ phần chạy tunnel)
   - `common/middleware/webhook-raw-body-debug.middleware.ts` nếu chỉ phục vụ webhook; bỏ `rawBody: true` và log "Zalo Webhook endpoint" trong `main.ts`
2. **Chuyển** sang `zca/` (giữ nguyên tên class, chỉ đổi đường dẫn):
   - `zalo/input-processor.service.ts` → `zca/input-processor.service.ts`
   - `zalo/text/**` → `zca/text/**`
   - `zalo/types/agent-input.type.ts` → gộp với `apps/api/src/types/agent-input.type.ts` (đang trùng), giữ 1 bản
3. **`ZaloService` → `ZcaMessengerService`** (`zca/zca-messenger.service.ts`): chỉ còn đường ZCA
   - Giữ API công khai: `sendMessage`, `sendMessageWithResult` (tự chia tin dài như cũ), `undoMessage`, `deleteMessage`, `withChatAction`, `startChatAction`
   - `sendChatAction`: dùng `sendTypingEvent` của `zca-js` nếu ZCA đã đăng nhập, không thì bỏ qua (thay cho Bot API)
   - Đổi import/inject ở toàn bộ ~59 file (thay thế cơ học, không đổi logic); cập nhật `chat-messenger.util.ts` comment
4. **Module**: gộp toàn bộ provider của `ZaloModule` vào `ZcaModule`, xoá `zalo.module.ts` và thư mục `zalo/`. `app.module.ts`, `health.module.ts`, `google.module.ts`, `reminders.module.ts` import `ZcaModule` thay cho `ZaloModule`. Hết vòng import Zalo↔Zca.
5. **Config/env**:
   - `configuration.ts`: bỏ nhánh `zalo.{botToken,webhookUrl,secretToken}`
   - `env.validator.ts` (+ spec): bỏ `ZALO_BOT_TOKEN` khỏi biến bắt buộc, bỏ kiểm `ZALO_WEBHOOK_URL`
   - `DashboardToolStrategy.resolveAppUrl()`: bỏ đoạn đọc `ZALO_WEBHOOK_URL`, chỉ dùng `APP_URL` (vẫn đọc lại `.env` để bắt tunnel mới)
   - `.env.example`: xoá `ZALO_BOT_TOKEN`, `ZALO_WEBHOOK_SECRET_TOKEN`, sửa comment dòng `APP_URL`
6. **Dữ liệu cũ**: người dùng có ID webhook (20 ký tự hex) vẫn nằm trong bảng `users`; không migrate, admin dùng tính năng **Gộp tài khoản** sẵn có nếu cần. Text trên web nhắc "ID webhook" (`chat-row-parts.tsx`) đổi thành "ID cũ từ Zalo Bot chính thức". **Không có migration DB.**

## 3. Phần B — Mã đăng nhập cố định trong env

1. Env mới (tuỳ chọn): `DASHBOARD_LOGIN_CODE=HRYJ-ZP2T`
   - Kiểm lúc khởi động (`env.validator.ts`): nếu có thì sau khi chuẩn hoá phải đúng định dạng `isDashboardAccessCode` (8 ký tự, bảng chữ hiện có), sai thì API không khởi động. Để trống = tắt tính năng.
   - Ghi vào `.env.example` kèm cảnh báo: đổi mã = sửa env + restart; không commit mã thật.
2. `POST /access/code` (`reports.controller.ts`):
   - **Giữ rate limit trước mọi kiểm tra** (`AccessCodeRateLimiter`, 10/IP và 200/toàn hệ thống mỗi 15 phút) — áp dụng chung cho cả mã cố định lẫn mã 1 lần.
   - Kiểm mã cố định trước: so sánh SHA-256 của mã đã chuẩn hoá bằng `timingSafeEqual` (không lộ qua thời gian phản hồi). Khớp → cấp access + refresh token như luồng hiện tại. Không khớp → rơi về `consumeExchangeCode` (mã 1 lần từ `/dashboard`).
   - Log `warn` mỗi lần đăng nhập bằng mã cố định (IP, không log mã) để anh soi được nếu bị lộ.
3. Logic đặt trong `ReportsTokenService` (hàm `matchesStaticLoginCode`) + spec: mã đúng / sai / env trống / mã sai định dạng.
4. Mức an toàn: 32⁸ ≈ 1,1×10¹² tổ hợp; trần 200 lần/15 phút toàn hệ thống ≈ 19.200 lần/ngày → đoán trúng trung bình mất hàng chục nghìn năm. Rủi ro thật là **lộ mã** (mã không hết hạn) → giảm bằng log + đổi mã định kỳ.

## 4. Tài liệu (Hard Completion Gate)

- `.agents/knowledge/` (EN) + `.agents/docs/` (VI): `modules/zca/` (pipeline + messenger giờ nằm ở đây), `modules/auth/` (mã cố định + rate limit), `global/` env guard, `project-overview.md` (bỏ "official Zalo Bot webhook"), `CONTEXT.md` (mục "Danh tính kênh Zalo"), index `.agents/docs/README.md`. Grep toàn bộ `webhook|ZALO_BOT_TOKEN` trong `.agents/` để sửa nốt.
- Chạy `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 5. Kiểm chứng

- `npm run typecheck`, `npm run lint`, `npm run test` cho `@zalobot/api`, `@zalobot/web`, `@zalobot/contracts`
- `grep -rn "zalo/\|ZaloService\|ZALO_BOT_TOKEN\|ZaloModule" apps packages` = rỗng (trừ text lịch sử)
- Chạy API local không có `ZALO_BOT_TOKEN` → khởi động được; `POST /access/code` với mã env → 200; mã sai 11 lần cùng IP → 429; `GET /webhook` → 404

## 6. Cần anh chốt

1. **Mã cố định đăng nhập thành user nào?**
   - (A, đề xuất) Một user admin riêng `dashboard-owner` ("Chủ hệ thống"), tự tạo lần đầu dùng mã. Ưu điểm: chạy được cả khi **chưa có admin nào** hoặc **ZCA hết phiên** — bỏ Zalo Bot chính thức xong thì đây là đường duy nhất để vào dashboard quét lại QR. Nhược: thao tác trên dashboard ghi người tạo là "Chủ hệ thống".
   - (B) Thêm `DASHBOARD_LOGIN_USER_ID` trỏ tới 1 admin có sẵn. Nhược: cài mới (chưa admin) sẽ không vào được dashboard để quét QR ZCA.
2. **Lệnh `/dashboard` trong chat (mã 1 lần 20 phút) có giữ không?** Đề xuất: giữ, vẫn chạy qua ZCA; mã env chỉ là thêm một cách đăng nhập.

## 7. Ngoài phạm vi

- Không đổi tên thư mục `apps/api`, tên package, tên tool `ZALO_TOOL_DEFINITIONS` (chỉ đổi đường dẫn).
- Không đổi form đăng nhập trên web, không đổi thời hạn session.
