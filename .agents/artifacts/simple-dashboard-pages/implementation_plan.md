---
RequestFeedback: true
Status: completed
Route: implement
Authority: inspect-and-plan
Risk: medium
---

# Kế hoạch thêm các page đơn giản cho Dashboard

## Mục tiêu

Biến dashboard hiện tại thành một ứng dụng nhỏ có điều hướng nội bộ, với ba page ưu tiên dựa trên dữ liệu thật của người dùng:

1. **Trang chủ**: lời chào theo người dùng, trạng thái Google, số dư và các việc cần chú ý.
2. **Thống kê**: thu–chi tháng hiện tại, số dư, công nợ ròng và bảng giao dịch gần đây.
3. **Liên lạc**: danh bạ công nợ (`debt_contacts`) của chính người dùng, hiển thị tên, biệt danh, mô tả và ngày tạo.

Kèm theo đó, chuẩn hóa phiên dashboard: link từ zalo chỉ mang **one-time exchange token**; token này chỉ dùng để đổi lấy access token và refresh cookie một lần.

## Bằng chứng hiện trạng

- Web hiện chỉ có một view dashboard và API `/reports/dashboard`.
- API dashboard đã có toàn bộ dữ liệu cần cho Home và Thống kê (`user`, `finance`, `transactions`, `debts`, `reminders`, `tasks`, `calendar`).
- Danh bạ thật đã tồn tại trong database qua `DebtContactEntity`, nhưng chưa có endpoint dashboard để đọc danh sách; dữ liệu phải luôn giới hạn theo `userId` từ token dashboard.
- Link token hiện tại là HMAC stazaloss, có thể còn được dùng lại trước lúc hết hạn; không đáp ứng yêu cầu one-time exchange.
- `npm run agent-system:validate` vẫn chưa tồn tại trong repository; không thuộc phạm vi task này.

## Phạm vi triển khai

1. **Điều hướng và shell web**
   - Bổ sung route client-side tối giản, không thêm router dependency: `/reports`, `/reports/statistics`, `/reports/contacts` (với fallback an toàn về Home).
   - Thêm app shell theo style Flat Enterprise: brand, sidebar/nav compact trên desktop và navigation responsive trên mobile.
   - Giữ cơ chế token hiện tại tương thích với link `/reports#dashboard_token=...` từ zalo.

2. **Trang Home**
   - Dùng dashboard data hiện có, chào người dùng và hiển thị các chỉ số/việc cần chú ý nhỏ gọn.
   - Có quick links đến Thống kê và Liên lạc; giữ action làm mới/đăng xuất.

3. **Trang Thống kê**
   - Tách các chỉ số thu, chi, số dư và công nợ từ dashboard hiện có thành page riêng.
   - Dùng `DataPanel`/`DataTable` chung cho giao dịch và công nợ, không nhân bản UI table.

4. **Liên lạc — API và database read path**
   - Thêm `GET /reports/contacts`, xác thực bằng access token hiện có.
   - Thêm method read-only có phân trang/lấy giới hạn hợp lý trong `FinanceService`, truy vấn `DebtContactEntity` theo đúng `userId`, sắp xếp theo tên/ngày tạo rõ ràng.
   - Bổ sung DTO contract `IContactListItem`/`IContactListResponse` và route constant tại `packages/contracts`.
   - Thêm client/query React Query riêng, page Contacts có loading/error/empty/success states và DataTable các cột: Tên, Biệt danh, Mô tả, Ngày tạo.
   - Không cho thêm/sửa/xóa danh bạ qua web trong đợt này.

5. **Phiên dashboard và one-time exchange**
   - Tạo persisted one-time token record: token ngẫu nhiên chỉ lưu hash, `userId`, `expiresAt`, `consumedAt`, và thời điểm tạo.
   - Bot tạo URL `/reports/access` với token một lần; endpoint atomically xác minh hash/expiry/chưa-consumed, đánh dấu `consumedAt`, rồi mới cấp access token và refresh cookie.
   - Token exchange hết hạn ngắn (tối đa 20 phút); token đã dùng, hết hạn hoặc không hợp lệ phải trả `401` và không cấp phiên.
   - Đặt dashboard access token có hạn **1 ngày**; refresh token có hạn **7 ngày**, luân chuyển (rotate) sau mỗi lần refresh như flow hiện tại.
   - Giữ refresh token trong HTTP-only cookie và access token chỉ ở browser storage hiện tại; logout xóa refresh cookie. Không đưa refresh token vào URL hoặc response body.
   - Cập nhật config/env validation và test cho các trường hợp exchange lần đầu thành công, reuse bị từ chối, expiry bị từ chối, access 1 ngày và refresh 7 ngày.

6. **Tài liệu**
   - Cập nhật canonical knowledge (English) cho các contract UI/API liên quan.
   - Cập nhật developer docs (Vietnamese), gồm cách test page, route và phân quyền dữ liệu contacts; cập nhật index nếu cần.

## Ngoài phạm vi

- Không thay đổi luồng tạo/cập nhật contact qua zalo/Gemini.
- Không thêm quản lý contact, tìm kiếm, lọc, phân trang UI nâng cao hoặc biểu đồ.
- Không đổi quyền admin hay giới hạn dữ liệu của các user khác.
- Không cho phép link token được dùng lại hoặc dùng như access token trực tiếp.

## Tiêu chí nghiệm thu

- URL trực tiếp và nav nội bộ mở đúng ba page; link dashboard từ zalo vẫn vào Home.
- Home/Thống kê đọc dữ liệu thật từ `/reports/dashboard`; Contacts chỉ hiển thị contacts của access-token user.
- Exchange token chỉ cấp phiên đúng một lần; access token hết hạn sau 1 ngày và refresh cookie hết hạn sau 7 ngày.
- Table thống nhất với primitive hiện hữu, responsive, semantic và đủ loading/error/empty/success states.
- `npm run lint`, `npm run typecheck` và `npm run build` chạy thành công ở mức workspace liên quan.
- Có kiểm thử backend cho endpoint contacts nếu cấu hình test hiện tại cho phép; nếu không sẽ báo rõ giới hạn.

## Cần phê duyệt

Đã được phê duyệt và triển khai.

## Kết quả triển khai

- Có ba page Home, Thống kê và Liên lạc với navigation responsive và cùng data-table primitive.
- `GET /reports/contacts` chỉ trả contacts thuộc access-token user.
- Link zalo dùng exchange token ngẫu nhiên, persisted hash, one-time, hết hạn sau 20 phút; access token 1 ngày và refresh token 7 ngày (rotate).
- Cập nhật contract, tài liệu vận hành/kiến trúc và README cấu hình.
- Đã pass `npm run lint`, `npm run typecheck` và `npm run build`.
