# zalo Response Layout

User-facing zalo responses prioritize one compact heading, inline primary facts, and at most two lines per listed item. Repeated guidance and decorative separators are omitted when an action button already communicates the next step.

Short related inline actions may share one row. Long labels remain on their own row to avoid mobile overflow. Action labels must state their time or data scope when the same action exists in multiple scopes: today refresh and seven-day refresh use separate callbacks. Callback payloads and confirmation JSON fallbacks are otherwise unchanged.

AI-generated Markdown is normalized before delivery: HTML entities are decoded and escaped URL ampersands are restored so raw output such as `&#x20;` never reaches the chat.

Long-lived interactive list and information messages (today summary, task list, account status, admin user list, debt detail, and dashboard/report links) include a close action. It deletes the message when zalo permits it; otherwise, it removes the inline keyboard so obsolete actions cannot be used. Confirmation dialogs retain cancel semantics, while reminder and calendar receipts retain their hide-controls action.

## Confirmation Cards & Two-Way Impact Explanation

Every confirmation dialog (`formatConfirmationBox`) is structured into four distinct visual sections:

1. **Primary Business Details**: Structured summary with intuitive icons (income/expense amount, dates, places, notes, counterparts).
2. **System Impact Explanation (`🎯 Tác động hệ thống:`)**: Explicit two-way explanation detailing exactly what happens upon confirmation (`• ✅ Nếu Xác nhận: ...`) and guaranteeing safety upon cancellation (`• ❌ Nếu Hủy bỏ: ...`).
3. **Transparent Technical Details**: An escaped, formatted JSON preview (`<pre><code class="language-json">...</code></pre>`) under `🔍 Chi tiết kỹ thuật (Payload JSON...):` containing the final API mutation payload. UI-only `duplicateWarnings` are excluded.
4. **Action Buttons**: `[✅ Xác nhận]` and `[❌ Hủy bỏ]`.

## Post-Action Callout State (Context Preservation)

Instead of replacing the confirmation message with a single generic result string, the message is updated into a persistent Callout Card that preserves original request context:

- **Confirmed Execution (`formatConfirmedBox`)**: Renders a success banner (`✅ ĐÃ XÁC NHẬN & THỰC HIỆN THÀNH CÔNG`), a summary of newly recorded/updated entities (`✨ Kết quả đã ghi nhận:`), and the preserved original request summary (`📋 Nội dung yêu cầu đã duyệt:`).
- **Cancelled Execution (`formatCancelledBox`)**: Renders a cancelled banner (`❌ ĐÃ HỦY YÊU CẦU THAO TÁC`), a safety assurance notice stating that no data was modified, and a summary of the cancelled request.
- **Auto-Cancellation on New Intake**: When the user sends a new message (text, voice, photo) while a confirmation is pending, previous confirmation cards are auto-updated to the cancelled callout state, removing inline action buttons to prevent accidental clicks.
