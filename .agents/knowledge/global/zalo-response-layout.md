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
      - apps/api/src/zca/text/text-input.service.ts
      - apps/api/src/zca/text/pending-edit-args.util.ts
      - apps/api/src/zca/text/reminder-target-args.util.ts
      - apps/api/src/zca/zca-bot-feature.service.ts
      - apps/api/src/zca/text/strategies/help-tool.strategy.ts
---

# Zalo Response Layout

Human guide: [Zalo Response Layout](../../docs/global/zalo-response-layout.md).

## Delivery

- All bot replies are plain text. There are no buttons, inline keyboards, or callback payloads; every follow-up action is a typed command or a reaction.
- Layout: short and plain, written like a person texting (user request 2026-10-25: replies were too long and too "AI"). Lists: a sentence-case header (`Việc cần làm (3):`), then `• item` / `1. item` lines. Success messages after confirmation use the compact 1–2 line format below.
- Style rules for every bot-built message (strategies, guards, cards, reminders, errors):
  1. At most one emoji per message, only at the very start; none at the start of each line or inside lines. Exception: ❤️/😡 in the card's approval line (they name the reaction to tap).
  2. No `━━━` separator lines, no ALL-CAPS headings or sentences, no `*bold*`.
  3. No trailing tips, greetings or cheers (`💡 Bạn có thể…`, `nhé!`, `🎉`); no sentence starting with "Vui lòng"; no parenthesised explanations.
  4. Empty values and default settings take no line.
  5. Errors: one line `⚠️ <what happened>` + short next step; keep the `err.message` detail.
  6. Spelling `xoá`, `huỷ`, `khoá`, `hoá đơn`; amounts `15.000đ` in summaries and lists.
- LLM replies follow the same tone: `ZALO_PLAIN_TEXT_INSTRUCTION` asks for short direct sentences, no pleasantries, no restating the request, at most 1 emoji, no all-caps.
- No markdown: Zalo shows `**`, `#`, backticks as raw symbols, and LLMs write markdown by habit.
  - Prevention (also carries the tone rules above): `ZALO_PLAIN_TEXT_INSTRUCTION` (`apps/api/src/zca/text/zalo-plain-text.util.ts`) is appended to every system instruction whose reply text can reach a chat: `TextInputService` (main, edit, chit-chat), `SearchChatHistoryToolStrategy`, `CreateBillPendingImageStrategy`. New LLM prompts that may reply in chat must append it too.
  - Guarantee: `ZcaService.sendMessage` (the single exit for every outgoing message) runs `toZaloPlainMessage`: `**x**`/`__x__`/`***x***`/word-glued `*x*`/`` `x` `` -> `x`; fence lines, `---`/`***` rule lines dropped; leading `#` removed; leading `* `/`+ ` -> `• ` (`- ` kept); `[label](url)` -> `label: url`; stray `**`/`__` dropped (unclosed marker, or a 1900-char chunk split mid-marker); 3+ newlines -> 2. URLs are kept byte for byte; single `_` is untouched. A result that would be empty sends the original text.
  - Exception: a `MessageContent` with `mentions` or `styles` goes out as built, since their positions index into `msg`. Tagged messages are bot-built (reminders), not LLM text.
  - Chat memory rows saved before this rule may still contain markdown; they are not rewritten.
- `ZcaMessengerService.sendMessageWithResult` (`apps/api/src/zca/zca-messenger.service.ts`): sends through ZCA only; text is split into 1900-character chunks (300 ms apart). ZCA logged out or a send error -> `{ success: false }` (never throws). Returns `{ success, msgId?, cliMsgId? }` of the last chunk, used for later recall. `withChatAction` keeps a ZCA typing indicator (`sendTypingEvent`, every 4 s) while a tool runs.

## Confirmation cards

Sensitive mutations (transactions, transaction delete, debts, places, reminders, calendar create/delete, task create/complete, user ban) create a `PendingAction` with a 3-digit code (100–999, unique among in-memory pending) and a 5-minute timeout. The card body is rendered from a DTO descriptor (`renderDtoConfirmationCard`):

```text
Lưu khoản chi [629]?
• Số tiền: 30.000 đ
• Danh mục: Ăn uống
• Ghi chú: ăn bánh tráng nướng buổi tối
• Thời gian: 20:00 13/10/2026
• Địa điểm: tiệm bánh tráng đầu đường gò xoài
• Phương thức: tiền mặt
❤️ hoặc yes 629: duyệt · 😡 hoặc cancel 629: huỷ
edit 629 <nội dung>: sửa · tự huỷ sau 5 phút
```

- Header: `pendingActionLabel(actionType, payload.type)` capitalised + `[code]?`. Labels: `lưu khoản chi|thu`, `xoá khoản chi|thu`, `ghi công nợ`, `đặt lời nhắc`, `thêm việc`, `đánh dấu xong việc`, `thêm lịch`, `xoá lịch`, `khoá tài khoản`, `tạo nơi chốn` (legacy `create`/`delete` map to the transaction labels). The label is derived from the action type, so cards stored by an older build read the same.
- Rows: a field whose formatter returns empty or `(trống)` is skipped (no `(trống)` lines). Default settings are skipped too: `Hình thức thông báo` only for `call` (`Gọi điện`), `Nhắc lại` only with a nag, `Cách nhắc` only for `direct` (`Nhắn riêng từng người`). The transaction `type` row is hidden (the header says it). Row values carry no emoji (`Họ nợ bạn (phải thu)`, `Nhóm này`, `Chat riêng của bạn`).
- Approval lines: groups needing N hearts show `❤️ xN hoặc yes <code>: duyệt`.

- Text commands: `yes|y|ok|xác nhận [code]`, `cancel|no|hủy|huỷ|bỏ qua [code]`, `yes all`, `cancel all`, `edit|sửa|chỉnh sửa|sửa lại <code> <instruction>`. Without a code, `yes` takes the oldest pending action of the sender; `cancel` and `edit` take the newest.
- Reactions (ZCA): heart (`/-heart`, `HEART`, `❤️`) adds the reactor to `heartUsers`; confirm when `heartUsers.length >= requiredHearts`. Angry (`:-h`, `ANGRY`, `😡`) cancels. `createPendingAction` takes `requiredHearts` from the chat's saved thread config `confirmationRules.requiredHearts` (group default 5) via `ThreadConfigService.findStoredConfig` (read-only, never creates a config); an explicit `requiredHearts` param wins; chats without a saved config (e.g. official webhook) need 1.
- Authorization: confirm/cancel/edit by code is allowed when the sender owns the action or the command comes from the action's chat.
- Follow-up message (no `edit` prefix): when the sender has unexpired pending cards in this chat, the main LLM pass lists them and gets the extra tool `AMEND_PENDING { code }` (see [Zalo Command Intake](zalo-command-intake.md)). A message that amends a card ("tag @Nam nha", "đổi sang 10h") re-issues it through the edit flow via `TransactionConfirmationService.amendPending`, allowed only for the card owner in the card's chat. Why: users correct a card by replying naturally; before this, the reply created a second, lossy card and the first one hung until timeout.
- Edit flow (`TextInputService.handleEditPendingAction`, used by `edit <code>` and follow-ups):
  - The edit input carries the message's tags, memory and settings (`ZcaBotFeatureService.buildTextAgentInput`, shared with the AI path).
  - Patch edit for `CREATE_TASK` / `SET_REMINDER` (`pending-edit-args.util.ts`): the LLM sees the card as tool args (`pendingToolArgs`: once times in `remindTimes`, repeats in `repeatingTimes`, no people) with `required` dropped, sends only changed args, and `mergeEditedToolArgs` keeps everything it leaves out (null = left out; `""`/`[]`/`false` clears; any reminder-time key replaces the whole time group, same for the `nagEveryMinutes`/`nagCount` pair). No tool call = re-issue unchanged (new tags still apply). Other types keep the full re-issue from the payload.
  - People on edit (`reminderUsersForRequest`): tags in the edit message replace the people (plus the sender with `remindSelf`); an untagged edit keeps the card's `remindUsers`.
  - Returns `true` only when a new card was issued; otherwise the old card stays pending (unsupported type, other tool, no tool call outside patch mode, error).
- Tool args `remindAt` and `remindTimes` are merged (`reminderTimesFromArgs`), so a first time given only in `remindAt` is not dropped.

## Success messages (compact)

After a pending action is executed, the outcome message is built by `compact-summary.util.ts` (one `summarize…` per action type), not by `renderDtoConfirmationCard`. Rationale: the card was already reviewed and is recalled, so repeating every field wastes phone screen space.

- Max 2 lines (+1 line `Hoá đơn: <url>` for a receipt link): line 1 = one icon + `[code]` + main content; line 2 = secondary info as plain text (no icons), omitted when empty. Parts joined by ` · `; empty fields are dropped (never `(trống)`).
- Same text for heart and text confirmation (no "Đã nhận đủ N lượt thả tim" header, no tip lines). `processConfirm`'s `_options` is kept but unused.
- Short time `HH:mm dd/MM` in Asia/Ho_Chi_Minh; year appended only when it differs from the current year. Amount `15.000đ`.
- Values come from the saved entity when available (`tx?.amount ?? payload.amount`, …).

```text
✅ [230] Chi 15.000đ · Ăn uống · bánh mỳ
đối diện ctgroup · 08:30 21/10
```

| Action | Line 1 | Line 2 |
| --- | --- | --- |
| `RECORD_TRANSACTION` | `✅ [c] Chi\|Thu <amount> · <category> · <note>` | `place · time · method`, then `Hoá đơn: <receiptUrl>` |
| `DELETE_TRANSACTION` | `🗑️ [c] Đã xoá chi\|thu <amount> · …` | `time` |
| `MANAGE_DEBT` | `✅ [c] <name> (<alias>) nợ bạn <amount>` / `Bạn nợ <name> <amount>` `· note` | `time · hạn dd/MM` |
| `SET_REMINDER` | `⏰ [c] Nhắc "<title>" lúc <time>` | `<nag label> · gọi điện · @A, @B (nhắn riêng)` |
| `CREATE_TASK` | `✅ [c] Thêm việc: <title> · hạn dd/MM · nhắc <times> · @A` | `Ghi chú: notes` |
| `COMPLETE_TASK` | `☑️ [c] Đã xong: <title>` | — |
| `CREATE_CALENDAR_EVENT` | `📅 [c] <summary> · 14:00–15:00 22/10` (multi-day: `start – end`) | `location · báo trước 10p` |
| `DELETE_CALENDAR_EVENT` | `🗑️ [c] Đã xoá lịch: <summary> · <start>` | — |
| `BAN_USER` | `⛔ [c] Đã khoá <name> (id …) · đã thu hồi quyền và token Google` | `Lý do: reason` |
| `CREATE_PLACE` | `📍 [c] Đã tạo nơi chốn: <name>` | — |
| other | `✅ [c] Đã xác nhận` | — |

## Other confirmation-flow messages

`describePendingAction` = label + `"subject"` (task title, event summary, place name, ban target, else note/title/summary), subject cut at 60 chars with `…`.

| Message | Text |
| --- | --- |
| Heart counter (interim) | `❤️ 2/5 [446]` — sent only by `TransactionConfirmationService`; `ZcaBotFeatureService.onReaction` sends nothing itself |
| Timeout / expired on yes or edit | `[446] Hết hạn, chưa lưu: thêm việc "…"` |
| Cancel (text or 😡) | `[877] Đã huỷ: thêm việc "…"` |
| `yes all` / `cancel all` | `✅ Đã duyệt 3/3 yêu cầu` / `Đã huỷ 3 yêu cầu`; nothing pending: `Không có yêu cầu nào đang chờ.` |
| Unknown code / not allowed | `⚠️ Không có yêu cầu [446] đang chờ.` / `⚠️ Bạn không duyệt\|sửa\|huỷ được yêu cầu [446].` |
| `edit` without text | `Muốn sửa gì? Ví dụ: edit 446 đổi số tiền thành 60k` |

No "you still have N pending" notice after a confirm or a code-less cancel: the remaining cards are still on screen, and when two cards were confirmed at nearly the same time the notice counted the other one and was never recalled. `yes all` / `cancel all` are taught by `/help` (section "Duyệt yêu cầu").

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

1. Interim messages tracked via `addTempMessage`: heart counter `❤️ X/Y [code]` and a place confirmation sent while other actions are still pending.
2. `recallTempMessages(chatId, code?)` recalls the card and tracked messages (`Promise.allSettled`, errors logged only).
3. ZCA `undo` needs the client `cliMsgId`; `ZcaService` caches `msgId -> cliMsgId` from echoes/reactions. If `undo` fails, fall back to `deleteMessage(onlyMe: true)`. Recall requires ZCA to be logged in.
4. Confirmed: recall, execute, post one compact result message (same for hearts and text). Nothing else is posted, even when more actions remain.
5. Companion place: confirming a `RECORD_TRANSACTION` with `placeName` recalls and deletes a matching pending `CREATE_PLACE` card.
6. Cancelled: recall, post `[code] Đã huỷ: …`. Timeout: recall, post `[code] Hết hạn, chưa lưu: …`.
7. Edited (`edit <code>` or a follow-up message): re-run the same tool via LLM to issue a new card; only when it is out, recall the old card and delete its pending action. A failed edit keeps the old card to approve.
8. Resolution deletes `pending:tx:code`, `pending:tx:user`, the code from `pending:tx:user-codes`, and `pending:tx:msg`; `recallTempMessages` deletes the `pending:tx:temp` / `pending:tx:chat-temp` lists it recalls.

## Tests

`apps/api/src/zca/confirmation/transaction-confirmation.service.spec.ts`, `dto-descriptor.util.spec.ts`, `compact-summary.util.spec.ts`; edits and follow-ups: `apps/api/src/zca/text/text-input.service.spec.ts`, `pending-edit-args.util.spec.ts`, `reminder-target-args.util.spec.ts`; markdown cleanup: `apps/api/src/zca/text/zalo-plain-text.util.spec.ts`, `zca.service.spec.ts` (`sendMessage`).
