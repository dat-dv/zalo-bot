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

## Automatic Message Recall (Clean Conversations)

To keep chat feeds clean and avoid obsolete intermediate messages, the bot automatically recalls (`undoMessage` / `zca.undo`) pending cards:

1. **Confirmed (`yes <code>` or ❤️ Heart)**:
   - Recalls the pending confirmation card (and any companion pending place creation card created in the same flow).
   - Posts a single consolidated confirmation message containing the heart celebration header and full DTO details.
2. **Expired (5-Minute Timeout)**:
   - Recalls the pending confirmation card.
   - Posts only the timeout notification: `⏰ Yêu cầu ... (mã: xxx) đã hết hạn 5 phút và chưa được xác nhận.`
3. **Cancelled (`cancel <code>` or 😡 Angry)**:
   - Recalls the pending confirmation card.
   - Posts the cancellation notice.
4. **Edited (`edit <code> <new content>`)**:
   - Immediately recalls the superseded confirmation card.
   - Parses the edit instructions and issues a new confirmation card with a new code.
5. **Non-blocking Error Boundary**:
   - Network or API errors during `undoMessage` are caught safely and logged as warnings; they never block database writes or mutate transaction integrity.
6. **Redis Cleanup**:
   - Keys (`pending:tx:code:*`, `pending:tx:user:*`, `pending:tx:msg:*`) are purged immediately upon resolution.

