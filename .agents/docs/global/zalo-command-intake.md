---
metadata:
  agent-artifact:
    id: docs-global-zalo-command-intake
    type: documentation
    depends_on:
      - .agents/knowledge/global/zalo-command-intake.md
      - apps/api/src/zalo/text/text-tool.factory.ts
      - apps/api/src/zalo/input-processor.service.ts
---

# Nhận lệnh Zalo

Hướng dẫn này ánh xạ trực tiếp với tri thức canonical [`zalo-command-intake.md`](../../knowledge/global/zalo-command-intake.md).

## 1. Hai kênh nhận tin

### 1.1 Webhook Zalo Bot Platform
- Endpoint: `POST /webhook`, kèm các alias `/zalo/webhook`, `/api/webhook`, `/api/zalo/webhook` (do `ZaloController` xử lý; các đường dẫn này nằm ngoài tiền tố `/api` chung). `GET` cùng đường dẫn dùng để Zalo kiểm tra webhook.
- Nếu cấu hình `ZALO_WEBHOOK_SECRET_TOKEN`, header `X-Bot-Api-Secret-Token` phải khớp; sai thì bot trả `{ ok: false }` và bỏ qua sự kiện.
- `ZaloMessageParser` chuẩn hoá payload thành `AgentInput` (text, ảnh, video, voice, sticker, sự kiện follow/unfollow...). Controller trả `{ ok: true }` ngay, phần xử lý chạy nền để Zalo không phải chờ.
- `InputProcessor` kiểm tra theo thứ tự:
  1. Bỏ qua tin không có người gửi hoặc do chính bot gửi.
  2. `InitialAdminBootstrapGuard`: nếu hệ thống chưa có ai, người nhắn đầu tiên trở thành admin.
  3. `GrantAccessGuard`: chỉ admin và người đã được cấp quyền mới dùng được bot.
  4. Chống spam `UsersService.checkCooldown`: mỗi người phải cách nhau 2 giây (admin được miễn; đếm trong bộ nhớ tiến trình).
  5. Phân loại: chữ → `TextInputService`; ảnh → luồng ảnh/hoá đơn; video → lưu lên Google; tin thoại → chỉ trả lời "đang phát triển" (chưa có tính năng chuyển giọng nói).

### 1.2 Tài khoản Zalo cá nhân (ZCA, `zca-js`)
- Admin đăng nhập bằng QR qua lệnh `/zlogin`. Bot khi đó tham gia nhóm như người thật.
- Mỗi cuộc trò chuyện có cấu hình riêng trong bảng `zca_thread_configs`. Mặc định tương tác trực tiếp **tắt** (`enabled: false`), **bắt buộc nhắc tên bot** (`requireMention: true`) và **không có tiền tố** (`triggerPrefix: ''`).
- Kênh ZCA dùng `GrantAccessGuard` nhưng không áp dụng cooldown. Thả cảm xúc được chuyển cho `TransactionConfirmationService.handleReaction`.

## 2. Thứ tự xử lý trong `TextInputService`

1. Làm sạch phần nhắc tên bot / tiền tố.
2. Lệnh xác nhận thẻ chờ (`TransactionConfirmationService`, nằm ở `apps/api/src/zca/confirmation/`): `yes <mã>`, `cancel <mã>`, `edit <mã> <nội dung>`, `yes all`, `cancel all` (và các biến thể tiếng Việt như `xác nhận`, `hủy`, `sửa`).
3. Lựa chọn cho ảnh đang chờ (`1`, `2`, `hủy`).
4. Lệnh nhanh (bảng dưới) — không tốn token LLM, phản hồi tức thì.
5. Còn lại: gửi cho LLM để gọi tool (xem [Nhà cung cấp LLM](llm-providers.md)). Nếu LLM không gọi tool nào:
   - Chế độ thụ động hoặc `allowAiChat === false`: bot im lặng.
   - Được phép trò chuyện tự do (`allowAiChat` khác `false`, chưa đặt cũng tính là bật): prompt gọi tool đã có sẵn đoạn "TRÒ CHUYỆN TỰ DO", và bot gọi LLM thêm một lần **không kèm tool** để trả lời. Lý do: khi prompt đầy mô tả tool tài chính/lịch, LLM có xu hướng từ chối câu hỏi ngoài lề ("em chỉ là trợ lý tài chính"); lần gọi không có tool giúp câu trả lời tự nhiên hơn. Nếu lần thứ hai lỗi hoặc rỗng, bot gửi câu trả lời của lần đầu.
   - Đánh đổi: mỗi tin trò chuyện tốn 2 lần gọi LLM. Bot không có tra cứu web, nên câu hỏi cần dữ liệu thời gian thực (lịch chiếu, giá, thời tiết) chỉ được trả lời bằng kiến thức sẵn có, kèm lưu ý có thể chưa cập nhật.

Ý nghĩa của thứ tự: lệnh xác nhận phải được bắt trước để "yes 123" không bị LLM hiểu nhầm; lệnh nhanh đứng trước LLM để tiết kiệm chi phí và chạy được kể cả khi LLM lỗi.

## 3. Bảng lệnh nhanh

"Admin" nghĩa là chỉ Quản trị viên dùng được. Lệnh nhanh bị bỏ qua (im lặng) với tin nhắn thụ động trong nhóm.

| Lệnh / bí danh | Tác dụng |
| --- | --- |
| `/start`, `start` | Lời chào (hiện huy hiệu admin nếu có) |
| `/help`, `help`, `trợ giúp`, `hướng dẫn` | Hướng dẫn sử dụng |
| `/echo <nội dung>` | Lặp lại nội dung |
| `/ping` | Kiểm tra bot còn sống |
| `/reset`, `/clear` | Chỉ gửi thông báo làm mới (bot không lưu ngữ cảnh hội thoại) |
| `/zlogin`, `/zalo-login`, `/zca-login` | Admin — đăng nhập ZCA bằng QR |
| `/zlogout`, `/zalo-logout`, `/zca-logout` | Admin — đăng xuất ZCA |
| `/login`, `/auth` | Admin — link kết nối Google |
| `/status`, `/id`, `/myid` | ID, vai trò, trạng thái Google |
| `/today`, `hôm nay` | Lịch, việc cần làm và thu–chi hôm nay |
| `/week`, `tuần này` | Lịch và việc trong 7 ngày tới (cần kết nối Google) |
| `/finance`, `/thuchi`, `/money` | Tổng thu–chi hôm nay |
| `/debts`, `/debt`, `/congo` | Các khoản nợ đang mở |
| `/tasks`, `/task`, `/viec` | Danh sách Google Tasks; `/task <tiêu đề>` tạo việc **ngay, không qua xác nhận** |
| `/reminders`, `/reminder`, `/nhacnho`, `/nhac` | Lời nhắc sắp tới |
| `/dashboard`, `dashboard`, `mở dashboard`, `xem dashboard` | Link đăng nhập dashboard một lần, hạn 20 phút |
| `/users` | Admin — danh sách người dùng |
| `/ban <id>` | Admin — tạo thẻ xác nhận khoá người dùng (không khoá được admin) |
| `/drive`, `/storage`, `/kho`, `/folder`, `/album` | Link thư mục Drive / album Photos |
| `/share <email>`, `/share-drive`, `/sharedrive`, `share <email>` | Chia sẻ thư mục Drive của cuộc trò chuyện (quyền xem) |

## 4. Xác nhận 2 bước
Mọi thay đổi dữ liệu nhạy cảm từ tool LLM và `/ban` đều tạo thẻ chờ với mã 3 số, hết hạn sau 5 phút. Chi tiết duyệt/huỷ/thu hồi tin nhắn xem [Bố cục phản hồi Zalo](zalo-response-layout.md).

## 5. Kiểm thử
`npm run test --workspace @zalobot/api` chạy toàn bộ file `*.spec.ts` trong `apps/api/src/`.
