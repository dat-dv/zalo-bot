# Chẩn đoán: Giao dịch xác nhận ❤️ thành công nhưng không hiện trên dashboard (2026-10-20)

## Hiện tượng
- Bot báo `🎉 Đã nhận đủ 1 lượt thả tim (❤️)! Yêu cầu [837] đã được xác nhận thành công!` — khoản chi 298.620đ, Mua sắm, 10:25 20/10/2026.
- Dashboard không thấy giao dịch này.

## Bằng chứng trong code
1. **Giao dịch đã được lưu.** `TransactionConfirmationService` (`zca/confirmation/transaction-confirmation.service.ts:1199-1239`) `await financeService.createTransaction(payload)` rồi mới gửi thẻ thành công. Nếu lưu lỗi thì sẽ vào nhánh catch và không có câu "đã được xác nhận thành công".
2. **Giao dịch thuộc về `payload.userId` = `context.senderId` lúc đề xuất** (`record-transaction-tool.strategy.ts:128-132`). Với ZCA, `senderId = message.data.uidFrom` (`zca-bot-feature.service.ts:878`); zca-js thay `"0"` (tin tự gửi) bằng uid của chính tài khoản (`node_modules/zca-js/dist/models/Message.js:10-11`) → luôn là **UID Zalo cá nhân dạng số**.
3. **Dashboard chỉ đọc dữ liệu của user trong access token.** Token được cấp cho `context.senderId` của người gõ `/dashboard` (`dashboard-tool.strategy.ts:74`). Nếu link dashboard lấy qua **Zalo Bot chính thức (webhook)** thì ID là **chuỗi hex 20 ký tự** — một user khác hoàn toàn trong hệ thống (`CONTEXT.md`: "Danh tính kênh Zalo… Hệ thống chỉ coi `users.id` là danh tính").

## Kết luận (độ tin cậy: trung bình–cao, chưa xác minh bằng dữ liệu)
Nghi vấn chính: **lệch danh tính**. Giao dịch nằm dưới UID ZCA (số), còn dashboard đang đăng nhập bằng ID khác (ID webhook hex hoặc tài khoản Zalo khác). Không phải lỗi lưu dữ liệu.

Các giả thuyết phụ đã loại/giảm:
- Lưu thất bại → loại (xem bằng chứng 1).
- Lọc kỳ trên trang Thu chi → giao dịch thuộc tháng hiện tại, nằm trong mặc định "Tháng".
- Cache phía web → TanStack Query refetch khi focus; bấm Làm mới sẽ loại trừ.
- Lệch phiên bản deploy web/API sau commit `a2eab3d` → nếu lệch, trang Thu chi sẽ báo lỗi chứ không trống; trang chủ vẫn hiện 20 giao dịch tháng này.

## Cách xác minh (cần quyền truy cập DB production — agent không truy cập được)
```sql
-- 1. Giao dịch đã lưu dưới user nào?
SELECT id, user_id, amount, note, occurred_at, created_at
FROM finance_transactions
WHERE amount = 298620 AND occurred_at::date = '2026-10-20';

-- 2. Các ID của cùng một người
SELECT id, username, first_name, grant_access, created_at FROM users ORDER BY created_at;
```
So `user_id` ở (1) với `data.user.name` trong `GET /api/dashboard` (chính là userId của token — xem Network tab của trình duyệt).

## Kết quả xác minh trên production (2026-10-20)
- Giao dịch `957e415d-…` (298.620đ) **đã lưu**, `user_id = 5369142156728714489` = **Diệu Hằng** (user riêng, `grant_access = 1`). Đây là giao dịch duy nhất của user này.
- Người dùng hỏi là **Văn Đạt** (`2099328425338516056`, 5 giao dịch). Dashboard của Đạt chỉ đọc dữ liệu của Đạt → không thấy giao dịch của Hằng.
- **Kết luận: không phải lỗi.** Giao dịch thuộc về người gửi tin; người khác thả ❤️ chỉ duyệt, không đổi chủ sở hữu. Nghi vấn "lệch ID của cùng một người" bị loại.

### Phát hiện phụ
1. **Lệch múi giờ `occurred_at`:** `occurred_at = 10:25:00` nhưng `created_at = 03:28 UTC` (= 10:28 giờ VN) → `occurred_at` đang lưu giờ VN như thể UTC, **trễ 7 tiếng**. Giao dịch gần nửa đêm hoặc cuối tháng có thể rơi sai ngày/tháng. Cần điều tra riêng.
2. **Giao dịch mồ côi:** `finance_transactions` có user `2285509137317769272` (9 giao dịch) và `effcda102859c1079848` (1 giao dịch) nhưng **không có dòng trong `users`** → dữ liệu này không ai xem được trên dashboard.
3. Admin duy nhất là `573462d8909179cf2080` ("Bot Finance Assistance", ID webhook); Văn Đạt đang là `user`.

## Đề xuất xử lý
1. **Ngay (vận hành, không sửa code):** nếu xác nhận lệch ID → vào trang "Zalo & Users" (admin), dùng **Gộp tài khoản** chuyển dữ liệu từ ID trùng sang ID giữ lại; hoặc mở dashboard bằng cách gửi `/dashboard` từ đúng tài khoản/kênh ZCA đã ghi giao dịch.
2. **Ngắn hạn (code, nhỏ):** hiển thị ID tài khoản đang đăng nhập trên dashboard (header/Settings) để lệch danh tính lộ ra ngay; trong thẻ xác nhận giao dịch có thể ghi chú "lưu cho <tên/ID>".
3. **Dài hạn (code, lớn hơn):** liên kết danh tính tự động (webhook hex ↔ UID ZCA) để mọi kênh cùng ghi vào một `users.id`. Cần plan riêng.
