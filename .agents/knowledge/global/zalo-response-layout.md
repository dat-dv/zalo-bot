# zalo Response Layout

User-facing zalo responses prioritize one compact heading, inline primary facts, and at most two lines per listed item. Repeated guidance and decorative separators are omitted when an action button already communicates the next step.

Short related inline actions may share one row. Long labels remain on their own row to avoid mobile overflow. Action labels must state their time or data scope when the same action exists in multiple scopes: today refresh and seven-day refresh use separate callbacks. Callback payloads and confirmation JSON fallbacks are otherwise unchanged.

AI-generated Markdown is normalized before delivery: HTML entities are decoded and escaped URL ampersands are restored so raw output such as `&#x20;` never reaches the chat.

Long-lived interactive list and information messages (today summary, task list, account status, admin user list, debt detail, and dashboard/report links) include a close action. It deletes the message when zalo permits it; otherwise, it removes the inline keyboard so obsolete actions cannot be used. Confirmation dialogs retain cancel semantics, while reminder and calendar receipts retain their hide-controls action.

## 3-Digit Interactive Confirmation Cards & Reactions

Sensitive mutations (creating transactions, new places, debts, reminders, calendar events, tasks, or user bans) generate an interactive confirmation card containing a 3-digit random code:

```text
⏳ Xác nhận lưu 🔴 khoản chi?

• Phân loại: 🔴 Khoản chi
• Số tiền: 30.000 đ
• Danh mục: Ăn uống
• Ghi chú: ăn bánh tráng nướng buổi tối
• Thời gian: 20:00 13/10/2026
• Địa điểm: tiệm bánh tráng đầu đường gò xoài
• Phương thức: tiền mặt
• Ảnh hóa đơn: (trống)

👉 Thả tim (❤️) hoặc soạn: yes 629 (để xác nhận)
👉 Thả phẫn nộ (😡) hoặc soạn: cancel 629 (để hủy bỏ)
👉 Soạn: edit 629 <nội dung sửa> (để điều chỉnh)
⏱️ Tự động hết hạn sau 5 phút.
```

- Multi-tenant persistence: cards are stored in memory and synchronized to Redis (`pending:tx:code:*`, `pending:tx:user:*`, `pending:tx:msg:*`).

## Automatic Message Recall & Ephemeral Lifecycle (Clean Conversations)

To keep chat feeds clean and prevent visual clutter, the bot strictly adheres to: **"All interaction messages generated during a flow are ephemeral; upon completion, only the final outcome message remains in chat"**:

1. **Redis Key Partitioning**:
   - `pending:tx:temp:${code}`: Tracks interactive confirmation cards by action code (`code`).
   - `pending:tx:chat-temp:${chatId}`: Tracks thread-wide interim status messages (heart reaction threshold updates `❤️ Đã nhận X/Y...`, pending queue reminders `💡 Bạn còn X yêu cầu...`, and provisional companion place notifications).

2. **Accurate `cliMsgId` Mapping & Resolution**:
   - In Zalo protocol, `undo` requires the client-generated 13-digit Unix timestamp `cliMsgId`. Supplying the server's global `msgId` causes Zalo server to reject with `"Lỗi không xác định"`.
   - `ZcaService` continuously intercepts WebSocket message echoes and reaction events (`rMsg[0].cMsgID`), syncing `msgId <-> cliMsgId` pairs to memory and Redis (`zca:msg:cli:*`) with 24h TTL.
   - `undoMessage` auto-resolves `ThreadType` and retrieves cached `cliMsgId`. If `undo` is rejected by the server, it seamlessly falls back to `deleteMessage(onlyMe: true)` on the bot's side.

3. **Confirmed (`yes <code>` or ❤️ Heart)**:
   - Invokes `recallTempMessages(chatId, code)` to recall the confirmation card and all interim notices in `chat-temp`.
   - Posts a single consolidated confirmation message containing the heart celebration header and full DTO details.

4. **Multi-Card Sequential Flow (e.g. New Place `[650]` + Expense `[363]`)**:
   - Confirming place `[650]`: Recalls card `[650]`, posts temporary place confirmation and remainder notice into `chat-temp`.
   - Confirming expense `[363]`: Recalls card `[363]` and purges all of `chat-temp` (recalling both the temporary place confirmation and remainder notice).
   - Chat ends with **strictly one message**: the complete expense record already showing the new place!

5. **Expired (5-Minute Timeout)**:
   - Recalls the confirmation card and interim notices via `recallTempMessages`.
   - Posts only the timeout notification: `⏰ Yêu cầu ... (mã: xxx) đã hết hạn 5 phút và chưa được xác nhận.`

6. **Cancelled (`cancel <code>` or 😡 Angry)**:
   - Recalls the confirmation card and interim notices.
   - Posts the cancellation notice.

7. **Edited (`edit <code> <new content>`)**:
   - Immediately recalls the superseded confirmation card.
   - Parses the edit instructions and issues a new confirmation card with a new code.

8. **Non-blocking Error Boundary**:
   - Recalls run concurrently via `Promise.allSettled` inside `try...catch`; network or API failures log warnings without disrupting database integrity or user flow.

9. **Redis Cleanup**:
   - Keys (`pending:tx:code:*`, `pending:tx:user:*`, `pending:tx:msg:*`, `pending:tx:temp:*`, `pending:tx:chat-temp:*`) are purged immediately upon resolution.


