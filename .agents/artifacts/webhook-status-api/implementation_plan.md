# Kế hoạch: API kiểm tra trạng thái bot cho webhook

- Route: `implement` · Authority hiện tại: `inspect-and-plan`
- Nhánh: tạo `feat/webhook-status` từ `main`
- Mức rủi ro: **LOW** (chỉ thêm endpoint đọc, không đổi API hiện có, không đổi DB)

## 1. Mục tiêu

Bên tích hợp hỏi trước được "bot có gửi được không" để:
- hiện trạng thái "Zalo đang mất kết nối" trên màn của họ,
- tạm dừng hàng đợi gửi khi bot mất đăng nhập, thay vì gửi rồi mới nhận `503`,
- biết còn bao nhiêu lượt gọi trong phút hiện tại để không bị `429`.

## 2. Thiết kế API

`GET /api/webhooks/status` (hằng `API_ROUTES.webhookStatus`)

- **Xác thực**: cùng `WebhookApiKeyGuard` (`x-api-key` hoặc `Bearer`; webhook tắt thì 404, sai key 401).
- **Luôn trả `200` khi key đúng**, kể cả lúc bot mất đăng nhập: trạng thái nằm trong body. Endpoint này không bao giờ trả `503`.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "ready": true,
      "zaloLoggedIn": true,
      "directoryFetchedAt": "2026-10-28T08:00:00.000Z",
      "limits": {
        "send": { "limit": 30, "remaining": 27, "windowSeconds": 60 },
        "targets": { "limit": 10, "remaining": 10, "windowSeconds": 60 }
      },
      "checkedAt": "2026-10-28T13:00:00.000Z"
    }
  }
  ```
  - `ready`: gửi tin được ngay hay không. Hiện bằng `zaloLoggedIn`; tách riêng để sau này thêm điều kiện khác mà bên kia không phải sửa code.
  - `zaloLoggedIn`: tài khoản Zalo của bot đang đăng nhập.
  - `directoryFetchedAt`: lần cuối lấy danh bạ (dùng cho `targets`); `null` nếu chưa lấy.
  - `limits.*.remaining`: số lượt còn lại trong cửa sổ hiện tại, tính chung mọi bên gọi.
- **Không** trả ID/tên tài khoản Zalo của bot, số kênh listen, trạng thái QR hay proxy (thông tin nội bộ của trang admin `GET /api/zca/status`).
- **Giới hạn riêng**: phạm vi `status`, **60 lần/phút**, không ăn vào lượt `send`/`targets`. Bản thân lời gọi status được đếm vào phạm vi `status`.

## 3. Thay đổi code

1. `packages/contracts/src/index.ts`: `API_ROUTES.webhookStatus = '/api/webhooks/status'`, `IWebhookCallLimit`, `IWebhookStatusResponse`.
2. `apps/api/src/zca/webhook/webhook-rate-limiter.ts`:
   - Thêm phạm vi `'status'` vào `WebhookCallScope`, `WEBHOOK_MAX_CALLS.status = 60`.
   - Thêm `remaining(scope, now)`: **đọc** bộ đếm mà không tăng (Redis `get` của `webhook:<scope>:calls`; Redis lỗi thì đọc bộ đếm trong tiến trình; cửa sổ đã hết thì coi là còn đủ). Kết quả kẹp trong `0..limit`.
   - `WebhookCallCounterStore` thêm `get(key)`; `RedisService.get` đã có sẵn.
3. `apps/api/src/zca/webhook/zca-webhook.controller.ts`: thêm `@Get('status')`, gọi `assertWithinRateLimit('status')` rồi trả trạng thái; không gọi `assertLoggedIn`.

## 4. Test

- Rate limiter: `remaining` không làm tăng bộ đếm; giảm đúng sau các lần `tryCall`; Redis trả `null` thì dùng bộ đếm trong tiến trình; cửa sổ hết hạn thì trở về đủ lượt.
- Controller: bot mất đăng nhập vẫn trả `200` với `ready: false`; đếm vào phạm vi `status`; vượt 60 lần thì `429`; body không có trường nội bộ.

## 5. Tài liệu

- `.agents/knowledge/modules/zca/webhook.md` (EN), `.agents/docs/modules/zca/webhook.md` (VI), dòng webhook trong README zca.
- Trang hướng dẫn tích hợp: mục "Kiểm tra trạng thái" với ví dụ và gợi ý dùng (gọi trước khi xả hàng đợi, không gọi trước mỗi tin).

## 6. Kiểm tra

1. `npx eslint apps/api/src/zca/webhook`
2. `npm run typecheck`
3. `npm run test --workspace @zalobot/api`
4. `node .claude/hooks/docs-drift-check.mjs`

Không commit, merge hay push cho tới khi anh bảo.

## 7. Cần anh xác nhận

- Giới hạn **60 lần/phút** cho status có ổn không (đủ cho hệ thống bên kia kiểm tra mỗi giây)?
- Có muốn trả thêm **tên tài khoản Zalo đang gửi** (để bên kia hiển thị "Gửi từ: …") không? Mặc định em không trả.
