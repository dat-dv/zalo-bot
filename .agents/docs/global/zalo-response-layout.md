---
metadata:
  agent-artifact:
    id: docs-global-zalo-response-layout
    type: documentation
    depends_on:
      - .agents/knowledge/global/zalo-response-layout.md
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
---

# Bố cục phản hồi Zalo

Hướng dẫn này ánh xạ trực tiếp với tri thức canonical [`zalo-response-layout.md`](../../knowledge/global/zalo-response-layout.md).

## 1. Nguyên tắc trình bày

- Mọi phản hồi của bot là **văn bản thuần**. Zalo không có nút bấm hay bàn phím inline như các nền tảng khác, nên mọi thao tác tiếp theo đều là **gõ lệnh** (`yes 629`, `/today`...) hoặc **thả cảm xúc**.
- Bố cục: một dòng tiêu đề ngắn có emoji, sau đó các dòng `• Nhãn: giá trị`. Giữ gọn để đọc tốt trên điện thoại.
- Gửi tin qua `ZaloService`: nếu có token Bot Platform, tin dài được cắt thành đoạn 1900 ký tự (cách nhau 300 ms); nếu Bot API lỗi mà ZCA đang đăng nhập thì gửi lại qua ZCA. Không có token thì gửi thẳng qua ZCA. Kết quả trả về `msgId`/`cliMsgId` để có thể thu hồi về sau.

## 2. Thẻ xác nhận 3 số

Mọi thao tác nhạy cảm (ghi/xoá thu chi, ghi nợ, tạo nơi chốn, lời nhắc, tạo/xoá lịch, tạo/hoàn thành việc, khoá người dùng) không thực thi ngay mà sinh thẻ xác nhận với mã 3 số ngẫu nhiên (100–999) và thời hạn 5 phút:

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

Cách duyệt:
- **Gõ lệnh:** `yes <mã>`, `cancel <mã>`, `edit <mã> <nội dung>`, `yes all`, `cancel all` (chấp nhận cả `xác nhận`, `hủy`, `bỏ qua`, `sửa`...). Không ghi mã thì `yes` lấy thẻ cũ nhất, `cancel`/`edit` lấy thẻ mới nhất của người gửi.
- **Thả cảm xúc (ZCA):** ❤️ cộng một lượt tim, đủ số tim yêu cầu thì duyệt; 😡 huỷ ngay.
- **Lưu ý:** mỗi thẻ hiện chỉ cần 1 tim. Cấu hình nhóm `confirmationRules.requiredHearts` (mặc định 5 với nhóm) đã lưu nhưng chưa được áp dụng khi tạo thẻ.
- Người gửi được duyệt/huỷ/sửa khi là chủ thẻ hoặc đang nhắn trong đúng cuộc trò chuyện chứa thẻ.

## 3. Khoá Redis

| Khoá | Nội dung |
| --- | --- |
| `pending:tx:code:<mã>` | Toàn bộ dữ liệu thẻ chờ |
| `pending:tx:user:<userId>` | Mã thẻ mới nhất của người dùng |
| `pending:tx:user-codes:<userId>` | Danh sách mọi mã đang chờ của người dùng — phục vụ `yes all`, `cancel all` và kiểm tra nơi chốn đang chờ tạo |
| `pending:tx:msg:<msgId>` | Mã thẻ gắn với tin nhắn (để tra khi có người thả cảm xúc) |
| `pending:tx:temp:<mã>` | Tin nhắn cần thu hồi theo mã (TTL 1 giờ) |
| `pending:tx:chat-temp:<chatId>` | Tin nhắn trung gian trong cuộc trò chuyện (TTL 1 giờ) |
| `zca:msg:cli:<msgId>` | `cliMsgId` dùng để thu hồi (TTL 24 giờ) |

Thẻ chờ cũng được giữ trong bộ nhớ kèm bộ hẹn giờ; Redis là bản sao để chịu được khởi động lại và vẫn chạy được khi Redis mất kết nối.

## 4. Thu hồi tin nhắn tự động

Nguyên tắc: **tin nhắn trong quá trình tương tác là tạm thời; khi xong chỉ còn lại tin kết quả.**

1. **Tin trung gian** được ghi nhận để thu hồi: đếm tim `❤️ Đã nhận X/Y...`, nhắc `💡 Bạn còn X yêu cầu chờ xác nhận...`, và kết quả tạo nơi chốn khi vẫn còn thẻ khác đang chờ.
2. **`cliMsgId`:** API `undo` của Zalo cần mã phía client (`cliMsgId`), truyền nhầm `msgId` sẽ bị từ chối. `ZcaService` bắt cặp `msgId ↔ cliMsgId` và lưu Redis 24 giờ. Nếu `undo` thất bại, bot xoá tin ở phía mình (`deleteMessage(onlyMe: true)`). Thu hồi chỉ hoạt động khi ZCA đang đăng nhập.
3. **Xác nhận:** thu hồi thẻ + tin trung gian, thực thi, gửi một tin kết quả. Nếu còn thẻ khác, gửi lời nhắc (cũng là tin tạm).
4. **Thẻ đi kèm:** duyệt giao dịch có nơi chốn mới sẽ tự thu hồi và bỏ thẻ `CREATE_PLACE` tương ứng.
5. **Huỷ / hết hạn:** thu hồi thẻ và tin trung gian, gửi một tin thông báo (`⏰ ... (mã: xxx) đã hết hạn 5 phút và chưa được xác nhận.`).
6. **Sửa:** thu hồi thẻ cũ, LLM gọi lại đúng tool đó để sinh thẻ mới với mã mới, rồi xoá thẻ cũ.
7. **An toàn:** thu hồi chạy bằng `Promise.allSettled`; lỗi chỉ ghi log, không ảnh hưởng việc lưu dữ liệu.

## 5. Danh mục kiểm tra

1. Thẻ có mã 3 số, hướng dẫn ❤️/😡, `yes/cancel/edit` và thời hạn 5 phút.
2. Duyệt xong chỉ còn một tin kết quả trong cuộc trò chuyện.
3. Huỷ hoặc hết hạn chỉ còn một tin thông báo.
4. Sửa thì thẻ cũ biến mất trước khi thẻ mới xuất hiện.
5. Test `apps/api/src/zca/confirmation/transaction-confirmation.service.spec.ts` pass.
