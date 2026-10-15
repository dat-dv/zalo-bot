---
metadata:
  agent-artifact:
    id: docs-global-zalo-response-layout
    type: documentation
    depends_on:
      - .agents/knowledge/global/zalo-response-layout.md
---

# Bố cục phản hồi zalo

Hướng dẫn này ánh xạ trực tiếp với tri thức canonical [`zalo-response-layout.md`](../../knowledge/global/zalo-response-layout.md).

Response zalo cần ưu tiên nội dung người dùng cần quyết định hoặc đọc ngay: một tiêu đề ngắn, số liệu chính cùng dòng và từng mục tối đa hai dòng. Không thêm đường phân cách hoặc hướng dẫn lặp lại khi nút bên dưới đã thể hiện hành động kế tiếp.

Các nút ngắn, liên quan trực tiếp có thể cùng một hàng. Nút dài phải để hàng riêng để không bị tràn trên điện thoại. Khi có cùng một hành động ở nhiều phạm vi, nhãn phải nói rõ phạm vi: làm mới lịch hôm nay và làm mới lịch 7 ngày dùng hai callback riêng. Không đổi callback data và không đổi JSON fallback của hộp xác nhận, trừ callback mới cần thiết cho một phạm vi mới.

Trước khi gửi Markdown do AI tạo, bot giải mã HTML entity và bỏ escape thừa trước dấu `&` trong URL. Vì vậy chuỗi như ` ` hoặc `\&ctz` không được xuất hiện nguyên văn trong chat.

Các tin nhắn danh sách/thông tin có nút thao tác dài hạn — tổng kết hôm nay, danh sách việc, trạng thái tài khoản, danh sách người dùng, chi tiết công nợ và liên kết Dashboard/Báo cáo — phải có nút `❌ Đóng`. Khi bấm, bot ưu tiên xóa tin nhắn; nếu zalo không cho phép xóa thì gỡ toàn bộ bàn phím inline để không còn thao tác cũ. Hộp xác nhận vẫn dùng `Hủy`; biên nhận Reminder và Calendar giữ `Ẩn nút` để không làm mất lịch sử thao tác.

## 1. Cấu Trúc Thẻ Xác Nhận Tương Tác (3-Digit Interactive Cards)

Mọi thao tác nhạy cảm (ghi thu/chi, tạo địa điểm, nợ, lời nhắc, calendar, tasks, cấm người dùng) được sinh thẻ xác nhận với mã 3 số ngẫu nhiên (`code`):

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

- **Đồng bộ đa nền tảng**: Thẻ được lưu đồng thời trong RAM và Redis (`pending:tx:code:*`, `pending:tx:user:*`, `pending:tx:msg:*`).

## 2. Quy Chuẩn Thu Hồi Tin Nhắn Tự Động (Automatic Message Recall & Clean Conversations)

Nhằm giữ cuộc trò chuyện luôn gọn gàng và tránh rác tin nhắn, bot áp dụng nguyên tắc: **"Toàn bộ tin nhắn sinh ra trong quá trình tương tác đều là tạm thời, khi hoàn tất chỉ để lại thông điệp kết quả cuối cùng"**:

1. **Phân vùng lưu trữ tin nhắn tạm trên Redis**:
   - `pending:tx:temp:${code}`: Lưu các thẻ xác nhận chờ theo mã (`code`).
   - `pending:tx:chat-temp:${chatId}`: Lưu các tin nhắn trung gian trong thread (thông báo đếm tim `❤️ Đã nhận X/Y...`, lời nhắc `💡 Bạn còn X yêu cầu...`, và thông báo tạo địa điểm đi kèm tạm thời).

2. **Cơ chế phân giải định danh `cliMsgId`**:
   - Trong Zalo, API `undo` bắt buộc phải có `cliMsgId` (13 số timestamp client). Nếu thiếu hoặc truyền nhầm server `msgId`, Zalo server sẽ trả về `"Lỗi không xác định"`.
   - `ZcaService` tự động bắt cặp `msgId <-> cliMsgId` qua WebSocket echo và mảng `rMsg[0].cMsgID` trong reaction, lưu vào Redis (`zca:msg:cli:*`) với TTL 24h.
   - Khi gọi `undoMessage`, hệ thống tự động bù `cliMsgId` từ Redis/cache. Nếu Zalo từ chối `undo`, hệ thống tự động fallback gọi `deleteMessage(onlyMe: true)` để dọn sạch phía bot.

3. **Xác nhận thành công (Thả ❤️ hoặc soạn `yes <code>`)**:
   - Bot gọi `recallTempMessages(chatId, code)` thu hồi thẻ xác nhận chờ và toàn bộ tin nhắn trung gian trong phòng chat (`chat-temp`).
   - Bot chỉ gửi **duy nhất 1 tin nhắn kết quả hợp nhất** chứa tiêu đề chúc mừng tim và đầy đủ nội dung DTO chi tiết:
     ```text
     🎉 Đã nhận đủ 1 lượt thả tim (❤️)! Yêu cầu [629] đã được xác nhận thành công!

     • Phân loại: 🔴 Khoản chi
     • Số tiền: 30.000 đ
     ...
     ```
4. **Luồng nhiều thẻ liên tiếp (Multi-card sequential flow)**:
   - Khi người dùng gửi câu lệnh sinh 2 yêu cầu (ví dụ: tạo nơi chốn `[650]` + khoản chi `[363]`).
   - Duyệt `[650]`: Thẻ `[650]` bị thu hồi, kết quả nơi chốn và lời nhắc `💡 Bạn còn 1 yêu cầu...` được đưa vào `chat-temp`.
   - Duyệt `[363]`: Thẻ `[363]` bị thu hồi, đồng thời quét sạch toàn bộ `chat-temp` (thu hồi cả xác nhận nơi chốn tạm và thông báo nhắc còn lại).
   - Kết quả: Trong phòng chat chỉ còn duy nhất 1 tin nhắn xác nhận hoàn tất giao dịch tại nơi chốn mới!

5. **Hết hạn sau 5 phút (Timeout)**:
   - Bot gọi `recallTempMessages(chatId, code)` thu hồi thẻ xác nhận chờ và tin nhắn trung gian.
   - Bot chỉ gửi thông báo hết hạn: `⏰ Yêu cầu ... (mã: xxx) đã hết hạn 5 phút và chưa được xác nhận.`

6. **Hủy bỏ thao tác (Thả 😡 hoặc soạn `cancel <code>`)**:
   - Bot gọi `recallTempMessages(chatId, code)` thu hồi thẻ xác nhận chờ và tin nhắn trung gian.
   - Gửi thông báo: `❌ Đã hủy giao dịch ... (mã: xxx). Yêu cầu chưa được lưu.`

7. **Chỉnh sửa thao tác (`edit <code> <nội dung>`)**:
   - Bot gọi `recallTempMessages(chatId, code)` thu hồi ngay lập tức thẻ xác nhận cũ.
   - AI phân tích lại nội dung bổ sung và gửi thẻ xác nhận mới.

8. **An toàn không chặn (Non-blocking)**:
   - Toàn bộ thao tác thu hồi được bọc trong `Promise.allSettled` và `try...catch`, chỉ ghi log warning và không được làm gián đoạn việc lưu dữ liệu vào cơ sở dữ liệu.

9. **Dọn dẹp Redis sạch sẽ**:
   - Xóa sạch các key `pending:tx:code:*`, `pending:tx:user:*`, `pending:tx:msg:*`, `pending:tx:temp:*`, `pending:tx:chat-temp:*` khi hoàn thành luồng.

## 3. Danh Mục Kiểm Tra (Verification Checklist)

1. Mọi thẻ xác nhận đều chứa mã 3 số, hướng dẫn thả tim (❤️), phẫn nộ (😡), soạn `yes/cancel/edit` và thời hạn 5 phút.
2. Khi xác nhận, thẻ chờ được thu hồi và chỉ có 1 tin nhắn kết quả hợp nhất được gửi.
3. Khi hết hạn hoặc hủy bỏ, thẻ chờ được thu hồi và chỉ có 1 tin nhắn thông báo tương ứng.
4. Khi chỉnh sửa, thẻ cũ được thu hồi ngay lập tức trước khi thẻ mới xuất hiện.
5. Unit tests trong `apps/api/src/zalo/transaction-confirmation.service.spec.ts` pass 100%.
