# Chẩn đoán: bot quên lời dặn "mày là con mèo đen 2 mái"

Ngày: 2026-10-25 · Route: investigate · Authority: propose-only

## Hiện tượng

- 17:02:17 Văn Đạt dặn: "@den tao dặn rồi mày là con mèo đen 2 mái". Bot nhận.
- 17:54:02 hỏi "Đen mày mấy tuổi r nhớ k" → bot trả lời "tôi sinh ra từ chuỗi code của ông chủ…" (vẫn gắn 🐈‍⬛ nhưng không còn nói mình là mèo đen).
- 21:42:45 hỏi "mày có nhớ mày là con gì mấy tuổi k" → "tôi là trợ lý ảo trên zalo…".
- Cấu hình kênh (theo anh Đạt): trí nhớ ngắn hạn "Số tin gần đây" = 15, trí nhớ dài hạn "Số kết quả mỗi lần tra" = 15.

Mong muốn: lời dặn về tính cách/danh tính của bot được nhớ lâu dài trong kênh.

## Kết luận

Cấu hình không sai. Lời dặn kiểu "từ giờ mày là…" là **một điều bot phải luôn nhớ**, trong khi hệ thống chỉ có hai loại trí nhớ và cả hai đều không làm việc đó:

1. **Ngắn hạn là cửa sổ trượt 15 tin của cả kênh**, không phải 15 tin của người dặn. Tin của mọi người (kể cả tin không gọi bot), câu trả lời của bot, thẻ xác nhận, thông báo "Hết hạn" đều chiếm chỗ.
2. **Dài hạn chỉ chạy khi AI tự quyết gọi `SEARCH_CHAT_HISTORY`**, và prompt chỉ hướng dẫn gọi cho câu hỏi về chuyện cũ của nhóm ("hôm trước Nam nói gì"). Câu "mày là con gì" bị hiểu là hỏi về bản thân bot nên AI trả lời luôn, không tra.
3. **Danh tính của bot bị code cứng**: cả hai lượt gọi AI đều mở đầu bằng `Bạn là trợ lý cá nhân thông minh trên Zalo.` (`apps/api/src/zca/text/text-input.service.ts:190` và `:603`). Khi lời dặn trôi khỏi cửa sổ, câu này thắng.

## Bằng chứng

### Đếm cửa sổ tại lượt 17:54:02

`buildRecentContextBlock` lấy `getRecent(chatId, { limit: contextWindow, maxAgeDays, excludeMsgId })`, tức 15 tin gần nhất của kênh trước tin đang xử lý (`text-input.service.ts:576-597`). Mọi tin của kênh đã listen đều được ghi (`zca-bot-feature.service.ts:936`), tin bot gửi cũng được ghi qua `recordBotReplyInMemory`.

| # | Giờ | Người | Tin |
| --- | --- | --- | --- |
| 1 | 17:53:38 | Đen | để em hú chị hằng… |
| 2 | 17:53:31 | Đạt | @den nhà ăn cơm chưa… |
| 3 | 17:48:22 | Đạt | Nhà ăn cơm chưa e (không gọi bot, vẫn được ghi) |
| 4 | 17:38:04 | Đen | vâng, em rõ rồi… |
| 5 | 17:37:57 | Đạt | @den 6h hơn a ms về |
| 6 | 17:33:27 | Đen | dạ em gọi anh ấy về… |
| 7 | 17:33:20 | Hằng | @Đen ơi kêu chồng Hằng về ăn cơm |
| 8 | 17:26:37 | Đen | [559] Hết hạn… |
| 9 | 17:25:50 | Đen | [302] Hết hạn… |
| 10 | 17:21:37 | Đen | thẻ Thêm việc [559] |
| 11 | 17:21:31 | Đạt | @Đen đen ngu à nhắc 1h sáng |
| 12 | 17:20:50 | Đen | thẻ Thêm việc [302] |
| 13 | 17:20:43 | Hằng | @Đen ơi nhớ nhắc chồng Hằng… |
| 14 | 17:02:36 | Đen | vừa mới "đẻ" ra hôm nay chứ mấy 🐈‍⬛ |
| 15 | 17:02:29 | Đạt | @den mày bao nhiêu tuổi rồi |
| ~~16~~ | 17:02:24 | Đen | dạ vạn vật quy về mèo đen 2 mái… (**rơi khỏi cửa sổ**) |
| ~~17~~ | 17:02:17 | Đạt | tao dặn rồi mày là con mèo đen 2 mái (**rơi khỏi cửa sổ**) |

Lời dặn vừa trượt ra ngoài đúng 2 tin. Bot vẫn gắn 🐈‍⬛ vì các câu trả lời trước của chính nó (#14, #6, #4, #1) còn trong cửa sổ: AI bắt chước văn phong, nhưng nội dung "mèo đen 2 mái" đã mất. Bốn tin #8-#12 là thẻ xác nhận và thông báo hết hạn, không mang thông tin hội thoại nhưng vẫn chiếm chỗ.

Giả định: thẻ [302]/[559] không bị thu hồi khi hết hạn (đoạn chat vẫn hiện nội dung thẻ). Nếu chúng bị thu hồi thì bị xoá khỏi trí nhớ (`markRecalled`) và lời dặn sẽ còn trong cửa sổ ở lượt 17:54, nhưng vẫn mất ở lượt 21:42.

### Lượt 21:42:45

Cách 17:02 khoảng 4,5 giờ với hàng chục tin ở giữa, nên chắc chắn đã ra khỏi cửa sổ 15 tin. "Nhớ trong 7 ngày" không giúp gì: giới hạn số tin chạm trước giới hạn ngày.

### Trí nhớ dài hạn không được dùng

- Dòng hướng dẫn tool trong prompt: `Về chuyện đã trao đổi trong cuộc chat này trước đây ("năm ngoái mình đi đâu", "hôm trước Nam nói gì"…): gọi SEARCH_CHAT_HISTORY` (`text-input.service.ts:208-210`). Câu hỏi về danh tính bot không giống các ví dụ này.
- Kể cả khi có gọi, tool chỉ trả về một câu trả lời trích dẫn ("ngày 25/10 Đạt dặn bot là mèo đen"), không đưa lời dặn vào prompt của các lượt sau. "Số kết quả mỗi lần tra = 15" không liên quan đến lỗi này.

### Không có chỗ cấu hình tính cách bot

Không có trường persona/lời dặn nào trong `ThreadBotConfig` hay `@zalobot/contracts` (đã grep `persona|botName|customInstruction|systemPrompt`). Hiện tại không có cấu hình nào khắc phục được việc này.

### Yếu tố phụ

Khối ngữ cảnh gần đây có tiêu đề "chỉ để hiểu câu hỏi hiện tại; … chúng đã được xử lý trước đó" (`text-input.service.ts:592-594`). Câu này được viết để AI không ghi lại giao dịch cũ, nhưng cũng khiến AI coi lời dặn trong khối là chuyện đã qua chứ không phải quy tắc đang áp dụng.

## Đánh giá: có nên gộp ngắn hạn và dài hạn?

- **Đúng một phần**: giao diện đang phơi bày cách cài đặt ("Số tin gần đây", "Số kết quả mỗi lần tra"), không nói về điều admin quan tâm ("bot có nhớ điều tôi dặn không").
- **Nhưng gộp không sửa được lỗi này**: hai loại là hai cơ chế khác nhau thật sự.
  - Ngắn hạn: rẻ, chạy ở mọi lượt, nhưng có giới hạn (token + dữ liệu gửi ra ngoài), nên luôn phải quên.
  - Dài hạn: lưu vô hạn, nhưng chỉ tra khi được hỏi, không thể đưa cả lịch sử vào prompt.
  Gộp thành một ô thì vẫn phải chọn một trong hai cơ chế đó, và cả hai đều quên lời dặn.
- **Thứ còn thiếu là loại thứ ba: "Điều bot luôn nhớ" (ghi nhớ cố định theo kênh)**: vài dòng ngắn luôn nằm trong prompt hệ thống, không trôi theo thời gian, sửa/xoá được. Ví dụ: "Bot tên Đen, là con mèo đen 2 mái, xưng em", "Hằng là vợ anh Đạt".

## Đề xuất khắc phục (chưa triển khai)

1. **Ghi nhớ cố định theo kênh** (`chatMemory.pinnedNotes` hoặc trường riêng trong `ThreadBotConfig`), giới hạn số dòng và độ dài, chèn vào cả hai prompt (`text-input.service.ts:190` và `:603`) ngay sau câu danh tính, với chỉ dẫn "các điều được dặn dưới đây có hiệu lực, ưu tiên hơn mô tả mặc định".
2. **Hai cách thêm ghi nhớ**:
   - Admin gõ trên trang cấu hình kênh.
   - Tool mới (ví dụ `REMEMBER_NOTE` / `FORGET_NOTE`) khi có người nói "nhớ nhé", "tao dặn rồi", "từ giờ mày là…". Vì nó đổi hành vi bot cho cả nhóm, nên đi qua thẻ xác nhận như các thao tác khác.
3. **Giao diện**: gộp thành một mục "Trí nhớ" gồm ba phần: "Điều bot luôn nhớ" (danh sách), "Nhớ đoạn chat gần đây" (bật/tắt + số tin), "Tra lại chuyện cũ" (bật/tắt; số kết quả để trong "Nâng cao").
4. **Phụ**: không đưa thẻ xác nhận và thông báo "Hết hạn" vào cửa sổ ngắn hạn (hoặc không tính chúng vào `contextWindow`), để 15 tin là 15 tin hội thoại thật.

Kiểm thử cần có: unit test cho phần dựng prompt (ghi nhớ cố định luôn có mặt dù cửa sổ rỗng), test strategy của tool ghi nhớ (qua pending action, giới hạn số dòng), test `normalizeChatMemoryConfig` cho cấu hình cũ chưa có trường mới.

Cách tạm thời trong lúc chưa sửa: tăng "Số tin gần đây" lên 30 (mức tối đa) chỉ giữ lời dặn lâu hơn trong lúc nhóm đang chat liên tục; sau vài chục tin bot vẫn quên.

## Ghi chú bảo mật (ngoài phạm vi)

Lệnh dashboard trả link đăng nhập + mã vào đúng cuộc chat đã hỏi (`dashboard-tool.strategy.ts:55`, `sendMessage(context.chatId, …)`). Nếu hỏi trong nhóm thì ai trong nhóm cũng mở được link (dùng 1 lần, 20 phút) và đăng nhập dưới tài khoản người hỏi. Tin này cũng được ghi vào cả hai trí nhớ, nên link còn hạn sẽ được gửi cho AI ở các lượt sau. Nên tách thành một việc riêng.
