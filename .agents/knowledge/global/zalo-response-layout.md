---
metadata:
  agent-artifact:
    id: global-zalo-response-layout-knowledge
    type: documentation
    depends_on:
      - apps/api/src/zalo/zalo.service.ts
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
      - apps/api/src/zca/confirmation/dto-descriptor.util.ts
      - apps/api/src/zca/zca.service.ts
      - apps/api/src/zca/thread-config.service.ts
---

# Zalo Response Layout

Human guide: [Zalo Response Layout](../../docs/global/zalo-response-layout.md).

## Delivery

- All bot replies are plain text. There are no buttons, inline keyboards, or callback payloads; every follow-up action is a typed command or a reaction.
- Layout: one short heading line (emoji prefix), then `• Label: value` lines; keep each item compact for mobile.
- `ZaloService.sendMessageWithResult`: with a Bot Platform token, text is split into 1900-character chunks (300 ms apart) and sent to the Bot API; on API failure it falls back to ZCA if logged in. Without a token it sends through ZCA. Returns `{ success, msgId?, cliMsgId? }` used for later recall.

## Confirmation cards

Sensitive mutations (transactions, transaction delete, debts, places, reminders, calendar create/delete, task create/complete, user ban) create a `PendingAction` with a 3-digit code (100–999, unique among in-memory pending) and a 5-minute timeout. The card body is rendered from a DTO descriptor (`renderDtoConfirmationCard`):

```text
⏳ Xác nhận lưu 🔴 khoản chi?

• Phân loại: 🔴 Khoản chi
• Số tiền: 30.000 đ
• Danh mục: Ăn uống
• Ghi chú: ăn bánh tráng nướng buổi tối
• Thời gian: 20:00 13/10/2026
• Địa điểm: tiệm bánh tráng đầu đường gò xoài
• Phương thức: tiền mặt

👉 Thả tim (❤️) hoặc soạn: yes 629 (để xác nhận)
👉 Thả phẫn nộ (😡) hoặc soạn: cancel 629 (để hủy bỏ)
👉 Soạn: edit 629 <nội dung sửa> (để điều chỉnh)
⏱️ Tự động hết hạn sau 5 phút.
```

- Text commands: `yes|y|ok|xác nhận [code]`, `cancel|no|hủy|huỷ|bỏ qua [code]`, `yes all`, `cancel all`, `edit|sửa|chỉnh sửa|sửa lại <code> <instruction>`. Without a code, `yes` takes the oldest pending action of the sender; `cancel` and `edit` take the newest.
- Reactions (ZCA): heart (`/-heart`, `HEART`, `❤️`) adds the reactor to `heartUsers`; confirm when `heartUsers.length >= requiredHearts`. Angry (`:-h`, `ANGRY`, `😡`) cancels. `createPendingAction` takes `requiredHearts` from the chat's saved thread config `confirmationRules.requiredHearts` (group default 5) via `ThreadConfigService.findStoredConfig` (read-only, never creates a config); an explicit `requiredHearts` param wins; chats without a saved config (e.g. official webhook) need 1.
- Authorization: confirm/cancel/edit by code is allowed when the sender owns the action or the command comes from the action's chat.

## Redis keys (TTL = remaining confirmation time unless noted)

| Key | Value |
| --- | --- |
| `pending:tx:code:<code>` | Serialized pending action |
| `pending:tx:user:<userId>` | Latest code of the user |
| `pending:tx:user-codes:<userId>` | JSON array of all pending codes of the user (ordered list for `yes all`, `cancel all`, pending-place lookup) |
| `pending:tx:msg:<msgId>` | Code of the card message (reaction lookup) |
| `pending:tx:temp:<code>` | Messages to recall with this code (TTL 1 h) |
| `pending:tx:chat-temp:<chatId>` | Interim chat messages to recall (TTL 1 h) |
| `zca:msg:cli:<msgId>` | `cliMsgId` for recall (TTL 24 h) |

Pending actions are also held in memory with a timer; Redis is the cross-restart / fail-soft copy.

## Message recall lifecycle

Principle: interaction messages are ephemeral; after resolution only the outcome message stays.

1. Interim messages tracked via `addTempMessage`: heart counter `❤️ Đã nhận X/Y…`, remaining notice `💡 Bạn còn X yêu cầu chờ xác nhận…`, and a place confirmation sent while other actions are still pending.
2. `recallTempMessages(chatId, code?)` recalls the card and tracked messages (`Promise.allSettled`, errors logged only).
3. ZCA `undo` needs the client `cliMsgId`; `ZcaService` caches `msgId -> cliMsgId` from echoes/reactions. If `undo` fails, fall back to `deleteMessage(onlyMe: true)`. Recall requires ZCA to be logged in.
4. Confirmed: recall, execute, post one result message (heart header when confirmed by reactions). If more actions remain, post the remaining notice as an interim message.
5. Companion place: confirming a `RECORD_TRANSACTION` with `placeName` recalls and deletes a matching pending `CREATE_PLACE` card.
6. Cancelled: recall, post cancel notice. Timeout: recall, post `⏰ … (mã: xxx) đã hết hạn 5 phút và chưa được xác nhận.`
7. Edited: recall the old card, re-run the same tool via LLM to issue a new card, then delete the old pending action.
8. Resolution deletes `pending:tx:code`, `pending:tx:user`, the code from `pending:tx:user-codes`, and `pending:tx:msg`; `recallTempMessages` deletes the `pending:tx:temp` / `pending:tx:chat-temp` lists it recalls.

## Tests

`apps/api/src/zca/confirmation/transaction-confirmation.service.spec.ts`, `dto-descriptor.util.spec.ts`.
