---
metadata:
  agent-artifact:
    id: docs-global-zalo-command-intake
    type: documentation
    depends_on:
      - .agents/knowledge/global/zalo-command-intake.md
      - apps/api/src/zca/text/text-system-prompt.ts
      - apps/api/src/zca/text/intent-eval/intent-eval.cases.ts
      - apps/api/scripts/eval-intent.ts
      - .agents/knowledge/global/zalo-command-intake.md
      - apps/api/src/zca/text/text-tool.factory.ts
      - apps/api/src/zca/text/amend-pending.tool.ts
      - apps/api/src/zca/zca-bot-feature.service.ts
---

# Nhận lệnh Zalo

Hướng dẫn này ánh xạ trực tiếp với tri thức canonical [`zalo-command-intake.md`](../../knowledge/global/zalo-command-intake.md).

## 1. Kênh nhận tin: tài khoản Zalo cá nhân (ZCA, `zca-js`)

Bot chỉ còn **một kênh** là tài khoản Zalo cá nhân của bot qua ZCA. Webhook Zalo Bot Platform chính thức (`/webhook`, `ZALO_BOT_TOKEN`) đã bị bỏ vì trùng tính năng với ZCA: ZCA vào được nhóm như người thật, thu hồi được tin nhắn, đọc được thả cảm xúc, còn bot chính thức thì không. Toàn bộ luồng xử lý chat nằm trong `apps/api/src/zca/`.

- Admin đăng nhập bằng QR trên trang `/zca` của dashboard (hoặc lệnh `/zlogin`). Bot khi đó tham gia nhóm như người thật.
- Mỗi cuộc trò chuyện có cấu hình riêng trong bảng `zca_thread_configs`. Mặc định tương tác trực tiếp **tắt** (`enabled: false`) và **không có tiền tố** (`triggerPrefixes: []`). Trong nhóm, tin nhắn luôn phải @mention bot hoặc bắt đầu bằng một tiền tố mới tới được AI; chat riêng 1-1 thì tin chữ nào cũng được xử lý; ảnh không kèm chữ chỉ được lưu.
- Thứ tự kiểm tra (một lần cho mỗi tin có gọi bot):
  1. `InitialAdminBootstrapGuard`: nếu hệ thống chưa có admin hay người được cấp quyền nào, người nhắn đầu tiên trở thành admin.
  2. `GrantAccessGuard` kèm quyền theo kênh từ `ThreadAccessService`: admin, người được cấp quyền toàn cục, và trong nhóm thì thêm mọi thành viên hoặc thành viên được chọn (xem `modules/zca/member-access.md`).
  3. Chống spam `UsersService.checkCooldown`: mỗi người phải cách nhau 2 giây (admin được miễn; đếm trong bộ nhớ tiến trình).
  4. Chuyển cho `TextInputService`. Thả cảm xúc được chuyển cho `TransactionConfirmationService.handleReaction`.
- Tin bot gửi đi qua `ZcaMessengerService` (chỉ dùng ZCA): câu trả lời dài hơn 1900 ký tự được chia thành nhiều tin cách nhau 300 ms, hiệu ứng "đang soạn tin" dùng `sendTypingEvent` của ZCA (`withTyping`). ZCA chỉ có một tín hiệu này nên không còn khái niệm "chat action" kiểu Telegram; luồng tạo hoá đơn từ ảnh cũng hiện "đang soạn tin" trong lúc AI đọc hoá đơn. Khi ZCA chưa đăng nhập thì bot không gửi được tin nào — lúc đó vào dashboard bằng `DASHBOARD_LOGIN_CODE` để quét lại QR (xem [Phiên dashboard](dashboard-session.md)).

## 2. Thứ tự xử lý trong `TextInputService`

1. Làm sạch phần nhắc tên bot / tiền tố.
2. Lệnh xác nhận thẻ chờ (`TransactionConfirmationService`, nằm ở `apps/api/src/zca/confirmation/`): `yes <mã>`, `cancel <mã>`, `edit <mã> <nội dung>`, `yes all`, `cancel all` (và các biến thể tiếng Việt như `xác nhận`, `hủy`, `sửa`). Không gõ `edit` mà nhắn bổ sung cho thẻ của mình thì được xử lý ở bước 5 (xem dưới).
3. Lựa chọn cho ảnh đang chờ (`1`, `2`, `hủy`).
4. Lệnh nhanh (bảng dưới) — không tốn token LLM, phản hồi tức thì.
5. Còn lại: gửi cho LLM để gọi tool (xem [Nhà cung cấp LLM](llm-providers.md)). Nếu LLM không gọi tool nào:
   - Chế độ thụ động hoặc `allowAiChat === false`: bot im lặng.
   - Được phép trò chuyện tự do (`allowAiChat` khác `false`, chưa đặt cũng tính là bật): prompt gọi tool đã có sẵn đoạn "TRÒ CHUYỆN TỰ DO", và bot gọi LLM thêm một lần **không kèm tool** để trả lời. Lý do: khi prompt đầy mô tả tool tài chính/lịch, LLM có xu hướng từ chối câu hỏi ngoài lề ("em chỉ là trợ lý tài chính"); lần gọi không có tool giúp câu trả lời tự nhiên hơn. Nếu lần thứ hai lỗi hoặc rỗng, bot gửi câu trả lời của lần đầu.
   - Đánh đổi: mỗi tin trò chuyện tốn 2 lần gọi LLM. Bot không có tra cứu web, nên câu hỏi cần dữ liệu thời gian thực (lịch chiếu, giá, thời tiết) chỉ được trả lời bằng kiến thức sẵn có, kèm lưu ý có thể chưa cập nhật.
   - **Người gửi đang có thẻ chờ trong cuộc trò chuyện này:** prompt liệt kê các thẻ đó (mã, loại, tham số, người đang được nhắc), và LLM có thêm công cụ `AMEND_PENDING`. Tin bổ sung như "tag @Nam nha" hay "đổi sang 10h" sẽ sửa đúng thẻ đó qua luồng `edit`, thay vì sinh thẻ thứ hai. Yêu cầu mới, độc lập vẫn chạy như thường. Nếu LLM vừa sửa thẻ vừa gọi công cụ tạo mới cùng loại trong một tin, bot bỏ lệnh tạo mới. Đánh đổi: tin sửa tốn 2 lần gọi LLM (một lần phân loại, một lần sửa). Chi tiết quy tắc sửa xem [Bố cục phản hồi Zalo](zalo-response-layout.md).
   - Nếu LLM có gọi tool: các tool chạy lần lượt, riêng `ASK_CLARIFICATION` (câu hỏi lại khi thiếu thông tin, ví dụ sinh nhật ngày nào) chạy sau cùng để câu hỏi nằm dưới các thẻ xác nhận. Câu hỏi này được gửi kể cả khi `allowAiChat === false`, vì nó thuộc một yêu cầu có tool chứ không phải trò chuyện tự do.

Ý nghĩa của thứ tự: lệnh xác nhận phải được bắt trước để "yes 123" không bị LLM hiểu nhầm; lệnh nhanh đứng trước LLM để tiết kiệm chi phí và chạy được kể cả khi LLM lỗi.

## 2b. Bot phân biệt loại tin nhắn thế nào

Trước khi gọi tool, prompt có một bảng **"PHÂN LOẠI TIN NHẮN"** (`text/text-system-prompt.ts`). AI xét theo thứ tự và chọn loại đầu tiên khớp:

| Loại | Khi nào | Ví dụ |
| --- | --- | --- |
| Lời nhắc (`SET_REMINDER`) | Muốn được báo vào một thời điểm | "8h nhắc tắt bếp", "7h tối nhớ mua sữa", "mai 9h họp" |
| Lịch hẹn (`CREATE_CALENDAR_EVENT`) | Nói rõ thêm/đặt lịch | "thêm lịch họp 14h mai" |
| Việc cần làm (`CREATE_TASK`) | Việc phải làm xong, cùng lắm có hạn theo ngày | "thêm việc nộp báo cáo", "nhớ mua sữa" |
| Ghi nhớ (`REMEMBER_NOTE`) | Mô tả lâu dài về bot hoặc nhóm, không có giờ, không có việc | "mày là con mèo đen", "từ giờ xưng em", "Hằng ăn chay" |
| Trò chuyện | Còn lại: hỏi bot, đùa, chửi, ra lệnh nhất thời | "mày là con gì", "cút lên mái nhà" |

Vì sao cần bảng này: chữ "nhớ" xuất hiện ở cả ba loại đầu ("nhớ nhắc…", "nhớ mua…", "nhớ là…"), nên trước đây bot dễ nhầm. Bảng có thêm các cặp câu dễ nhầm đặt cạnh nhau. Không có lượt gọi AI riêng để phân loại: như vậy chậm và tốn gấp đôi mà vẫn là cùng một model.

**Kiểm tra độ chính xác:** sau mỗi lần sửa prompt hoặc mô tả tool, chạy
```bash
npm run eval:intent --workspace @zalobot/api
```
Lệnh này gửi khoảng 40 câu mẫu tiếng Việt (gồm cả đoạn chat thật 25–26/10) tới đúng chuỗi LLM của bot với đúng prompt của bot, in đúng/sai từng câu và tỉ lệ; dưới 95% thì báo lỗi. Muốn dùng chuỗi LLM của production thì thêm `ENV_FILE=.env.production` trước lệnh. Lệnh không gửi tin Zalo, không ghi DB. Free tier hay chặn tần suất, nên script giãn 4 giây giữa các câu và thử lại sau 30 giây khi lỗi.

## 3. Bảng lệnh nhanh

"Admin" nghĩa là chỉ Quản trị viên dùng được. Lệnh nhanh bị bỏ qua (im lặng) với tin nhắn thụ động trong nhóm.

| Lệnh / bí danh | Tác dụng |
| --- | --- |
| `/gioithieu`, `giới thiệu`, `gioi thieu` | Lời chào (hiện huy hiệu admin nếu có). `/start` của thời Telegram đã bỏ: Zalo không tự gửi lệnh này khi mở chat, nên giờ nó đi vào LLM như tin thường |
| `/help`, `help`, `trợ giúp`, `hướng dẫn` | Hướng dẫn sử dụng |
| `/echo <nội dung>` | Lặp lại nội dung |
| `/ping` | Kiểm tra bot còn sống |
| `/reset`, `/clear` | Chỉ gửi thông báo làm mới (bot không lưu ngữ cảnh hội thoại) |
| `/zlogin`, `/zalo-login`, `/zca-login` | Admin — đăng nhập ZCA bằng QR |
| `/zlogout`, `/zalo-logout`, `/zca-logout` | Admin — đăng xuất ZCA |
| `/login`, `/auth` | Admin — link kết nối Google |
| `/status`, `/id`, `/myid` | ID, vai trò, trạng thái Google |
| `/today`, `hôm nay` | Lịch chung, việc cần làm (cả hai lưu trong zalobot) và thu–chi hôm nay |
| `/week`, `tuần này` | Lịch 7 ngày tới và việc cần làm chưa xong (không cần Google) |
| `/finance`, `/thuchi`, `/money` | Tổng thu–chi hôm nay |
| `/debts`, `/debt`, `/congo` | Các khoản nợ đang mở |
| `/tasks`, `/task`, `/viec` | Danh sách việc cần làm chưa xong; `/task <tiêu đề>` tạo việc **ngay, không qua xác nhận** |
| `/reminders`, `/reminder`, `/nhacnho`, `/nhac` | Lời nhắc sắp tới |
| `/dashboard`, `dashboard`, `mở dashboard`, `xem dashboard` | Link đăng nhập dashboard một lần kèm mã 8 chữ số, hạn 20 phút |
| `/users` | Admin — danh sách người dùng |
| `/ban <id>` | Admin — tạo thẻ xác nhận khoá người dùng (không khoá được admin) |
| `/drive`, `/storage`, `/kho`, `/folder`, `/album` | Link thư mục Drive / album Photos |
| `/share <email>`, `/share-drive`, `/sharedrive`, `share <email>` | Chia sẻ thư mục Drive của cuộc trò chuyện (quyền xem) |

## 4. Xác nhận 2 bước
Mọi thay đổi dữ liệu nhạy cảm từ tool LLM và `/ban` đều tạo thẻ chờ với mã 3 số, hết hạn sau 5 phút. Chi tiết duyệt/huỷ/thu hồi tin nhắn xem [Bố cục phản hồi Zalo](zalo-response-layout.md).

## 5. Kiểm thử
`npm run test --workspace @zalobot/api` chạy toàn bộ file `*.spec.ts` trong `apps/api/src/`.
