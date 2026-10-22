---
metadata:
  agent-artifact:
    id: docs-global-zalo-response-layout
    type: documentation
    depends_on:
      - .agents/knowledge/global/zalo-response-layout.md
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
      - apps/api/src/zca/confirmation/compact-summary.util.ts
---

# Bố cục phản hồi Zalo

Hướng dẫn này ánh xạ trực tiếp với tri thức canonical [`zalo-response-layout.md`](../../knowledge/global/zalo-response-layout.md).

## 1. Nguyên tắc trình bày

- Mọi phản hồi của bot là **văn bản thuần**. Zalo không có nút bấm hay bàn phím inline như các nền tảng khác, nên mọi thao tác tiếp theo đều là **gõ lệnh** (`yes 629`, `/today`...) hoặc **thả cảm xúc**.
- Bố cục: một dòng tiêu đề ngắn có emoji, sau đó các dòng `• Nhãn: giá trị`. Giữ gọn để đọc tốt trên điện thoại. Riêng tin **đã xác nhận thành công** dùng dạng gọn 1–2 dòng (mục 2.1).
- Gửi tin qua `ZcaMessengerService` (chỉ dùng ZCA): tin dài được cắt thành đoạn 1900 ký tự, gửi cách nhau 300 ms. ZCA chưa đăng nhập hoặc gửi lỗi thì trả `success: false`, không ném lỗi. Kết quả trả về `msgId`/`cliMsgId` của đoạn cuối để có thể thu hồi về sau. Trong lúc bot đang xử lý, `withChatAction` gửi hiệu ứng "đang soạn tin" của ZCA mỗi 4 giây.

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
- **Số tim cần duyệt** lấy từ cấu hình kênh `confirmationRules.requiredHearts` (nhóm mặc định 5, cá nhân 1) tại thời điểm tạo thẻ; thẻ ghi rõ "Thả tim (❤️) N lần". Chat chưa có cấu hình lưu sẵn chỉ cần 1 tim, và việc tra cứu không tự tạo cấu hình mới. Mục đích: trong nhóm, một người không thể tự duyệt thao tác nhạy cảm bằng một tim.
- Người gửi được duyệt/huỷ/sửa khi là chủ thẻ hoặc đang nhắn trong đúng cuộc trò chuyện chứa thẻ.

### 2.1. Tin xác nhận thành công (dạng gọn)

Trước đây, duyệt xong bot gửi lại câu "🎉 Đã nhận đủ N lượt thả tim… đã được xác nhận thành công!" kèm toàn bộ các dòng `• Nhãn: giá trị`, kể cả trường `(trống)`. Mỗi tin khoảng 10 dòng, nên trong nhóm ghi nhiều khoản cùng lúc thì vài tin đã chiếm cả màn hình điện thoại. Người dùng đã xem kỹ thẻ chờ trước khi duyệt, và thẻ đó đã bị thu hồi, nên tin kết quả chỉ cần xác nhận ngắn gọn **đã lưu cái gì**.

Quy tắc (code: `apps/api/src/zca/confirmation/compact-summary.util.ts`):
- Tối đa **2 dòng**. Dòng 1 là biểu tượng + `[mã]` + nội dung chính. Dòng 2 là thông tin phụ, không có thì bỏ. Riêng giao dịch có ảnh hoá đơn thì thêm một dòng `🧾 <link>` để bấm được.
- **Không in trường trống.** Các phần nối bằng ` · `.
- Duyệt bằng tim hay `yes <mã>` đều ra **cùng một mẫu**.
- Thời gian dạng `08:30 21/10` theo giờ Việt Nam; chỉ thêm năm khi khác năm hiện tại. Số tiền dạng `15.000đ`.
- Giá trị lấy từ bản ghi đã lưu (nếu có) để khớp đúng dữ liệu trong sổ.

Ví dụ:

```text
✅ [230] Chi 15.000đ · Ăn uống · bánh mỳ
📍 đối diện ctgroup · 🕗 08:30 21/10

✅ [232] Nam (Nam Béo) nợ bạn 100.000đ · tiền ăn
🕗 08:30 21/10 · ⏳ hạn 30/10

⏰ [233] Nhắc "tắt bếp" lúc 09:15 21/10
☑️ [235] Đã xong: nộp báo cáo
📅 [236] Họp dự án · 14:00–15:00 22/10
📍 Phòng A · 🔔 trước 10p
🗑️ [237] Đã xoá lịch: Họp dự án · 14:00 22/10
⛔ [238] Đã khoá Trí (id …) · đã thu hồi quyền và token Google
📍 [239] Đã tạo nơi chốn: đối diện ctgroup
```

**Không đổi:** thẻ chờ duyệt vẫn đủ trường (cần xem kỹ trước khi duyệt), tin đếm tim, lời nhắc "còn N yêu cầu chờ", kết quả `yes all` và các tin báo lỗi. Muốn xem đầy đủ chi tiết thì mở dashboard.

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
3. **Xác nhận:** thu hồi thẻ + tin trung gian, thực thi, gửi một tin kết quả dạng gọn (mục 2.1). Nếu còn thẻ khác, gửi lời nhắc (cũng là tin tạm).
4. **Thẻ đi kèm:** duyệt giao dịch có nơi chốn mới sẽ tự thu hồi và bỏ thẻ `CREATE_PLACE` tương ứng.
5. **Huỷ / hết hạn:** thu hồi thẻ và tin trung gian, gửi một tin thông báo (`⏰ ... (mã: xxx) đã hết hạn 5 phút và chưa được xác nhận.`).
6. **Sửa:** thu hồi thẻ cũ, LLM gọi lại đúng tool đó để sinh thẻ mới với mã mới, rồi xoá thẻ cũ.
7. **An toàn:** thu hồi chạy bằng `Promise.allSettled`; lỗi chỉ ghi log, không ảnh hưởng việc lưu dữ liệu.

## 5. Danh mục kiểm tra

1. Thẻ có mã 3 số, hướng dẫn ❤️/😡, `yes/cancel/edit` và thời hạn 5 phút.
2. Duyệt xong chỉ còn một tin kết quả trong cuộc trò chuyện, tối đa 2 dòng (thêm dòng link hoá đơn nếu có), không có `(trống)`.
3. Huỷ hoặc hết hạn chỉ còn một tin thông báo.
4. Sửa thì thẻ cũ biến mất trước khi thẻ mới xuất hiện.
5. Test `apps/api/src/zca/confirmation/transaction-confirmation.service.spec.ts` và `compact-summary.util.spec.ts` pass.
