# Chẩn đoán: job BullMQ đã chạy nhưng không thấy tin nhắc gửi qua Zalo

- Route: `investigate`, Authority: `propose-only`
- Thời điểm kiểm tra: 2026-10-22, khoảng 22:57 giờ VN (15:57Z), sau khi deploy v1.0.169

## Hiện tượng

Theo anh mô tả: job đã lên (worker chạy) nhưng không thấy tin nhắc nào gửi qua Zalo.

## Bằng chứng đã thu

1. **Phần nối Nest với BullMQ chạy đúng.** Em boot một app Nest tối giản với `QueueModule`, `BullModule.registerQueue` và `TaskReminderProcessor` lấy từ `dist` thật, trỏ vào một Redis tạm. Kết quả: job scheduler được tạo, worker nhận job `scan` ngay. Như vậy worker có được tạo và có xử lý job.
2. **ZCA trên prod đang đăng nhập** (`GET /api/zca/status`): `loggedIn: true`, `isListening: true`. Hàm `isConnected()` chỉ kiểm tra `zcaService.isLoggedIn()`, nên scan không bị bỏ qua vì lý do ZCA.
3. **Hiện chưa có lần nhắc nào đến hạn** (`GET /api/reminders` và `GET /api/tasks` trên prod):

| Lời nhắc | Giờ nhắc kế tiếp | Kênh nhận | Ghi chú |
| --- | --- | --- | --- |
| Hello đi ngủ (hằng ngày) | 23:33 22/10 (16:33Z) | `2099328425338516056` (Văn Đạt, UID ZCA) | **Chưa tới giờ** lúc kiểm tra |
| Hello Morning ! (hằng ngày) | 13:35 23/10 | `chatId = null` ⇒ chat riêng của chủ lời nhắc `573462d8909179cf2080` | Xem mục 4 |

   Không việc cần làm nào có giờ nhắc. Vì vậy từ lúc deploy tới giờ kiểm tra, không có gì để scan lấy lên, và việc không có tin là đúng.
4. **Lỗi có sẵn từ trước (không phải do BullMQ):** "Hello Morning !" không có `chatId`, nên được gửi vào chat riêng của người tạo là `573462d8909179cf2080`.
   - Đây là ID 20 ký tự hex của Zalo Bot chính thức đã bị bỏ. Theo CONTEXT.md, loại ID này chỉ còn trong dữ liệu cũ; ZCA không gửi tới ID này được.
   - Tài khoản dashboard đang dùng (`/api/me`, "Bot Finance Assistance") cũng chính là ID này. Vì vậy mọi lời nhắc tạo trên dashboard bằng tài khoản này mà không chọn kênh sẽ mặc định gửi tới ID cũ và **không bao giờ tới**.
   - Trước đây cron gửi lỗi thì ghi log rồi bỏ. Giờ BullMQ thử lại 5 lần rồi mới bỏ. Kết quả cuối giống nhau: không tới.

## Kết luận

- **Chưa thấy lỗi nào do việc chuyển sang BullMQ.** Lý do không có tin rất có thể là chưa có lần nhắc nào đến hạn kể từ khi deploy. Lần thử thật đầu tiên là "Hello đi ngủ" lúc 23:33 tối nay.
- **Lỗi thật, có từ trước:** lời nhắc tạo trên dashboard bằng tài khoản ID cũ mà không chọn kênh thì không bao giờ tới.
- **Chưa xác nhận được:** em không xem được log API trên Coolify, nên chưa loại trừ được trường hợp job `deliver` báo lỗi ở prod. Cần một trong hai cách ở mục "Đề xuất".

## Đề xuất

1. **Xác nhận đầu-cuối trên prod**, chọn một trong hai:
   - Chờ tới 23:33 xem "Hello đi ngủ" có tới chat của Văn Đạt không; hoặc
   - Em tạo một lời nhắc thử trên dashboard, nhắc sau 2 phút vào chat của Văn Đạt, thấy tới thì xoá. Cách này **gửi một tin thật**, nên cần anh đồng ý.
   - Nếu không tới, cần log API quanh giờ nhắc, lọc theo `Reminder`, `queue`, `deliver`.
2. **Sửa lỗi ID cũ** (task riêng, cần plan):
   - Dữ liệu: đổi kênh nhận của "Hello Morning !" sang UID ZCA của anh, có thể làm ngay trên dashboard bằng cách chọn kênh.
   - Code: khi kênh nhận mặc định là ID 20 hex của bot cũ, bắt buộc chọn kênh (giống như `dashboard-owner`), thay vì lưu một đích không gửi được. Cách làm gọn hơn là gộp tài khoản ID cũ vào UID ZCA bằng tính năng **Gộp tài khoản** đã có.
