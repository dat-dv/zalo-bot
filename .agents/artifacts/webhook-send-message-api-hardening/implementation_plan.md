# Kế hoạch: Siết chặt Webhook API gửi tin nhắn

Task gốc: `.agents/artifacts/webhook-send-message-api/` (code chưa commit). Plan này sửa các điểm phát hiện khi review.

- Route: `implement` · Authority hiện tại: `inspect-and-plan`
- Mức rủi ro: **MEDIUM** (đổi hành vi bảo mật + đổi tên contract, nhưng code chưa phát hành nên không ai đang phụ thuộc)

## 1. Bối cảnh

Endpoint `POST /api/webhooks/send` đã chạy (typecheck pass, 10/10 test webhook pass, docs-drift pass), nhưng còn:

1. Không đặt `WEBHOOK_API_KEY` thì endpoint mở cho mọi người, nghĩa là ai biết URL cũng nhắn được bằng tài khoản Zalo của bot.
2. Tin chỉ có khoảng trắng vẫn trả `200 success: true`, dù không có tin nào được gửi.
3. Không giới hạn độ dài tin và số lần gọi.
4. So sánh key bằng `!==`, không chạy trong thời gian cố định; guard đọc `process.env` thừa.
5. Có 6 đường dẫn alias, trong khi `API_ROUTES` chỉ khai báo 1.
6. `npm run lint` fail (9 lỗi prettier).
7. Tên contract lệch quy ước `I<Feature>Request/Response`; tin webhook vào trí nhớ dưới dạng `bot_chat`; spec dùng `as unknown as ExecutionContext`.

## 2. Thay đổi đề xuất

### 2.1 Không đặt key thì tắt endpoint (fail-closed)
File: `apps/api/src/zca/webhook/guards/webhook-api-key.guard.ts`
- Tách phần kiểm tra key thành hàm thuần `isWebhookKeyValid(configuredKey, headers): boolean` (file mới `webhook-api-key.ts` cùng thư mục) để test được mà không cần ép kiểu `ExecutionContext`.
- `WEBHOOK_API_KEY` trống thì ném `NotFoundException`: endpoint coi như không tồn tại, không lộ là có webhook. Bỏ log cảnh báo ở mỗi request; thay vào đó log **một lần** lúc khởi động (`onModuleInit`) rằng webhook đang tắt.
- Chỉ đọc key qua `ConfigService.get('webhook.apiKey')`, bỏ fallback `process.env`.
- So sánh bằng `crypto.timingSafeEqual` trên SHA-256 của hai chuỗi (băm trước để hai buffer cùng độ dài).
- Giữ nguyên hai cách truyền key: `x-api-key` và `Authorization: Bearer`.

File: `apps/api/src/config/env.validator.ts`
- Nếu `WEBHOOK_API_KEY` có giá trị thì bắt buộc dài ít nhất 32 ký tự, kèm thông báo lỗi tiếng Việt giống cách `DASHBOARD_LOGIN_CODE` đang làm. Trống thì hợp lệ (webhook tắt).

File: `apps/api/src/config/configuration.ts`: bỏ `|| ''` thừa, dùng `readEnv('WEBHOOK_API_KEY')`.

### 2.2 Kiểm tra body chặt hơn
File: `apps/api/src/zca/webhook/dto/webhook-send-message.dto.ts`
- `message`: thêm `@Matches(/\S/)` để chặn tin toàn khoảng trắng (trả 400), và `@MaxLength(WEBHOOK_MESSAGE_MAX_LENGTH)` với hằng số **5000 ký tự** (tối đa khoảng 3 tin Zalo).
- `targetId`: thêm `@Matches(/\S/)` và `@MaxLength(64)`.
- Không phụ thuộc vào `transform` của ValidationPipe; chỉ dùng validator.

File: `apps/api/src/zca/webhook/zca-webhook.controller.ts`
- Phòng thủ thêm: nếu messenger trả `success: true` mà không có `msgId` (không có tin nào đi) thì ném `BadGatewayException` thay vì trả 200.

### 2.3 Giới hạn số lần gọi
File mới: `apps/api/src/zca/webhook/webhook-rate-limiter.ts`
- Làm theo mẫu `reports/access-code-rate-limiter.ts`: đếm bằng `RedisService.incrWithTtl`, Redis lỗi thì đếm trong process.
- Giới hạn **30 lần gọi/phút cho toàn bộ webhook**. Webhook chỉ có một key dùng chung nên đếm theo key/IP không thêm được gì.
- Vượt giới hạn thì controller ném `HttpException(429)` kèm thông báo tiếng Việt. Đếm **sau** khi guard đã xác thực key, để request sai key không làm cạn hạn mức của người dùng thật.
- Đăng ký provider trong `zca.module.ts` (`RedisModule` là `@Global`).

### 2.4 Chỉ giữ một đường dẫn
- `@Controller('webhooks')` + `@Post('send')`, khớp `API_ROUTES.webhookSendMessage = '/api/webhooks/send'`. Bỏ `webhook`, `send-message`, `messages`. Code chưa phát hành nên không có caller nào bị ảnh hưởng.

### 2.5 Contract và trí nhớ
File: `packages/contracts/src/index.ts`
- Đổi tên `WebhookSendMessageDto` → `IWebhookSendMessageRequest`, `WebhookSendMessageResponse` → `IWebhookSendMessageResponse`; bỏ field `error?` không dùng (lỗi đi qua exception filter chung).
- Cập nhật import ở DTO và controller.

File: controller
- Bọc lời gọi gửi trong `OutgoingMemoryKind.run('system', ...)` để tin webhook trong nhóm đang listen được lưu đúng là thông báo hệ thống, không phải câu bot tự trò chuyện.

### 2.6 Test
File: `apps/api/src/zca/webhook/zca-webhook.controller.spec.ts` (+ spec mới cho key và rate limiter)
- Test `isWebhookKeyValid` trực tiếp: trống, sai, đúng qua `x-api-key`, đúng qua `Bearer`, khác độ dài. Không còn `as unknown as ExecutionContext`.
- Test guard: key không cấu hình thì ném `NotFoundException`.
- Test DTO bằng `validate()` của class-validator: tin toàn khoảng trắng, tin dài 5001 ký tự, `threadType` sai thì đều lỗi.
- Test controller: thành công nhưng không có `msgId` thì ném 502; bị rate limit thì ném 429 và không gọi messenger.
- Test rate limiter: tới lần 31 trong cửa sổ thì bị chặn; Redis trả `null` thì đếm trong process.
- Mock controller giữ kiểu `as never` như các spec hiện có.

### 2.7 Lint, env, tài liệu
- Chạy `eslint --fix` cho các file webhook.
- `.env.example`: ghi rõ trống = **tắt** webhook, đặt key ≥ 32 ký tự (gợi ý `openssl rand -hex 32`); bỏ dòng trống thừa.
- `.agents/knowledge/modules/zca/webhook.md` (EN) và `.agents/docs/modules/zca/webhook.md` (VI): một đường dẫn duy nhất, fail-closed (404), giới hạn 5000 ký tự, 30 lần/phút (429), tin webhook lưu trí nhớ dạng `system`, tên contract mới. Cập nhật mục liên quan trong `README.md` của zca nếu có nhắc alias hoặc chế độ mở.

## 3. Ngoài phạm vi

- Không sửa việc `ZcaMessengerService` ghi toàn bộ nội dung tin vào log khi ZCA chưa đăng nhập (hành vi có sẵn, dùng chung cho mọi luồng gửi).
- Không thêm audit log cho tin gửi ra, gửi file/ảnh, tag người hay danh sách nhiều người nhận.
- Không commit; anh tự commit (hook pre-commit sẽ tự bump version).

## 4. Kiểm tra sau khi sửa

1. `npx eslint apps/api/src/zca/webhook apps/api/src/config`
2. `npm run typecheck`
3. `npm run test --workspace @zalobot/api` (toàn bộ, báo đúng số test pass/fail)
4. `node .claude/hooks/docs-drift-check.mjs`
5. Nếu ZCA đang đăng nhập ở local: gọi `curl` thử 4 trường hợp (không key → 404 khi chưa cấu hình, sai key → 401, tin trống → 400, gửi thật → 200). Không làm được thì ghi rõ là chưa kiểm tra.

## 5. Cần anh quyết

- Hai con số **5000 ký tự** và **30 lần/phút** có hợp với nhu cầu không?
- Webhook tắt thì trả **404** (giấu endpoint) hay **503** (báo rõ là chưa cấu hình)? Em đề xuất 404.
