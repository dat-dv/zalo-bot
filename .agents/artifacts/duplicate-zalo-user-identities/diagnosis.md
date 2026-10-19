# Chẩn đoán: Trang Users hiển thị 2 bản ghi "Văn Đạt" cho cùng một người

## Hiện tượng

| Zalo User ID | Vai trò | Trạng thái | Ngày kết nối |
| --- | --- | --- | --- |
| `573462d8909179cf2080` | Admin | Đã cấp quyền | 11/10/2026 |
| `2285509137317769272` | Thành viên | Chờ phê duyệt | 19/10/2026 |

Kỳ vọng: một người chỉ có một bản ghi.

## Nguyên nhân gốc

Cùng một tài khoản Zalo nhưng **hai kênh trả về hai loại ID khác nhau**, và hệ thống coi mỗi ID là một người dùng riêng.

1. `573462d8909179cf2080` (20 ký tự hex) là ID theo app của **Zalo Bot Platform chính thức** (webhook), được đọc ở `apps/api/src/zalo/dto/zalo-webhook.dto.ts:305` (`message.from.id` / `user_id_by_app`). Bản ghi này được tạo ngày 11/10, khi bot còn nhận tin nhắn qua webhook.
2. `2285509137317769272` (19 chữ số) là **UID Zalo cá nhân mà ZCA (`zca-js`) trả về**.
3. Commit `2e521ea` (19/10 11:42) chuyển việc tương tác và các guard sang `ZcaModule`. Từ đó `GrantAccessGuard` (`apps/api/src/zca/guards/grant-access.guard.ts:38`) gọi `registerPendingUser(senderId)` với UID của ZCA. Vì chưa có bản ghi nào mang ID này, hệ thống tạo người dùng mới: `USER` + `DENIED` (`users.service.ts:317-326`).
4. `UserEntity.id` (`apps/api/src/database/entities/user.entity.ts`) là danh tính duy nhất. Không có cột hay bảng nào liên kết nhiều ID kênh với một người, nên không thể nhận ra hai ID này là một.
5. ID ZCA cũng không nằm trong `ADMIN_USER_IDS` / `ZALO_ADMIN_ID`, nên `isAdmin` trả về false và người dùng bị đưa vào hàng chờ duyệt.

"Đen" (`738802423857631951`, cũng là UID ZCA) có thể đang gặp đúng vấn đề này nếu trước đây từng dùng kênh webhook.

## Phạm vi ảnh hưởng

- Dữ liệu cũ (giao dịch, công nợ, danh bạ nợ, lời nhắc, danh mục, Google token, thư mục Drive) gắn với ID `573462…`. Khi người dùng nhắn qua ZCA bằng ID mới, họ không thấy dữ liệu cũ. Nếu cấp quyền cho ID mới thì dữ liệu sẽ tách thành hai phần.
- Link dashboard tạo từ chat ZCA sẽ đăng nhập vào người dùng mới, nên dashboard trống.
- Độ tin cậy: **cao** đối với cơ chế (đọc code + định dạng ID + mốc thời gian commit). Mức độ dữ liệu bị tách chưa đo; cần đếm số dòng theo `user_id` trong DB.

## Đề xuất khắc phục

- **A. Tạm thời (vận hành)**: thêm UID ZCA của admin vào `ADMIN_USER_IDS`. Admin dùng lại được bot ngay, nhưng vẫn còn 2 bản ghi và dữ liệu vẫn tách.
- **B. Gộp sang UID ZCA (khuyến nghị nếu webhook chính thức đã ngừng dùng)**: một migration TypeORM chuyển toàn bộ dòng của ID cũ sang ID ZCA trên mọi bảng có `user_id` (users, finance, debts, reminders, user_tokens, categories, places, audit…), rồi xoá bản ghi trùng. Thêm thao tác "Gộp tài khoản" trên trang Users để xử lý các trường hợp sau này.
- **C. Liên kết danh tính (nếu vẫn chạy song song 2 kênh)**: thêm bảng `user_identities (provider, external_id → user_id)`. Các guard sẽ tra ID canonical trước khi `registerPendingUser`. Liên kết bằng mã xác nhận gửi từ cả hai kênh, hoặc admin gộp trên dashboard.

Kiểm thử hồi quy: spec cho `GrantAccessGuard` / `UsersService` — một ID ZCA đã liên kết hoặc đã gộp thì không tạo người dùng mới và dùng đúng quyền của tài khoản canonical.

## Cần chốt

Kênh webhook chính thức còn dùng không? Nếu không → B. Nếu còn → C.
