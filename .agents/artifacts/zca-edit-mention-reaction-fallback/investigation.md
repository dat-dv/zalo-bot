# Chẩn đoán: log ZCA 20/10/2026 11:03–11:04 (nhóm 7120342145544273834)

## Diễn biến trong log

1. 11:03:18 — "@đen tạo lịch hẹn chiều nay cho a" → tạo thẻ chờ **[125]** "Lịch hẹn chiều nay" 14:00–18:00.
2. 11:04:01 — "@Đen edit 125 quán steak bin & pizza … từ 6h tối" → **không** được hiểu là lệnh sửa [125]; đi thẳng vào LLM, tạo thẻ **mới [783]** với tiêu đề "Edit 125 quán steak…".
3. 11:04:06 — thả tim thẻ [783] → tạo sự kiện. Bot báo "còn 1 yêu cầu chờ" ([125] vẫn treo).
4. 11:04:16 — thả tim vào **tin nhắn kết quả** của [783] (không phải thẻ chờ) → bot **duyệt luôn [125]**, tạo sự kiện "Lịch hẹn chiều nay", đồng thời thu hồi luôn tin kết quả của [783].
5. 11:04:25 — thả tim tin kết quả của [125] → không có pending nào nên bỏ qua (đúng).

Kết quả: lịch có 2 sự kiện, sự kiện 14:00–18:00 là rác, sự kiện kia có tiêu đề chứa chữ "Edit 125".

## Lỗi 1 — Lệnh `edit <mã>` có mention đứng đầu không được nhận

- `zca/zca-bot-feature.service.ts:702-728`: fast-path gọi `confirmationService.handleCommand(senderId, threadId, text, …)` với `text` **thô**, chưa chạy `cleanBotMention` (chỉ được gọi sau đó ở dòng 943/1054).
- `zca/confirmation/transaction-confirmation.service.ts:958-995`: mọi regex đều neo `^` (`^(?:edit|sửa…)`, `^(?:yes|…)`, `^(?:cancel|…)`), nên "@Đen edit 125 …" không khớp.
- Thêm nữa: `cleanBotMention` chỉ bỏ các tên `botName`, "Bot", "Finance Assistant"… — nếu `botName` cấu hình không phải "Đen" thì "@Đen" cũng không bị gỡ. Cách chắc chắn hơn là gỡ theo `data.mentions` (uid = bot, `pos`/`len`) mà Zalo đã gửi kèm.
- Ảnh hưởng: `@bot yes 123`, `@bot cancel 123`, `@bot yes all` cũng hỏng tương tự.

## Lỗi 2 — Thả tim vào tin nhắn bất kỳ sẽ duyệt pending gần nhất

`transaction-confirmation.service.ts:586-610` (`handleReaction`):

- Không tìm thấy pending theo `msgId` → **Fallback 1** lấy pending cuối cùng trong chat từ memory; **Fallback 2** lấy pending của user từ Redis.
- Hệ quả: tim/phẫn nộ ở *bất kỳ* tin nào trong nhóm (kể cả tin kết quả, tin của người khác) đều duyệt/hủy pending đang treo. Rất nguy hiểm với nhóm đông người (giao dịch/công nợ cũng đi qua đây).
- Dòng 618-631 làm nặng thêm: khi cliMsgId khác, code **ghi đè `pending.cliMsgId`** bằng id của tin bị thả tim và `addTempMessage(... pending.code)` → tin kết quả của [783] bị gắn vào [125] rồi bị thu hồi khi [125] được duyệt. Đó là lý do log có 3 dòng "Successfully recalled" lúc 11:04:16.

## Nhiễu phụ (không phải lỗi nghiệp vụ)

- `[ZaloService] Failed to send chat action "typing" … chat_id is invaild` — luồng ZCA vẫn gọi `sendChatAction` của Zalo Bot chính thức với group id ZCA. Vô hại nhưng tốn 1 HTTP call mỗi tin.
- `;5;3m` — mã màu ANSI của Nest logger bị cắt (log được xem qua môi trường không hỗ trợ màu); nên tắt màu ở prod (`NO_COLOR` hoặc `colors: false`).
- Log `RAW PAYLOAD` ở mức LOG in toàn bộ nội dung tin nhắn + URL ảnh → nên hạ xuống DEBUG (riêng tư + dung lượng log).

## Đề xuất khắc phục (chưa sửa code)

1. Trước fast-path, chuẩn hoá text: gỡ mention của bot theo `data.mentions` (fallback `cleanBotMention`) rồi mới đưa vào `handleCommand`.
2. `handleReaction`: chỉ xử lý khi `msgId`/`cliMsgId` khớp đúng thẻ chờ (hoặc tin đã đăng ký cho code đó); bỏ cả 2 fallback; không ghi đè `cliMsgId`/không `addTempMessage` cho tin không khớp.
3. (Tuỳ chọn) bỏ `sendChatAction` với nguồn ZCA, hạ log RAW PAYLOAD xuống DEBUG.

Test hồi quy: `"@Đen edit 125 …"` → gọi `onEdit` với code 125; reaction có `msgId` lạ khi đang có pending → `handled: false`, pending không đổi.
