---
metadata:
  agent-artifact:
    id: docs-global-zalo-response-layout
    type: documentation
    depends_on:
      - .agents/knowledge/global/zalo-response-layout.md
      - apps/api/src/zca/confirmation/transaction-confirmation.service.ts
      - apps/api/src/zca/confirmation/compact-summary.util.ts
      - apps/api/src/zca/text/zalo-plain-text.util.ts
      - apps/api/src/zca/text/text-input.service.ts
      - apps/api/src/zca/text/pending-edit-args.util.ts
      - apps/api/src/zca/confirmation/dto-descriptor.util.ts
      - apps/api/src/zca/zca-bot-feature.service.ts
---

# Bố cục phản hồi Zalo

Hướng dẫn này ánh xạ trực tiếp với tri thức canonical [`zalo-response-layout.md`](../../knowledge/global/zalo-response-layout.md).

## 1. Nguyên tắc trình bày

- Mọi phản hồi của bot là **văn bản thuần**. Zalo không có nút bấm hay bàn phím inline như các nền tảng khác, nên mọi thao tác tiếp theo đều là **gõ lệnh** (`yes 629`, `/today`...) hoặc **thả cảm xúc**.
- Bố cục: ngắn, văn bản thuần, đọc như người thật nhắn tin. Danh sách thì có một dòng tiêu đề viết thường (`Việc cần làm (3):`), rồi các dòng `• mục` hoặc `1. mục`. Riêng tin **đã xác nhận thành công** dùng dạng gọn 1–2 dòng (mục 2.1).
- **Văn phong** (mục 1.2) và **không có markdown** (mục 1.1).
- Gửi tin qua `ZcaMessengerService` (chỉ dùng ZCA): tin dài được cắt thành đoạn 1900 ký tự, gửi cách nhau 300 ms. ZCA chưa đăng nhập hoặc gửi lỗi thì trả `success: false`, không ném lỗi. Kết quả trả về `msgId`/`cliMsgId` của đoạn cuối để có thể thu hồi về sau. Trong lúc bot đang xử lý, `withChatAction` gửi hiệu ứng "đang soạn tin" của ZCA mỗi 4 giây.

### 1.1. Bỏ markdown khỏi tin gửi đi

Zalo hiển thị tin nhắn đúng từng ký tự, không hiểu markdown. Trong khi đó LLM (Gemini, OpenAI, Qwen) có thói quen in đậm bằng `**chữ**`, đặt tiêu đề bằng `#`, bọc lệnh trong dấu `` ` ``. Kết quả là người dùng thấy nguyên các ký hiệu đó trong câu trả lời. Template do bot tự dựng (thẻ xác nhận, tin kết quả...) vốn đã là văn bản thuần; markdown chỉ đến từ chữ do LLM viết.

Hệ thống chặn bằng 2 lớp (code: `apps/api/src/zca/text/zalo-plain-text.util.ts`):

1. **Dặn LLM từ đầu:** hằng `ZALO_PLAIN_TEXT_INSTRUCTION` được nối vào mọi prompt mà câu trả lời có thể gửi ra chat: prompt chính, prompt sửa thẻ (`edit <mã>`) và prompt trò chuyện trong `TextInputService`, prompt tra cứu trí nhớ dài hạn, prompt đọc hoá đơn. Khi thêm prompt mới có trả lời ra chat, nhớ nối hằng này vào.
2. **Làm sạch lúc gửi:** mọi tin ra Zalo đều đi qua `ZcaService.sendMessage`, nên ở đó bot viết lại markdown thành văn bản thuần. Lớp này là chốt chặn cuối khi LLM vẫn lỡ dùng markdown:
   - `**chữ**`, `__chữ__`, `*chữ*`, `` `chữ` `` → `chữ`. Dấu `*` không dính vào chữ (`5*3`, `a * b`) thì giữ nguyên.
   - Bỏ dấu `#` ở đầu dòng tiêu đề; bỏ dòng ```` ``` ```` (giữ nội dung bên trong) và dòng kẻ `---`, `***`.
   - `* ` hoặc `+ ` ở đầu dòng → `• ` cho khớp kiểu gạch đầu dòng của bot; `- ` giữ nguyên.
   - `[chữ](link)` → `chữ: link` để Zalo tự nhận link.
   - Dấu `**`, `__` lẻ còn sót thì bỏ. Trường hợp này xảy ra khi LLM quên đóng, hoặc khi tin dài bị cắt đoạn 1900 ký tự đúng giữa `**chữ**`.
   - Link được tách riêng ra trước rồi trả lại nguyên vẹn, nên link Drive/Photos có `_` hay `*` không bị sửa. Dấu `_` đơn (ví dụ `user_id`) cũng không bị đụng.

Ngoại lệ: tin có **tag người dùng** (nhắc việc, lời nhắc) không được làm sạch. Vị trí tag trỏ vào đúng từng ký tự trong tin, bỏ ký tự sẽ làm lệch tag. Các tin này do bot tự dựng nên không có markdown.

Tin cũ đã lưu trong trí nhớ hội thoại trước khi có quy tắc này vẫn có thể còn `**`; hệ thống không sửa lại dữ liệu cũ.

### 1.2. Văn phong: ngắn, ít icon, giống người nhắn

Ngày 25/10/2026, người dùng phản ánh tin của bot quá dài và "nghe như AI". Ví dụ: link dashboard dài 9 dòng với 5 icon và dòng gạch `━━━`; lời nhắc mở đầu bằng "TING TING! LỜI NHẮC CỦA BẠN ĐÃ ĐẾN GIỜ!"; tin nào cũng kết bằng một câu mẹo `💡 Bạn có thể…`. Trên điện thoại, vài tin như vậy đã chiếm hết màn hình, mà thông tin thật chỉ có một hai dòng. Vì vậy mọi tin do bot tự dựng (tool, guard, thẻ xác nhận, lời nhắc, tin lỗi) đều theo quy tắc sau:

1. **Tối đa 1 icon mỗi tin**, đặt ở đầu tin. Không đặt icon đầu mỗi dòng hay giữa dòng. Ngoại lệ duy nhất: ❤️ và 😡 trong dòng hướng dẫn duyệt của thẻ, vì chúng chỉ người dùng phải thả cảm xúc nào.
2. Không có dòng gạch `━━━`, không viết hoa cả câu, không dùng `*đậm*`.
3. Không có câu chào, chúc hay mẹo ở cuối tin (`💡 Bạn có thể…`, `nhé!`, `🎉`). Không mở đầu câu bằng "Vui lòng", nói thẳng việc cần làm ("Gõ /login để kết nối."). Không giải thích trong ngoặc kiểu "(để xác nhận)".
4. Giá trị trống và cài đặt mặc định thì không có dòng.
5. Tin lỗi chỉ 1 dòng: `⚠️ <chuyện gì xảy ra>`, kèm cách xử lý ngắn; vẫn giữ chi tiết lỗi.
6. Chính tả thống nhất `xoá`, `huỷ`, `khoá`, `hoá đơn`; số tiền trong danh sách và tin tóm tắt viết `15.000đ`.

Câu trả lời do LLM tự viết cũng theo tinh thần này: `ZALO_PLAIN_TEXT_INSTRUCTION` (mục 1.1) giờ dặn thêm "viết như người thật nhắn tin, câu ngắn, vào thẳng ý, không câu xã giao, tối đa 1 emoji, không viết hoa cả câu". Trước đây hằng này lại dặn ngược lại: "muốn nhấn mạnh thì dùng emoji hoặc viết hoa".

## 2. Thẻ xác nhận 3 số

Mọi thao tác nhạy cảm (ghi/xoá thu chi, ghi nợ, tạo nơi chốn, lời nhắc, tạo/xoá lịch, tạo/hoàn thành việc, khoá người dùng) không thực thi ngay mà sinh thẻ xác nhận với mã 3 số ngẫu nhiên (100–999) và thời hạn 5 phút:

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

Cách dựng thẻ (code: `transaction-confirmation.service.ts`, `dto-descriptor.util.ts`):
- **Tiêu đề** là tên thao tác kèm mã: `Lưu khoản chi [629]?`, `Thêm việc [446]?`, `Xoá lịch [512]?`… Tên thao tác (`pendingActionLabel`) tính theo loại thao tác chứ không đọc tiêu đề đã lưu. Nhờ vậy thẻ tạo từ bản cũ (còn trong Redis lúc deploy) vẫn hiện đúng khi huỷ hoặc hết hạn.
- **Không in dòng trống:** trường không có giá trị thì bỏ hẳn, không còn `• Hạn chót: (trống)`. Cài đặt đang ở mặc định cũng bỏ: chỉ hiện `Hình thức thông báo` khi là gọi điện, `Nhắc lại` khi có nhắc lại, `Cách nhắc` khi nhắn riêng. Thẻ thu chi không có dòng `Phân loại` vì tiêu đề đã nói "khoản chi" hay "khoản thu".
- **Hướng dẫn duyệt** gói trong 2 dòng. Nhóm cần nhiều tim thì ghi `❤️ x5 hoặc yes 629: duyệt`.

Ví dụ thực tế, thẻ thêm việc trước và sau:

```text
Trước (14 dòng)                         Sau (6 dòng)
⏳ Xác nhận thêm việc cần làm?           Thêm việc [446]?
                                        • Việc: Đạt mua hoa tươi…
• Việc cần làm: Đạt mua hoa tươi…       • Nhắc lúc: 09:00 14/02/2027 …
• Hạn chót: (trống)                     • Nhắc ai: @Diệu Hằng
• Nhắc lúc: 09:00 14/02/2027 …          ❤️ hoặc yes 446: duyệt · 😡 hoặc cancel 446: huỷ
• Nhắc lại: Không                       edit 446 <nội dung>: sửa · tự huỷ sau 5 phút
• Nhắc ai: @Diệu Hằng
• Cách nhắc: 👥 Tag trong nhóm
• Ghi chú: (trống)
(+ 4 dòng hướng dẫn 👉 …)
```

Cách duyệt:
- **Gõ lệnh:** `yes <mã>`, `cancel <mã>`, `edit <mã> <nội dung>`, `yes all`, `cancel all` (chấp nhận cả `xác nhận`, `hủy`, `bỏ qua`, `sửa`...). Không ghi mã thì `yes` lấy thẻ cũ nhất, `cancel`/`edit` lấy thẻ mới nhất của người gửi.
- **Thả cảm xúc (ZCA):** ❤️ cộng một lượt tim, đủ số tim yêu cầu thì duyệt; 😡 huỷ ngay.
- **Số tim cần duyệt** lấy từ cấu hình kênh `confirmationRules.requiredHearts` (nhóm mặc định 5, cá nhân 1) tại thời điểm tạo thẻ; thẻ ghi rõ "Thả tim (❤️) N lần". Chat chưa có cấu hình lưu sẵn chỉ cần 1 tim, và việc tra cứu không tự tạo cấu hình mới. Mục đích: trong nhóm, một người không thể tự duyệt thao tác nhạy cảm bằng một tim.
- Người gửi được duyệt/huỷ/sửa khi là chủ thẻ hoặc đang nhắn trong đúng cuộc trò chuyện chứa thẻ.

### 2.0. Sửa thẻ bằng tin bổ sung (không cần gõ `edit`)

Người dùng thường sửa thẻ bằng cách nhắn tiếp tự nhiên, ví dụ "@Đen tag @Văn Đạt nha", chứ ít khi gõ `edit 446 ...`. Trước đây tin như vậy đi thẳng vào LLM như một yêu cầu mới. LLM phải tự dựng lại cả việc từ văn bản thẻ cũ, nên dễ mất dữ liệu (sự cố 25/10/2026: thẻ 3 giờ nhắc thành thẻ 1 giờ nhắc), còn thẻ cũ thì treo tới khi hết hạn.

Hiện nay:

- Nếu người gửi đang có thẻ chờ **của chính mình, trong đúng cuộc trò chuyện này**, bot liệt kê các thẻ đó cho LLM và cho thêm công cụ `AMEND_PENDING`. LLM tự phân biệt "đang sửa thẻ" với "yêu cầu mới" (ví dụ đang chờ thẻ "mua sữa" mà nhắn "thêm việc mua bánh" thì vẫn là việc mới).
- Khi LLM chọn sửa, bot chạy đúng luồng `edit` với cả tin nhắn làm nội dung sửa, phát thẻ mới, rồi thu hồi thẻ cũ. Trong cùng tin đó, bot không tạo thêm thẻ cùng loại.
- Người khác trong nhóm không sửa ngầm được thẻ của bạn; họ vẫn phải gõ `edit <mã>` như trước.

### 2.0.1. Sửa thẻ không làm mất dữ liệu

Áp dụng cho cả `edit <mã>` lẫn tin bổ sung:

- **Việc cần làm và lời nhắc** được sửa theo kiểu "chỉ đổi phần được nhắc tới". LLM thấy thẻ dưới đúng dạng tham số của công cụ và chỉ trả các trường cần đổi; bot gộp với thẻ cũ.
  - Trường không nhắc tới thì giữ nguyên.
  - Đổi giờ thì thay cả danh sách giờ.
  - Đổi "nhắc lại" thì thay cả cặp số phút và số lần.
  - Ví dụ: "tag @Văn Đạt" giữ đủ 3 giờ nhắc.
- **Người được nhắc:** tin sửa có tag ai thì nhắc đúng những người đó, thay người cũ (muốn thêm chính mình thì nói "nhắc cả tôi"). Tin sửa không tag ai thì giữ người đang được nhắc, không quay về người gửi.
- **Sửa thất bại thì thẻ cũ được giữ** để vẫn duyệt được, ví dụ khi LLM lỗi, trả nhầm công cụ, hoặc loại thẻ không hỗ trợ sửa. Trước đây thẻ cũ bị thu hồi luôn dù không có thẻ mới.
- Các loại thẻ khác (thu chi, công nợ, lịch, nơi chốn) vẫn để LLM phát lại đầy đủ như cũ, vì dữ liệu của chúng không có danh sách dễ bị rơi.

### 2.1. Tin xác nhận thành công (dạng gọn)

Trước đây, duyệt xong bot gửi lại câu "🎉 Đã nhận đủ N lượt thả tim… đã được xác nhận thành công!" kèm toàn bộ các dòng `• Nhãn: giá trị`, kể cả trường `(trống)`. Mỗi tin khoảng 10 dòng, nên trong nhóm ghi nhiều khoản cùng lúc thì vài tin đã chiếm cả màn hình điện thoại. Người dùng đã xem kỹ thẻ chờ trước khi duyệt, và thẻ đó đã bị thu hồi, nên tin kết quả chỉ cần xác nhận ngắn gọn **đã lưu cái gì**.

Quy tắc (code: `apps/api/src/zca/confirmation/compact-summary.util.ts`):
- Tối đa **2 dòng**. Dòng 1 là **một** biểu tượng + `[mã]` + nội dung chính. Dòng 2 là thông tin phụ dạng chữ thường, không có icon (`đối diện ctgroup · 08:30 21/10 · MoMo`), không có thì bỏ. Riêng giao dịch có ảnh hoá đơn thì thêm một dòng `Hoá đơn: <link>` để bấm được.
- **Không in trường trống.** Các phần nối bằng ` · `.
- Duyệt bằng tim hay `yes <mã>` đều ra **cùng một mẫu**.
- Thời gian dạng `08:30 21/10` theo giờ Việt Nam; chỉ thêm năm khi khác năm hiện tại. Số tiền dạng `15.000đ`.
- Giá trị lấy từ bản ghi đã lưu (nếu có) để khớp đúng dữ liệu trong sổ.

Ví dụ:

```text
✅ [230] Chi 15.000đ · Ăn uống · bánh mỳ
đối diện ctgroup · 08:30 21/10

✅ [232] Nam (Nam Béo) nợ bạn 100.000đ · tiền ăn
08:30 21/10 · hạn 30/10

⏰ [233] Nhắc "tắt bếp" lúc 09:15 21/10
✅ [234] Thêm việc: mua hoa · nhắc 09:00 14/02 · @Văn Đạt
☑️ [235] Đã xong: nộp báo cáo
📅 [236] Họp dự án · 14:00–15:00 22/10
Phòng A · báo trước 10p
🗑️ [237] Đã xoá lịch: Họp dự án · 14:00 22/10
⛔ [238] Đã khoá Trí (id …) · đã thu hồi quyền và token Google
📍 [239] Đã tạo nơi chốn: đối diện ctgroup
```

Muốn xem đầy đủ chi tiết thì mở dashboard.

### 2.2. Các tin khác trong luồng duyệt

| Tin | Nội dung |
| --- | --- |
| Đếm tim (tin tạm) | `❤️ 2/5 [446]` |
| Hết hạn | `[446] Hết hạn, chưa lưu: thêm việc "Đạt mua hoa tươi…"` |
| Huỷ (gõ hoặc thả 😡) | `[877] Đã huỷ: thêm việc "…"` |
| `yes all` / `cancel all` | `✅ Đã duyệt 3/3 yêu cầu` / `Đã huỷ 3 yêu cầu` |
| Sai mã / không có quyền | `⚠️ Không có yêu cầu [446] đang chờ.` / `⚠️ Bạn không duyệt được yêu cầu [446].` |

Tiêu đề việc hay ghi chú dài quá 60 ký tự thì được cắt và thêm `…`, vì nội dung đầy đủ đã hiện trên thẻ.

**Đã bỏ thông báo "💡 Bạn còn N yêu cầu chờ xác nhận…".** Lý do:
- Các thẻ còn lại vẫn đang hiện trong cuộc trò chuyện, nên thông báo này thừa.
- Nó còn hay báo sai. Khi người dùng duyệt hai thẻ gần như cùng lúc (ví dụ thả tim liên tiếp hai thẻ), lần duyệt xong trước vẫn đếm thẻ kia là "còn chờ". Lần duyệt sau đã thu hồi tin tạm ngay từ lúc bắt đầu, nên tin "còn 1" ở lại mãi trong nhóm.

Lệnh `yes all` / `cancel all` vẫn dùng được và nay được giới thiệu trong `/help` (mục "Duyệt yêu cầu").

**Đã bỏ tin đếm tim gửi trùng.** Trước đây mỗi lần thả tim chưa đủ ngưỡng có **hai** tin đếm tim: một từ `TransactionConfirmationService` (được thu hồi cùng thẻ), một từ `ZcaBotFeatureService.onReaction` (không bao giờ bị thu hồi). Nay chỉ còn tin thứ nhất.

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

1. **Tin trung gian** được ghi nhận để thu hồi: đếm tim `❤️ X/Y [mã]` và kết quả tạo nơi chốn khi vẫn còn thẻ khác đang chờ.
2. **`cliMsgId`:** API `undo` của Zalo cần mã phía client (`cliMsgId`), truyền nhầm `msgId` sẽ bị từ chối. `ZcaService` bắt cặp `msgId ↔ cliMsgId` và lưu Redis 24 giờ. Nếu `undo` thất bại, bot xoá tin ở phía mình (`deleteMessage(onlyMe: true)`). Thu hồi chỉ hoạt động khi ZCA đang đăng nhập.
3. **Xác nhận:** thu hồi thẻ + tin trung gian, thực thi, gửi một tin kết quả dạng gọn (mục 2.1). Còn thẻ khác thì cũng không gửi thêm gì (mục 2.2).
4. **Thẻ đi kèm:** duyệt giao dịch có nơi chốn mới sẽ tự thu hồi và bỏ thẻ `CREATE_PLACE` tương ứng.
5. **Huỷ / hết hạn:** thu hồi thẻ và tin trung gian, gửi một tin thông báo một dòng (`[mã] Đã huỷ: …` / `[mã] Hết hạn, chưa lưu: …`).
6. **Sửa** (`edit <mã>` hoặc tin bổ sung): LLM gọi lại đúng tool đó để sinh thẻ mới với mã mới. Chỉ khi thẻ mới đã ra, bot mới thu hồi và xoá thẻ cũ.
7. **An toàn:** thu hồi chạy bằng `Promise.allSettled`; lỗi chỉ ghi log, không ảnh hưởng việc lưu dữ liệu.

## 5. Danh mục kiểm tra

1. Thẻ có mã 3 số trên tiêu đề, không có dòng `(trống)`, hướng dẫn ❤️/😡, `yes/cancel/edit` và thời hạn 5 phút gói trong 2 dòng.
1. Duyệt một thẻ khi còn thẻ khác: không có tin "Bạn còn N yêu cầu".
2. Duyệt xong chỉ còn một tin kết quả trong cuộc trò chuyện, tối đa 2 dòng (thêm dòng link hoá đơn nếu có), không có `(trống)`.
3. Huỷ hoặc hết hạn chỉ còn một tin thông báo.
4. Sửa thì thẻ mới xuất hiện rồi thẻ cũ biến mất. Nhắn bổ sung kiểu "tag @ai đó nha" khi đang có thẻ chờ cũng ra kết quả như `edit`, giữ đủ giờ nhắc.
5. Hỏi bot một câu cần liệt kê (ví dụ "gợi ý 3 món ăn sáng"): câu trả lời không còn `**`, `#` hay dấu `` ` ``.
6. Test `apps/api/src/zca/confirmation/transaction-confirmation.service.spec.ts`, `dto-descriptor.util.spec.ts`, `compact-summary.util.spec.ts`, `apps/api/src/zca/text/zalo-plain-text.util.spec.ts` và `zca.service.spec.ts` pass.
