---
metadata:
  agent-artifact:
    id: global-zalo-response-layout-knowledge
    type: documentation
    depends_on:
      - apps/api/src/zca/zca-messenger.service.ts
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
      - apps/api/src/zca/confirmation/dto-descriptor.util.ts
      - apps/api/src/zca/confirmation/compact-summary.util.ts
      - apps/api/src/zca/zca.service.ts
      - apps/api/src/zca/thread-config.service.ts
      - apps/api/src/zca/text/zalo-plain-text.util.ts
---

# Zalo Response Layout

Human guide: [Zalo Response Layout](../../docs/global/zalo-response-layout.md).

## Delivery

- All bot replies are plain text. There are no buttons, inline keyboards, or callback payloads; every follow-up action is a typed command or a reaction.
- Layout: one short heading line (emoji prefix), then `• Label: value` lines; keep each item compact for mobile. Exception: success messages after confirmation use the compact 1–2 line format below.
- No markdown: Zalo shows `**`, `#`, backticks as raw symbols, and LLMs write markdown by habit.
  - Prevention: `ZALO_PLAIN_TEXT_INSTRUCTION` (`apps/api/src/zca/text/zalo-plain-text.util.ts`) is appended to every system instruction whose reply text can reach a chat: `TextInputService` (main, edit, chit-chat), `SearchChatHistoryToolStrategy`, `CreateBillPendingImageStrategy`. New LLM prompts that may reply in chat must append it too.
  - Guarantee: `ZcaService.sendMessage` (the single exit for every outgoing message) runs `toZaloPlainMessage`: `**x**`/`__x__`/`***x***`/word-glued `*x*`/`` `x` `` -> `x`; fence lines, `---`/`***` rule lines dropped; leading `#` removed; leading `* `/`+ ` -> `• ` (`- ` kept); `[label](url)` -> `label: url`; stray `**`/`__` dropped (unclosed marker, or a 1900-char chunk split mid-marker); 3+ newlines -> 2. URLs are kept byte for byte; single `_` is untouched. A result that would be empty sends the original text.
  - Exception: a `MessageContent` with `mentions` or `styles` goes out as built, since their positions index into `msg`. Tagged messages are bot-built (reminders), not LLM text.
  - Chat memory rows saved before this rule may still contain markdown; they are not rewritten.
- `ZcaMessengerService.sendMessageWithResult` (`apps/api/src/zca/zca-messenger.service.ts`): sends through ZCA only; text is split into 1900-character chunks (300 ms apart). ZCA logged out or a send error -> `{ success: false }` (never throws). Returns `{ success, msgId?, cliMsgId? }` of the last chunk, used for later recall. `withChatAction` keeps a ZCA typing indicator (`sendTypingEvent`, every 4 s) while a tool runs.

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

## Success messages (compact)

After a pending action is executed, the outcome message is built by `compact-summary.util.ts` (one `summarize…` per action type), not by `renderDtoConfirmationCard`. Rationale: the card was already reviewed and is recalled, so repeating every field wastes phone screen space.

- Max 2 lines (+1 line `🧾 <url>` for a receipt link): line 1 = icon + `[code]` + main content; line 2 = secondary info, omitted when empty. Parts joined by ` · `; empty fields are dropped (never `(trống)`).
- Same text for heart and text confirmation (no "Đã nhận đủ N lượt thả tim" header, no tip lines). `processConfirm`'s `_options` is kept but unused.
- Short time `HH:mm dd/MM` in Asia/Ho_Chi_Minh; year appended only when it differs from the current year. Amount `15.000đ`.
- Values come from the saved entity when available (`tx?.amount ?? payload.amount`, …).

```text
✅ [230] Chi 15.000đ · Ăn uống · bánh mỳ
📍 đối diện ctgroup · 🕗 08:30 21/10
```

| Action | Line 1 | Line 2 |
| --- | --- | --- |
| `RECORD_TRANSACTION` | `✅ [c] Chi\|Thu <amount> · <category> · <note>` | `📍 place · 🕗 time · 💳 method`, then `🧾 <receiptUrl>` |
| `DELETE_TRANSACTION` | `🗑️ [c] Đã xoá chi\|thu <amount> · …` | `🕗 time` |
| `MANAGE_DEBT` | `✅ [c] <name> (<alias>) nợ bạn <amount>` / `Bạn nợ <name> <amount>` `· note` | `🕗 time · ⏳ hạn dd/MM` |
| `SET_REMINDER` | `⏰ [c] Nhắc "<title>" lúc <time>` | `🔁 hàng ngày\|hàng tuần · 📞 gọi điện` |
| `CREATE_TASK` | `✅ [c] Thêm việc: <title> · ⏳ hạn dd/MM` | `📝 notes` |
| `COMPLETE_TASK` | `☑️ [c] Đã xong: <title>` | — |
| `CREATE_CALENDAR_EVENT` | `📅 [c] <summary> · 14:00–15:00 22/10` (multi-day: `start – end`) | `📍 location · 🔔 trước 10p` |
| `DELETE_CALENDAR_EVENT` | `🗑️ [c] Đã xoá lịch: <summary> · <start>` | — |
| `BAN_USER` | `⛔ [c] Đã khoá <name> (id …) · đã thu hồi quyền và token Google` | `📝 reason` |
| `CREATE_PLACE` | `📍 [c] Đã tạo nơi chốn: <name>` | — |
| other | `✅ [c] Đã xác nhận` | — |

Unchanged: pending cards (full descriptor), heart counter, remaining notice, `yes all` result, error messages.

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
4. Confirmed: recall, execute, post one compact result message (same for hearts and text). If more actions remain, post the remaining notice as an interim message.
5. Companion place: confirming a `RECORD_TRANSACTION` with `placeName` recalls and deletes a matching pending `CREATE_PLACE` card.
6. Cancelled: recall, post cancel notice. Timeout: recall, post `⏰ … (mã: xxx) đã hết hạn 5 phút và chưa được xác nhận.`
7. Edited: recall the old card, re-run the same tool via LLM to issue a new card, then delete the old pending action.
8. Resolution deletes `pending:tx:code`, `pending:tx:user`, the code from `pending:tx:user-codes`, and `pending:tx:msg`; `recallTempMessages` deletes the `pending:tx:temp` / `pending:tx:chat-temp` lists it recalls.

## Tests

`apps/api/src/zca/confirmation/transaction-confirmation.service.spec.ts`, `dto-descriptor.util.spec.ts`, `compact-summary.util.spec.ts`; markdown cleanup: `apps/api/src/zca/text/zalo-plain-text.util.spec.ts`, `zca.service.spec.ts` (`sendMessage`).
