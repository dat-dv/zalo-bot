# Kế hoạch triển khai: Tự động đóng/hủy thao tác xác nhận cũ khi người dùng nhắn tiếp

Người dùng phản ánh vấn đề trải nghiệm (UX): Khi bot đang hiển thị hộp thoại xác nhận (Confirmation box với nút bấm `[✅ Xác nhận]` và `[❌ Hủy]`) cho một thao tác (ví dụ: tạo giao dịch thu-chi, tạo task, xóa reminder...), nếu người dùng không bấm nút mà tiếp tục nhắn tin (ví dụ: bổ sung thông tin "vào lúc 3h" hoặc đổi ý), các nút bấm trên tin nhắn cũ vẫn còn hiệu lực và mở trên zalo, dẫn đến nguy cơ người dùng bấm nhầm gây trùng lặp dữ liệu hoặc thực thi hành động lỗi thời.

## Mục tiêu cần đạt

1. Khi người dùng gửi tin nhắn mới (text, voice, photo, lệnh slash command hoặc yêu cầu hành động mới), hệ thống sẽ **tự động hủy/đóng tất cả các yêu cầu xác nhận đang chờ (pending tool actions & pending voice requests)** của người dùng đó.
2. Tự động **cập nhật lại tin nhắn zalo cũ** (edit message text thành `❌ Đã hủy thao tác.` hoặc `❌ Đã hủy yêu cầu từ voice.` và gỡ bỏ các nút bấm inline keyboard) để người dùng không thể bấm nhầm.
3. Nếu người dùng bấm vào các nút bấm cũ đã hết hạn hoặc đã bị hủy, hệ thống hiển thị thông báo "Yêu cầu không còn hiệu lực" và tự động gỡ bỏ inline buttons trên tin nhắn đó.

---

## User Review Required

> [!IMPORTANT]
>
> - **Phạm vi tác động**: Thay đổi cơ chế quản lý hàng chờ xác nhận trong `GeminiService`, `VoiceTranscriptionService` và lớp tiếp nhận sự kiện zalo `zaloUpdate`.
> - **Hành vi người dùng**: Mỗi người dùng tại một thời điểm chỉ có tối đa **1 thao tác chờ xác nhận** đang mở trên giao diện zalo chat. Bất kỳ tin nhắn/lệnh mới nào cũng sẽ tự động đóng thao tác cũ và mở thao tác mới (nếu có).

---

## Proposed Changes

### Component 1: `apps/api/src/gemini/`

#### [MODIFY] [`gemini.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.service.ts)

- Bổ sung `chatId?: number | string` và `messageId?: number` vào interface `PendingToolAction`.
- Thêm phương thức `attachMessageToPendingAction(actionId: string, chatId: number | string, messageId: number): void` để liên kết tin nhắn zalo đã gửi với action ID trong hàng chờ.
- Thêm phương thức `cancelPendingActionsForUser(userId: number): Array<PendingToolAction & { id: string }>` để hủy tất cả action đang chờ của user và trả về danh sách đã hủy (kèm thông tin `chatId`, `messageId` để edit tin nhắn).
- Cập nhật `confirmPendingAction` và `cancelPendingAction` đảm bảo dọn dẹp an toàn.

---

### Component 2: `apps/api/src/zalo/services/`

#### [MODIFY] [`voice-transcription.service.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/voice-transcription.service.ts)

- Bổ sung `chatId?: number | string` và `messageId?: number` vào interface `PendingVoiceRequest`.
- Thêm phương thức `attachMessageToPendingVoice(requestId: string, chatId: number | string, messageId: number): void`.
- Thêm phương thức `cancelPendingVoiceRequestsForUser(userId: number): Array<PendingVoiceRequest & { id: string }>`.

---

### Component 3: `apps/api/src/zalo/`

#### [MODIFY] [`zalo.update.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/zalo.update.ts)

- Bổ sung hàm private helper: `cancelPendingUserActions(ctx: Context, userId: number): Promise<void>`:
  - Gọi `geminiService.cancelPendingActionsForUser(userId)`. Với mỗi action có `chatId` và `messageId`, gọi `ctx.zalo.editMessageText(...)` để cập nhật nội dung tin nhắn thành `❌ Đã hủy thao tác.` kèm thông báo đã hủy, loại bỏ các nút xác nhận cũ.
  - Gọi `voiceTranscriptionService.cancelPendingVoiceRequestsForUser(userId)`. Với mỗi request voice có `chatId` và `messageId`, gọi `ctx.zalo.editMessageText(...)` để cập nhật tin nhắn voice thành `❌ Đã hủy yêu cầu từ voice.`.
  - Bọc trong `try/catch` an toàn để không ảnh hưởng luồng chính nếu zalo API trả về lỗi (như tin nhắn đã bị xóa).
- Tích hợp `attachMessageToPendingAction` sau khi gọi `ctx.reply(...)` trong `requestToolConfirmation` và `processAgentRequest`.
- Tích hợp `attachMessageToPendingVoice` sau khi gửi tin nhắn voice confirmation trong `onVoiceMessage`.
- Gọi `cancelPendingUserActions` ở đầu các handler:
  - `@On('text')` (`onTextMessage`)
  - `@On('voice')` (`onVoiceMessage`)
  - `@On('photo')` (`onPhotoMessage`)
  - Các lệnh command chính (`@Command`: `today`, `week`, `tasks`, `finance`, `debts`, `reminders`, `dashboard`, `start`, `help`, etc.)
- Trong callback `@Action(/^confirm:(.+)$/)`, `@Action(/^cancel:(.+)$/)`, `@Action(/^voice:.*$/)`: Khi gặp action đã hết hạn hoặc không tồn tại, tự động gọi `ctx.editMessageReplyMarkup(undefined)` để dọn dẹp các nút bấm bị treo.

---

### Component 4: Verification & Automated Tests

#### [MODIFY] [`zalo.update.spec.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/zalo.update.spec.ts)

- Bổ sung unit test kiểm tra luồng: Khi user có action đang chờ xác nhận, gửi tin nhắn text mới sẽ kích hoạt việc hủy action cũ và gửi lệnh edit message text tới zalo API.

#### [MODIFY] [`gemini.service.spec.ts`](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/gemini/gemini.service.spec.ts)

- Bổ sung test kiểm tra `cancelPendingActionsForUser` và `attachMessageToPendingAction`.

---

## Verification Plan

### Automated Tests

1. Chạy bộ unit tests của backend:
   ```bash
   npm run test --workspace @zalobot/api
   ```
2. Kiểm tra TypeScript typecheck:
   ```bash
   npm run typecheck --workspace @zalobot/api
   ```
3. Kiểm tra Agent System Validation:
   ```bash
   npm run agent-system:validate
   ```

### Manual Verification

1. Gửi yêu cầu tạo bill: _"giúp anh tạo bill hôm nay anh mua bánh ngọt ở bách hoá xanh hết 64k"_.
2. Bot phản hồi hộp xác nhận REQ-xxxx kèm 2 nút `[✅ Xác nhận]` `[❌ Hủy]`.
3. Không bấm nút, tiếp tục gửi tin nhắn: _"vào lúc 3h"_.
4. Kiểm tra tin nhắn xác nhận cũ: đã được tự động edit thành `❌ Đã hủy thao tác.` và biến mất nút bấm.
5. Tin nhắn mới hiển thị hộp xác nhận mới cập nhật đúng 15:00.
