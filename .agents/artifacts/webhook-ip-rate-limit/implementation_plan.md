# Kế hoạch: Chặn spam webhook theo IP

- Route: `implement` · Authority hiện tại: `inspect-and-plan`
- Nhánh: tiếp tục trên `feat/webhook-status` (API status đã làm xong, chưa commit)
- Mức rủi ro: **MEDIUM** (thêm lớp chặn trước mọi request webhook; cấu hình sai có thể chặn nhầm bên tích hợp thật)

## 1. Bối cảnh

Hiện chỉ request **đúng key** mới bị đếm (gửi 30, danh sách 10, trạng thái 60 lần/phút). Request **sai hoặc thiếu key** bị trả `401` mà không bị giới hạn: có thể bị dùng để dò key và làm ngập log/api.

## 2. Thiết kế

Thêm một lớp chặn **chạy trước bước kiểm tra key**, áp cho cả 3 API (`send`, `targets`, `status`):

1. **Giới hạn theo IP:** tối đa **120 request/phút mỗi IP**, đúng hay sai key đều đếm. Vượt thì trả `429` ngay, không kiểm tra key, không gọi gì thêm.
2. **Khoá IP sai key:** một IP sai key quá **10 lần trong 15 phút** thì bị khoá **15 phút** (`429`), kể cả khi lần sau gửi đúng key. Đếm sai key nằm trong `WebhookApiKeyGuard`, ngay chỗ trả `401`.
3. **Log gọn:** chỉ ghi log khi một IP vừa bị khoá hoặc vừa chạm giới hạn lần đầu trong cửa sổ, không ghi từng request.
4. Giới hạn theo route hiện có (30/10/60 mỗi phút, tính chung mọi bên gọi) **giữ nguyên**, chạy sau hai lớp trên.

Thứ tự xử lý một request: giới hạn IP → IP có đang bị khoá → kiểm tra key (sai thì cộng lỗi cho IP) → giới hạn theo route → xử lý.

### Lấy IP client
- Dùng đúng cách trang đăng nhập bằng mã đang làm: `cf-connecting-ip` → `x-real-ip` → `req.ip`. Tách hàm `getClientIp` hiện nằm riêng trong `reports.controller.ts` ra `apps/api/src/common/utils/client-ip.util.ts` để hai nơi dùng chung (không đổi hành vi trang đăng nhập).
- **Giới hạn đã biết:** các header này có thể bị giả nếu ai đó gọi thẳng vào server không qua Cloudflare, khi đó họ đổi IP giả để né giới hạn theo IP. Khoá 64 ký tự hex nên việc dò key vẫn không khả thi. Em **không** thêm giới hạn chung mọi IP cho request sai key, vì kẻ xấu sẽ dùng nó để chặn luôn bên tích hợp thật.
- Khuyến nghị kèm (anh tự cấu hình, ngoài code): Rate Limiting Rule trên Cloudflare cho `/api/webhooks/*`, và chỉ cho server nhận traffic từ Cloudflare.

## 3. Thay đổi code

1. `apps/api/src/common/utils/client-ip.util.ts` (mới): `getClientIp(req)`; `reports.controller.ts` gọi hàm này thay cho method riêng.
2. `apps/api/src/zca/webhook/webhook-ip-limiter.ts` (mới, `@Injectable`): theo mẫu `WebhookRateLimiter` (Redis `incrWithTtl`, fallback trong tiến trình):
   - `tryRequest(ip)`: đếm `webhook:ip:<ip>:requests` (60 giây), trả `false` khi quá 120.
   - `isLocked(ip)`: đọc khoá `webhook:ip:<ip>:locked`.
   - `recordFailedKey(ip)`: đếm `webhook:ip:<ip>:failed` (15 phút); tới lần thứ 11 thì đặt khoá 15 phút (`RedisService.set` với TTL).
   - Hằng số: `WEBHOOK_IP_MAX_REQUESTS = 120`, `WEBHOOK_IP_MAX_FAILED_KEYS = 10`, `WEBHOOK_IP_LOCK_SECONDS = 900`.
3. `apps/api/src/zca/webhook/guards/webhook-ip-limit.guard.ts` (mới): chạy 1 và 2, ném `429` với thông báo tiếng Việt.
4. `WebhookApiKeyGuard`: khi key sai thì gọi `recordFailedKey(ip)` trước khi ném `401`. Khi webhook tắt (404) thì không đếm.
5. `ZcaWebhookController`: `@UseGuards(WebhookIpLimitGuard, WebhookApiKeyGuard)` (theo đúng thứ tự). Đăng ký provider trong `zca.module.ts`.

## 4. Test

- `getClientIp`: ưu tiên `cf-connecting-ip`, lấy IP đầu trong danh sách, fallback `req.ip`.
- `WebhookIpLimiter`: lần 121 trong phút bị chặn; IP khác không bị ảnh hưởng; sai key lần 11 thì khoá; hết 15 phút thì mở; Redis lỗi vẫn đếm trong tiến trình.
- Guard: IP bị khoá thì `429` dù key đúng; key sai thì tăng bộ đếm lỗi; webhook tắt thì không đếm lỗi.
- Test của trang đăng nhập bằng mã vẫn pass (refactor `getClientIp`).

## 5. Tài liệu

- `.agents/knowledge/modules/zca/webhook.md` (EN), `.agents/docs/modules/zca/webhook.md` (VI): mục giới hạn theo IP, khoá IP, giới hạn về header IP, khuyến nghị Cloudflare.
- Trang hướng dẫn tích hợp: thêm vào mục lưu ý: 120 request/phút mỗi IP; sai key nhiều lần sẽ bị khoá 15 phút.

## 6. Kiểm tra

1. `npx eslint apps/api/src/zca/webhook apps/api/src/common apps/api/src/reports`
2. `npm run typecheck`
3. `npm run test --workspace @zalobot/api`
4. `node .claude/hooks/docs-drift-check.mjs`

Không commit, merge, push cho tới khi anh bảo.

## 7. Cần anh xác nhận

- Các con số: **120 request/phút mỗi IP**, sai key **10 lần / 15 phút** thì khoá **15 phút**.
