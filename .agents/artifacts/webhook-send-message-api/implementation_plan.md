# Kế hoạch: Webhook API gửi tin nhắn Zalo cho bên ngoài

- Route: implement · Phase 1 (Planning) · Risk: **LOW** (Thêm endpoint webhook API mới, không ảnh hưởng các luồng hiện tại của bot)
- Task slug: `webhook-send-message-api`
- Trạng thái: Chờ anh duyệt trước khi thực thi

---

## 1. Yêu cầu & Mục tiêu

Anh muốn tạo 1 API dạng Webhook để hệ thống khác (hoặc người khác) có thể gọi `POST` vào:
- Bot Zalo sẽ tự động gửi tin nhắn tới người nhận chỉ định.
- Payload tối thiểu cần có:
  - `targetId`: ID người nhận hoặc ID nhóm trên Zalo (chatId / threadId).
  - `message`: Nội dung tin nhắn cần gửi.

### Các yếu tố bổ sung để API hoàn chỉnh & an toàn:
1. **Bảo mật (Authentication / API Key)**:
   - Hỗ trợ biến môi trường `WEBHOOK_API_KEY`.
   - Khi gọi API, bên ngoài truyền qua header `x-api-key: <KEY>` hoặc `Authorization: Bearer <KEY>`.
   - Nếu `WEBHOOK_API_KEY` được cấu hình, bắt buộc phải khớp (tránh bị lộ IP/domain rồi bị kẻ xấu spam tin nhắn qua tài khoản bot).
   - Nếu chưa cấu hình `WEBHOOK_API_KEY` (ví dụ dev local), hệ thống ghi log warning và cho phép gọi.
2. **Hỗ trợ tin nhắn dài**:
   - Sử dụng `ZcaMessengerService` đã có sẵn cơ chế chia nhỏ tin (chunking tối đa 1900 ký tự) để không bị lỗi giới hạn độ dài của Zalo.
3. **Tự động nhận diện loại hội thoại (User vs Group)**:
   - Dùng `resolveThreadType` của bot để tự biết `targetId` là chat riêng (User) hay nhóm (Group).
   - Ngoài ra hỗ trợ tuỳ chọn `threadType?: 'user' | 'group'` nếu bên gọi muốn chỉ định tường minh.
4. **Kiểm tra trạng thái đăng nhập bot**:
   - Nếu bot Zalo (ZCA) chưa đăng nhập (hoặc mất session QR), trả về mã `503 Service Unavailable` kèm thông báo rõ ràng để bên gọi biết và thử lại sau.

---

## 2. Thiết kế API Contract & DTO

### Endpoint
- URL: `POST /api/webhooks/send` (hỗ trợ thêm alias `POST /api/webhook/send`)
- Header:
  - `Content-Type: application/json`
  - `x-api-key: <WEBHOOK_API_KEY>` (hoặc `Authorization: Bearer <WEBHOOK_API_KEY>`)

### Request Body
```json
{
  "targetId": "123456789012345678",
  "message": "Xin chào! Đây là thông báo tự động từ hệ thống.",
  "threadType": "user" // tuỳ chọn: "user" | "group" (mặc định tự phân giải)
}
```

### Response Specs
- **200 OK** (Gửi tin nhắn thành công):
  ```json
  {
    "success": true,
    "data": {
      "targetId": "123456789012345678",
      "msgId": "987654321",
      "cliMsgId": "123456"
    }
  }
  ```
- **400 Bad Request** (Dữ liệu không hợp lệ):
  ```json
  {
    "statusCode": 400,
    "message": ["targetId không được để trống", "message không được để trống"],
    "error": "Bad Request"
  }
  ```
- **401 Unauthorized** (API Key không đúng hoặc bị thiếu):
  ```json
  {
    "statusCode": 401,
    "message": "Mã API key webhook không hợp lệ hoặc bị thiếu.",
    "error": "Unauthorized"
  }
  ```
- **503 Service Unavailable** (Bot Zalo chưa đăng nhập):
  ```json
  {
    "statusCode": 503,
    "message": "Tài khoản Zalo bot (ZCA) hiện chưa đăng nhập. Vui lòng đăng nhập qua dashboard trước khi gửi tin.",
    "error": "Service Unavailable"
  }
  ```

---

## 3. Các file sẽ tạo / chỉnh sửa

1. **`packages/contracts/src/index.ts`**:
   - Khai báo route `API_ROUTES.webhookSendMessage = '/api/webhooks/send'`.
   - Khai báo DTO interface `WebhookSendMessageDto` và response interface `WebhookSendMessageResponse`.

2. **`apps/api/src/config/`**:
   - `configuration.ts`: Thêm `webhook: { apiKey: readOptionalEnv('WEBHOOK_API_KEY') || '' }`.
   - `env.validator.ts`: Cập nhật cấu hình tuỳ chọn cho `WEBHOOK_API_KEY`.
   - `.env.example`: Thêm dòng mẫu `WEBHOOK_API_KEY=your-secret-api-key`.

3. **`apps/api/src/zca/webhook/`** (Module tính năng trong ZCA):
   - `dto/webhook-send-message.dto.ts`: DTO validate bằng `class-validator` (`@IsNotEmpty`, `@IsString`, `@IsIn`).
   - `guards/webhook-api-key.guard.ts`: Guard kiểm tra API key từ header `x-api-key` hoặc `Authorization: Bearer`.
   - `zca-webhook.controller.ts`: Controller nhận POST request, kiểm tra login của ZCA, gọi gửi tin nhắn qua `ZcaMessengerService`.
   - `zca-webhook.controller.spec.ts`: Unit test đầy đủ (auth pass/fail, validation, bot chưa login 503, gửi tin thành công 200).

4. **`apps/api/src/zca/zca-messenger.service.ts`**:
   - Mở rộng hàm `sendMessageWithResult` để nhận thêm tham số tuỳ chọn `type?: ThreadType` (tương thích 100% với các code cũ).

5. **`apps/api/src/zca/zca.module.ts`**:
   - Đăng ký `ZcaWebhookController` và `WebhookApiKeyGuard`.

6. **Tài liệu & Knowledge (`.agents/docs/` & `.agents/knowledge/`)**:
   - Cập nhật tài liệu module `zca` mô tả tính năng Webhook API.
   - Đảm bảo `node .claude/hooks/docs-drift-check.mjs` đạt PASS 0 lỗi.

---

## 4. Kế hoạch kiểm thử & nghiệm thu

1. Chạy `npm run typecheck` xác nhận toàn bộ TypeScript monorepo compile sạch sẽ.
2. Chạy test suite `zca-webhook.controller.spec.ts` và `npm run test` để đảm bảo logic hoạt động chính xác.
3. Chạy kiểm tra tài liệu `node .claude/hooks/docs-drift-check.mjs`.
4. Hướng dẫn anh cách cấu hình `WEBHOOK_API_KEY` và ví dụ lệnh `curl` để gọi test thử ngay.
