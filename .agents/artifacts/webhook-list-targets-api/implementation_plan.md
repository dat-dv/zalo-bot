# Kế hoạch: API lấy danh sách người nhận cho webhook

- Route: `implement` · Authority hiện tại: `inspect-and-plan`
- Nhánh: tiếp tục trên `feat/webhook-send-message` (webhook gửi tin chưa merge)
- Mức rủi ro: **MEDIUM** (lộ danh bạ Zalo của bot cho bên ngoài nếu thiết kế sai)

## 1. Bối cảnh

Bên tích hợp cần biết `targetId` của người hoặc nhóm để cấu hình gửi tin. Hiện họ phải xin admin tra trên trang `/zca`. Cần một API cùng khoá webhook để họ tự lấy danh sách và hiển thị cho người dùng của họ chọn.

Nguồn dữ liệu có sẵn: `ZcaService.getAvailableThreads()` trả về bạn bè và nhóm của tài khoản bot từ danh bạ cache (bộ nhớ hoặc Redis, tự làm mới ngầm khi cũ), kèm cờ `isListened`.

## 1b. Gỡ hướng "Cài đặt → Webhook" (anh đã chốt: người nhận do website bên kia chọn)

Phiên `Webhook tích hợp và cấu hình env` đã để lại thay đổi chưa commit theo plan `webhook-recipients-settings`. Bước đầu của Phase 2 là trả các file đó về trạng thái commit `8a475344`:

- Khôi phục bằng `git restore`: `apps/api/src/zca/webhook/{zca-webhook.controller.ts, zca-webhook.controller.spec.ts, dto/webhook-send-message.dto.ts}`, `apps/api/src/zca/zca.module.ts`, `apps/api/src/database/{data-source.ts, database.module.ts}`, `packages/contracts/src/index.ts`, `apps/web/src/modules/settings/presentation/components/settings-screen.tsx`, `.agents/{knowledge,docs}/modules/zca/webhook.md`, `.agents/{knowledge,docs}/modules/settings/README.md`.
- Xoá file mới: entity `webhook-recipient.entity.ts`, migration `1725000000000-CreateWebhookRecipients.ts`, `webhook-recipient.service.ts`, `webhook-recipients.controller.ts`, `dto/update-webhook-recipients.dto.ts`, `apps/web/src/modules/settings/api/webhook-recipients-{api,query}.ts`, `apps/web/src/modules/settings/model/`, `webhook-recipients-panel.tsx`.
- Giữ lại plan `.agents/artifacts/webhook-recipients-settings/` để làm lịch sử.
- Migration chưa chạy trên production (chưa merge), nên xoá không để lại bảng thừa. Nếu anh đã chạy app local với migration đó, bảng `webhook_recipients` local còn lại vô hại; có thể drop tay.

Sau bước này, `POST /api/webhooks/send` quay về đúng như commit `8a475344` (`targetId` bắt buộc, có `threadType`).

## 2. Thiết kế API

`GET /api/webhooks/targets` (hằng `API_ROUTES.webhookTargets`)

- **Xác thực**: cùng `WebhookApiKeyGuard` (`x-api-key` hoặc `Bearer`; webhook tắt thì 404).
- **Query** (đều tuỳ chọn):
  - `type`: `user` | `group`, lọc theo loại.
  - `q`: tìm theo tên, không phân biệt hoa thường và dấu (tối đa 100 ký tự).
- **Response 200**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        { "id": "123456789012345678", "name": "Nhóm Kế toán", "type": "group", "avatar": "https://...", "totalMembers": 12 },
        { "id": "987654321", "name": "Nguyễn Văn A", "type": "user", "avatar": "https://..." }
      ],
      "fetchedAt": "2026-10-28T08:00:00.000Z"
    }
  }
  ```
  - `id` dùng thẳng làm `targetId`, `type` dùng thẳng làm `threadType` khi gọi `POST /api/webhooks/send`.
  - `fetchedAt`: lúc danh bạ được lấy từ Zalo lần cuối, để bên kia biết dữ liệu mới tới đâu.
  - Sắp xếp: nhóm trước, rồi theo tên.
- **Chỉ trả các trường an toàn**: `id`, `name`, `type`, `avatar`, `totalMembers`. **Không** trả `phoneNumber`, `alias` (biệt danh admin đặt), `zaloName`, `isListened`.
- **Không bao giờ ép tải lại từ Zalo** (`forceRefresh` luôn `false`), để bên ngoài không làm bot gọi Zalo liên tục.
- **Lỗi**: `401`/`404` như gửi tin; `503` khi ZCA chưa đăng nhập; `429` khi vượt giới hạn.

## 3. Thay đổi code

1. `packages/contracts/src/index.ts`: thêm `API_ROUTES.webhookTargets = '/api/webhooks/targets'`, `IWebhookTarget`, `IWebhookTargetsQuery`, `IWebhookTargetsResponse`.
2. `apps/api/src/zca/webhook/dto/webhook-targets-query.dto.ts` (mới): `type` (`@IsOptional @IsIn`), `q` (`@IsOptional @IsString @MaxLength(100)`).
3. `apps/api/src/zca/webhook/webhook-targets.ts` (mới, hàm thuần): `toWebhookTargets(threads, query)` lọc theo `type`/`q`, bỏ trường nhạy cảm, sắp xếp. So khớp tên bằng chuẩn hoá bỏ dấu; dùng helper bỏ dấu đã có trong repo nếu có, không thì viết ngắn bằng `normalize('NFD')`.
4. `apps/api/src/zca/webhook/webhook-rate-limiter.ts`: thêm tham số phạm vi `tryCall(scope: 'send' | 'targets')`, mỗi phạm vi một bộ đếm Redis riêng (`webhook:send:calls`, `webhook:targets:calls`). Giới hạn: gửi tin giữ **30 lần/phút**, lấy danh sách **10 lần/phút**. Như vậy lấy danh sách không ăn vào lượt gửi tin.
5. `apps/api/src/zca/webhook/zca-webhook.controller.ts`: thêm `@Get('targets')` trả `IWebhookTargetsResponse`, cập nhật lời gọi `tryCall('send')`.

## 4. Test

- `toWebhookTargets`: lọc theo `type`, tìm `q` có/không dấu (`"ke toan"` khớp `"Kế toán"`), không lộ `phoneNumber`/`alias`, thứ tự nhóm trước.
- Controller: 503 khi chưa đăng nhập, 429 khi vượt hạn mức, gọi `getAvailableThreads(false)`.
- Rate limiter: hai phạm vi đếm riêng, `targets` bị chặn ở lần 11.
- DTO query: `type` sai hoặc `q` quá 100 ký tự thì lỗi.

## 5. Tài liệu

- `.agents/knowledge/modules/zca/webhook.md` (EN) và `.agents/docs/modules/zca/webhook.md` (VI): mục API danh sách người nhận, trường được trả, giới hạn 10 lần/phút.
- Trang hướng dẫn tích hợp đã đăng (artifact): thêm mục "Lấy danh sách người nhận" kèm ví dụ.

## 6. Kiểm tra

1. `npx eslint apps/api/src/zca/webhook`
2. `npm run typecheck`
3. `npm run test --workspace @zalobot/api`
4. `node .claude/hooks/docs-drift-check.mjs`

Không commit cho tới khi anh bảo.

## 7. Đã chốt

- Người nhận do website bên kia chọn và lưu; Zalobot không có màn cài đặt người nhận.
- Danh sách trả **tất cả bạn bè và nhóm** của bot, có `avatar` để chọn đúng người.
- Giới hạn API danh sách 10 lần/phút.
