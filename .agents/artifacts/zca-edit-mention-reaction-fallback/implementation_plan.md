# Implementation plan: Lệnh chờ duyệt có mention + reaction fallback (ZCA)

Risk: **MEDIUM** (đổi luồng duyệt/huỷ thao tác chờ; không đụng DB/contract). Chẩn đoán đầy đủ: `investigation.md` cùng thư mục.

## Lỗi 1 — `@Đen edit 125 …` / `@bot yes 123` không được nhận

**Nguyên nhân:** `zca-bot-feature.service.ts` (fast-path, `onMessage`) gọi `confirmationService.handleCommand(senderId, threadId, text, …)` với `text` thô. Các regex trong `transaction-confirmation.service.ts` `handleCommand` neo `^` (`^(?:edit|…)`, `^(?:yes|…)`, `^(?:cancel|…)`), nên mention đứng đầu làm trượt khớp. Tin nhắn rơi xuống LLM và tạo thao tác mới.

**Sửa:**
1. Thêm hàm thuần `stripLeadingBotMention(text, mentions, ownId, botName, triggerPrefix)` trong `zca-bot-feature.service.ts`:
   - Ưu tiên theo `message.data.mentions`: với mỗi mention có `uid === ownId`, cắt đoạn `[pos, pos+len)` khỏi text (cắt từ cuối về đầu để không lệch `pos`), rồi trim dấu `, : . -` thừa.
   - Sau đó luôn chạy `cleanBotMention(…, botName, triggerPrefix)` làm fallback (cho `@bot`, `@Bot Finance Assistant`, `triggerPrefix`).
   - Chỉ gỡ mention **của bot**. Mention người khác (ví dụ "yes 123 @Trí") giữ nguyên, để không vô tình biến tin thường thành lệnh.
2. Fast-path dùng text đã làm sạch cho `handleCommand`. Callback `onEdit` cũng nhận text đã làm sạch (`agentInput.text`).
3. `ownId` lấy như các chỗ khác (`api.getOwnId?.()`).

**Không đổi:** quyền `edit` (`canEditPending`), regex của `handleCommand`, luồng `TextInputService` (vốn đã `cleanBotMention` trước khi gọi `handleCommand`).

## Lỗi 2 — Thả tim/phẫn nộ vào tin bất kỳ sẽ duyệt/huỷ pending gần nhất

**Nguyên nhân:** `transaction-confirmation.service.ts` `handleReaction`:
- Không khớp `msgId` → *Fallback 1* lấy pending cuối cùng của chat trong memory, *Fallback 2* lấy pending của user từ Redis.
- Khi đã chọn nhầm pending, đoạn tiếp theo **ghi đè `pending.cliMsgId`** và `addTempMessage(msgId lạ, pending.code)` → tin lạ bị gắn vào code rồi bị thu hồi khi duyệt (log: tin kết quả của [783] bị thu hồi khi duyệt [125]).

**Sửa:**
1. Chỉ nhận pending khi reaction đặt **đúng vào thẻ chờ**:
   - `msgId` khớp Redis `pending:tx:msg:<msgId>` (đã có), hoặc
   - memory: `p.chatId === chatId && (p.messageId === msgId || (cliMsgId && p.cliMsgId === cliMsgId))`.
2. Xoá Fallback 1 và Fallback 2. Không khớp → `{ handled: false }` và log `debug` (`Reaction on non-pending message … ignored`).
3. Bỏ khối ghi đè `pending.cliMsgId` và `addTempMessage` cho tin không khớp. Chỉ bổ sung `cliMsgId` khi pending **chưa có** `cliMsgId` (thẻ gửi qua API không trả cliMsgId), và chỉ khi `msgId` đã khớp.
4. Kiểm tra pending còn hạn (`expiresAt > now`) trước khi xử lý (nếu `getPendingByCode` chưa tự lọc).

**Đánh đổi:** trước đây thả tim vào tin "❤️ Đã nhận 1/2…" hoặc tin nhắc cũng tính. Sau khi sửa, chỉ tim trên **thẻ chờ** mới tính. Đây là hành vi đúng theo `CONTEXT.md` (xác nhận đa chiều trên thẻ). Thẻ đã ghi rõ "Thả tim (❤️) …" nên người dùng không bị nhầm.

## Test

`zca/confirmation/transaction-confirmation.service.spec.ts`:
- Có pending [125] với `messageId: 'card-125'`, reaction ❤️ với `msgId: 'other-msg'` → `handled: false`, pending vẫn còn, không gọi `undoMessage`, `cliMsgId` không đổi.
- Reaction 😡 vào tin lạ → không huỷ.
- Reaction khớp qua `cliMsgId` (memory, không có Redis) → vẫn duyệt.
- Các test reaction hiện có (dòng ~759, 798, 959, 1123, 1350) đều dùng msgId đúng → phải giữ pass.

`zca/zca-bot-feature.service.spec.ts`:
- `"@Đen edit 125 quán steak …"` có `mentions: [{ uid: ownId, pos: 0, len: 4 }]` → `handleCommand` nhận `"edit 125 quán steak …"`, gọi `onEdit`, **không** gọi `textInputService.process`.
- `"@bot yes 123"` (không có `mentions`) → `handleCommand` nhận `"yes 123"`.
- `"yes 123 @Trí"` với mention người khác → text giữ nguyên phần mention của người khác.
- Unit test `stripLeadingBotMention`: nhiều mention, `pos` lệch, mention không phải bot.

Chạy: `npm run test --workspace @zalobot/api`, `npm run typecheck --workspace @zalobot/api`, eslint trên các file đã sửa.

## Docs (Hard Completion Gate)

- `.agents/knowledge/modules/zca/README.md` (EN): mục Pending fast-path ghi rõ text đã gỡ mention của bot (theo `mentions` rồi đến `cleanBotMention`). Mục Reactions ghi rõ chỉ khớp theo thẻ chờ (`msgId`/`cliMsgId`), không còn fallback.
- `.agents/docs/modules/zca/README.md` (VI): giải thích nghiệp vụ tương ứng và lý do bỏ fallback (an toàn trong nhóm đông người).
- `node .claude/hooks/docs-drift-check.mjs` exit 0.

## Ngoài phạm vi

- Gọi `sendChatAction` của Zalo Bot cho thread ZCA (`chat_id is invaild`), mã màu ANSI trong log, log RAW PAYLOAD ở mức LOG: để task riêng nếu anh muốn.
