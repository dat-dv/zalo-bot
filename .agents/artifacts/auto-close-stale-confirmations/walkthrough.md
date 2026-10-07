# Walkthrough: Tự động đóng/hủy và cập nhật giao diện hộp xác nhận cũ khi có tin nhắn mới

## Mục tiêu đã hoàn thành

Đã xử lý triệt để vấn đề người dùng có thể bấm nhầm vào hộp thoại xác nhận cũ khi tiếp tục nhắn tin trong zalo bot:

- Khi người dùng gửi tin nhắn mới (text, voice, photo) hoặc gọi lệnh (`/start`, `/help`, `/today`, `/week`, `/finance`, `/tasks`, `/debts`, `/reminders`, `/dashboard`, etc.), bot tự động hủy toàn bộ các action/voice request đang chờ xác nhận của người dùng đó.
- Tin nhắn zalo xác nhận cũ được cập nhật tự động (qua zalo API `editMessageText`) thành `❌ Đã hủy thao tác.` (hoặc `❌ Đã hủy yêu cầu từ voice.`) và gỡ bỏ toàn bộ các nút bấm inline keyboard.
- Nếu người dùng bấm vào một nút bấm của yêu cầu đã hết hạn hoặc bị hủy trước đó, bot thông báo `"Yêu cầu không còn hiệu lực"` và tự động gỡ bỏ các nút bấm bị treo.

---

## Các thay đổi chính

### 1. Backend Core (`apps/api/src/gemini/gemini.service.ts`)

- Mở rộng `PendingToolAction` với `chatId?: number | string` và `messageId?: number`.
- Thêm `attachMessageToPendingAction(actionId, chatId, messageId)` để lưu vết tin nhắn zalo gắn liền với action ID.
- Thêm `cancelPendingActionsForUser(userId)` trả về danh sách các action đã hủy kèm `chatId` và `messageId`.

### 2. Voice Transcription Service (`apps/api/src/zalo/services/voice-transcription.service.ts`)

- Mở rộng `PendingVoiceRequest` với `chatId?: number | string` và `messageId?: number`.
- Thêm `attachMessageToPendingVoice(requestId, chatId, messageId)` và `cancelPendingVoiceRequestsForUser(userId)`.

### 3. zalo Update Handler (`apps/api/src/zalo/zalo.update.ts`)

- Bổ sung helper `cancelPendingUserActions(ctx, userId)` để hủy các action/voice request cũ và gọi `editMessageText` cập nhật tin nhắn cũ thành `❌ Đã hủy thao tác.` / `❌ Đã hủy yêu cầu từ voice.`.
- Tích hợp `cancelPendingUserActions` vào đầu các luồng tiếp nhận:
  - `@On('text')` (`onTextMessage`)
  - `@On('voice')` (`onVoiceMessage`)
  - `@On('photo')` (`onPhotoMessage`)
  - `requestToolConfirmation`
  - Các slash command handlers (`/start`, `/help`, `/today`, `/week`, `/finance`, `/tasks`, `/debts`, `/reminders`, `/dashboard`, etc.).
- Bổ sung dọn dẹp `ctx.editMessageReplyMarkup(undefined)` trong các callback handler (`onConfirmAction`, `onCancelAction`, `onVoice*`) khi action không còn hiệu lực.

### 4. Tài liệu & Tri thức hệ thống

- Cập nhật `.agents/knowledge/global/zalo-response-layout.md` (tiếng Anh chuẩn).
- Cập nhật `.agents/docs/global/zalo-response-layout.md` (tiếng Việt).

---

## Kết quả kiểm thử (Verification Results)

### Automated Tests

- **Unit Tests**: Chạy toàn bộ 56 unit test suite backend thành công 100%:
  ```bash
  npm run test --workspace @zalobot/api
  # 56 passed, 0 failed
  ```
- **Typecheck**: Không có bất kỳ lỗi kiểu dữ liệu TypeScript nào:
  ```bash
  npm run typecheck --workspace @zalobot/api
  # 0 errors
  ```
- **Linter & Prettier**: Tuân thủ 100% quy chuẩn ESLint và Prettier:
  ```bash
  npm run lint
  # 0 errors, 0 warnings
  ```
- **Agent System Validation**:
  ```bash
  npm run agent-system:validate
  # 88 artifacts, 152 dependencies, 54 pairs, 0 cyclic dependency groups -> PASSED
  ```
