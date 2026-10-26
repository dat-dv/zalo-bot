# Implementation plan: thu hồi thẻ khi hết hạn

Risk: MEDIUM. Sửa `ZcaService` (gửi và thu hồi tin), không đổi DB, API hay contract.

## Hiện tượng (anh Đạt xác nhận)
Thẻ hết hạn thì bot có gửi "[mã] Hết hạn, chưa lưu" nhưng thẻ **vẫn còn** trong chat. Như vậy hẹn giờ vẫn chạy và `handleTimeout` có gọi thu hồi, chỉ là lệnh thu hồi không có tác dụng. Loại được giả thuyết "API khởi động lại" trong investigation.md.

## Nguyên nhân
- Lệnh thu hồi của Zalo (`api.undo`) cần **đúng `cliMsgId`** của tin, tức `clientId` mà zca-js tự tạo bằng `Date.now()` lúc gửi (`zca-js/dist/apis/sendMessage.js`, `handleMessage`).
- Kết quả trả về của `sendMessage` chỉ có `msgId` (`SendMessageResult = { msgId }`), không có `cliMsgId`. Vì vậy `ZcaService.sendMessageWithResult` luôn trả `cliMsgId = undefined`.
- Bot chỉ biết `cliMsgId` của thẻ nó gửi trong hai trường hợp:
  1. **Có người thả cảm xúc** vào thẻ: sự kiện reaction có `rMsg[0].cMsgID` → `trackMsgCliId` (`zca.service.ts:1597`).
  2. **Bật self-listen** (`ZCA_SELF_LISTEN=true`, mặc định tắt): bot nhận lại echo tin của chính mình, có `cliMsgId` (`:1553`).
- Thẻ hết hạn thường là thẻ **không ai đụng tới**, nên bot không có `cliMsgId`. Khi đó `undoMessage`/`undo` gửi `cliMsgIdUndo = msgId` (sai), Zalo không thu hồi.
- Lệnh `undo` lỗi thì `undoMessage` chuyển sang `deleteMessage(onlyMe = true)`, chỉ xoá ở phía bot, nhưng vẫn **trả `true`** và không ai biết là đã thất bại (`zca.service.ts:~1810`).
- Hệ quả phụ: duyệt hoặc huỷ bằng gõ `yes/cancel <mã>` (không thả cảm xúc) nhiều khả năng cũng không thu hồi được thẻ. Duyệt hoặc huỷ bằng ❤️/😡 thì thu hồi được, vì reaction mang `cMsgID`.

## Thay đổi

### 1. Biết `cliMsgId` ngay lúc gửi (`zca.service.ts`)
- Thêm helper thuần `captureClientId(send)` trong file mới `apps/api/src/zca/zca-client-id.util.ts`.
  - Trong lúc gọi `send()`, nó tạm bọc `Date.now` để ghi lại giá trị **đầu tiên** được đọc, rồi trả lại `Date.now` gốc ngay trong `finally`.
  - Tin chữ của zca-js 2.2.0 tạo `clientId: Date.now()` **đồng bộ**, ngay trong lần gọi `api.sendMessage` (chưa có `await` nào trước đó). Vì vậy giá trị đầu tiên chính là `clientId`, cũng là `cliMsgId` của tin.
  - Phần bọc chỉ tồn tại trong một khoảng chạy đồng bộ, nên không đoạn code nào khác chen vào được.
- `sendMessageWithResult`:
  - Dùng helper khi gửi tin chữ; trả `{ msgId, cliMsgId }`.
  - Gọi `trackMsgCliId(msgId, cliMsgId)` để mọi lần thu hồi sau đều tìm được, kể cả tin không phải thẻ.
  - Nếu zca-js sau này có trả `cliMsgId` thì ưu tiên giá trị đó.
- Phạm vi: chỉ tin chữ (thẻ, thông báo). Tin có file đính kèm không đổi.

### 2. Không báo thu hồi thành công khi thực ra thất bại (`undoMessage`)
- `undo` lỗi → `logger.warn` kèm msgId/cliMsgId và **trả `false`**.
- Bỏ bước `deleteMessage(onlyMe = true)`. Bước này chỉ ẩn thẻ khỏi máy của bot, người trong nhóm vẫn thấy, và nó làm mất dấu lỗi.
- Không có `cliMsgId` (không có trong cache, không nhận được lúc gửi) → `logger.warn` rõ ràng "thiếu cliMsgId", vẫn thử undo như hiện tại.

### 3. Không đổi
- `TransactionConfirmationService`: `setMessageId` đã lưu `cliMsgId` khi có, nên hết hạn, duyệt và huỷ đều tự dùng đúng mã.
- `ZCA_SELF_LISTEN` giữ nguyên mặc định.

## Tests
- `zca-client-id.util.spec.ts`:
  - Bắt đúng giá trị `Date.now()` đầu tiên trong lúc gọi.
  - `Date.now` được trả lại cả khi `send` ném lỗi đồng bộ hoặc reject.
  - Trả `undefined` khi `send` không đọc giờ.
- `zca.service` spec (nếu có harness, dùng API giả):
  - `sendMessageWithResult` trả `cliMsgId` bằng `clientId` mà API giả đã đọc qua `Date.now()`, và cache được cặp `msgId → cliMsgId`.
  - `undoMessage` trả `false` khi `api.undo` ném lỗi, không gọi `deleteMessage`.
- Chạy `npm run typecheck`, `npm run lint`, `npm run test --workspace @zalobot/api`.

## Thử tay sau khi deploy
1. Tạo thẻ lời nhắc trong nhóm, không đụng vào, đợi 5 phút → thẻ bị thu hồi, có tin "Hết hạn, chưa lưu". Log có `Successfully recalled message … (cliMsgId: <số>)`, và số đó khác msgId.
2. Tạo thẻ rồi gõ `yes <mã>` (không thả tim) → thẻ bị thu hồi.

## Rủi ro
- Helper dựa vào cách zca-js 2.2.0 tạo `clientId` cho tin chữ. Nếu nâng cấp zca-js làm đổi cách này thì `cliMsgId` sai, thu hồi lại hỏng, nhưng nhờ thay đổi 2 sẽ có log cảnh báo.
  - Ghi chú ràng buộc này trong knowledge/docs của module zca.
  - Ghi chú trong code ngay chỗ gọi helper.
- Không dùng self-listen (anh Đạt chốt 26/10/2026): mã được bắt ngay trong lần gửi thẻ, không cần nghe lại tin của chính bot.

## Tài liệu
- `.agents/knowledge/modules/zca/README.md` và `.agents/docs/modules/zca/README.md`: cách bot biết `cliMsgId` của tin nó gửi (bắt `clientId` lúc gửi, cache 24 giờ); thu hồi thất bại thì trả `false`, không còn xoá phía bot.
- Cập nhật `investigation.md`: đổi nguyên nhân thành `cliMsgId`.
