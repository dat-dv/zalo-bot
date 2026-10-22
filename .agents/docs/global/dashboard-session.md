---
metadata:
  agent-artifact:
    id: docs-global-dashboard-session
    type: documentation
    depends_on:
      - .agents/knowledge/global/dashboard-session.md
      - apps/api/src/reports/reports-token.service.ts
      - apps/api/src/reports/reports.controller.ts
      - apps/api/src/reports/dashboard-access-code.ts
      - apps/api/src/reports/access-code-rate-limiter.ts
      - apps/api/src/users/users.service.ts
      - apps/web/src/modules/auth/presentation/components/access-code-form.tsx
      - apps/api/src/zca/text/strategies/dashboard-tool.strategy.ts
      - apps/web/src/modules/auth/client/auth-storage.ts
      - apps/web/src/shared/api/http-client.ts
      - apps/web/src/modules/auth/presentation/components/session-user-card.tsx
      - apps/web/src/shared/ui/nav-visibility.ts
---

# Phiên Dashboard và các trang web

Tài liệu này giải thích cơ chế đăng nhập Dashboard từ Zalo và cấu trúc các trang web, ánh xạ với tri thức canonical [`dashboard-session.md`](../../knowledge/global/dashboard-session.md).

## Vì sao dùng link một lần

Người dùng Zalo không có mật khẩu dashboard. Thay vào đó bot cấp một link đăng nhập dùng **một lần**, sống ngắn, gắn với chính tài khoản Zalo đã nhắn. Database chỉ lưu hash SHA-256 của token, nên dù lộ database cũng không dùng lại được link.

## Luồng đăng nhập từ Zalo

1. Người dùng nhắn `/dashboard` hoặc `dashboard`, `mở dashboard`, `xem dashboard`. Đây là lệnh fast-path, không đi qua LLM nên luôn trả link thật.
2. Bot sinh token ngẫu nhiên 32 byte, lưu hash vào bảng `dashboard_exchange_tokens` với hạn **20 phút**, rồi gửi link `<APP_URL>/api/access?token=...`. Bot đọc lại `APP_URL` trong file `.env` mỗi lần tạo link, nên khi vừa chạy tunnel (script đã ghi URL tunnel vào `APP_URL`) thì link mở được từ điện thoại mà không cần restart.
3. Khi mở link, API đánh dấu token đã dùng trong cùng một câu `UPDATE` có điều kiện (chưa dùng, chưa hết hạn). Link cũ hoặc hết hạn nhận trang lỗi `401` "Liên kết này đã hết hạn hoặc đã được sử dụng".
4. API cấp access token (24 giờ) và refresh token (7 ngày). Refresh token chỉ nằm trong cookie HTTP-only `reports_refresh`, không bao giờ đi qua URL hay body.
5. API chuyển hướng sang `<WEB_ORIGIN>/dashboard#dashboard_token=<access token>`. Nếu request đi qua domain/tunnel thật (không phải localhost), API dùng host đang truy cập thay cho `WEB_ORIGIN` để không bị đá sang domain khác.
6. Nếu tạo token lỗi, bot trả thông báo lỗi cấu hình thay vì link.

## Đăng nhập bằng mã (cho ứng dụng đã cài)

- **Vì sao cần**: trên iOS, app đã cài lên màn hình chính (PWA) có bộ nhớ và cookie riêng, tách khỏi Safari. Bấm link từ Zalo chỉ đăng nhập Safari hoặc trình duyệt trong Zalo, không bao giờ vào được app. Vì vậy tin trả lời của bot kèm thêm một **mã 8 chữ số** dạng `1234-5678` ngay dưới link.
- **Mã và link là một**: mã sinh cùng bản ghi `dashboard_exchange_tokens` (cột `code_hash`, chỉ lưu hash) và dùng chung trạng thái "đã dùng". Dùng link hoặc mã thì cả hai đều hết hiệu lực; hạn vẫn 20 phút.
- **Định dạng mã**: chỉ gồm chữ số, để gõ nhanh bằng bàn phím số trên điện thoại. Khi nhập, hệ thống bỏ qua dấu `-` và khoảng trắng. API chỉ kiểm tra "toàn chữ số, tối đa 32 ký tự", không ép độ dài cố định, nên mã cố định (bên dưới) có thể dài ngắn tuỳ ý.
- **API**: `POST /api/access/code` với body `{ code }`.
  - Thành công: trả access token dạng JSON và đặt cookie `reports_refresh` như khi dùng link.
  - Mã sai, hết hạn hoặc đã dùng: `401`.
- **Chống dò mã**: mã ngắn hơn nhiều so với token 32 byte của link, nên số lần thử bị giới hạn.
  - Tối đa 10 lần mỗi IP và 200 lần cho tất cả mọi người trong 15 phút; vượt thì trả `429`.
  - IP lấy từ `cf-connecting-ip`, sau đó `x-real-ip`. Các header này có thể bị giả, nên cần thêm giới hạn tổng.
  - Bộ đếm nằm ở Redis; nếu Redis lỗi thì đếm tạm trong bộ nhớ tiến trình.

## Mã đăng nhập cố định (`DASHBOARD_LOGIN_CODE`)

- **Vì sao cần**: sau khi bỏ Zalo Bot chính thức, lệnh `/dashboard` chỉ chạy qua ZCA. Nếu phiên ZCA hết hạn thì bot không nhắn được, mà muốn quét lại QR ZCA lại phải vào dashboard — vòng lặp không lối ra. Cài mới (chưa có admin) cũng gặp tình huống này. Mã cố định trong env là cửa vào dự phòng của chủ hệ thống.
- **Cấu hình**: `DASHBOARD_LOGIN_CODE=1234-5678-90` (chỉ chữ số, **tối thiểu 6 chữ số**; bỏ qua dấu `-` và khoảng trắng). Có chữ cái hoặc ít hơn 6 số thì API không khởi động; để trống là tắt tính năng. Giới hạn 6 số chỉ kiểm tra ở backend lúc khởi động, frontend không biết.
- **Đăng nhập thành ai**: một admin riêng có `users.id = 'dashboard-owner'`, tên "Chủ hệ thống". Mỗi lần dùng mã, tài khoản này được tạo nếu chưa có, hoặc được trả lại quyền admin nếu lỡ bị hạ quyền/khoá — nên người giữ env luôn vào được. Đổi tên trên dashboard thì tên mới được giữ.
- **Cùng ô nhập, cùng giới hạn**: nhập vào form mã đăng nhập như mã 1 lần (`POST /api/access/code`). Giới hạn thử sai được áp dụng **trước** mọi kiểm tra và dùng chung với mã 1 lần (10 lần/IP, 200 lần toàn hệ thống mỗi 15 phút). So khớp bằng hash SHA-256 và `timingSafeEqual` để không lộ thông tin qua thời gian phản hồi.
- **Mức an toàn**: trần 200 lần/15 phút cho phép khoảng 19.200 lần đoán mỗi ngày. Mã 1 lần có 10⁸ tổ hợp và chỉ sống 20 phút nên gần như không thể đoán trúng. Mã cố định thì không hết hạn: mã 6 số (10⁶ tổ hợp) có thể bị dò ra sau vài tuần nếu bị tấn công liên tục, nên **nên dùng 10–12 chữ số**. Rủi ro còn lại là **lộ mã**: mỗi lần dùng đều ghi log `warn` kèm IP (không ghi mã); nghi lộ thì đổi env và restart.
- **Hệ quả**: giao dịch tạo trên dashboard bằng tài khoản này hiển thị người tạo "Chủ hệ thống". Khi đã có `dashboard-owner`, cơ chế "người nhắn bot đầu tiên thành admin" không còn chạy — cấp quyền cho người khác ở trang `/zca`.

## Phía trình duyệt

- Web đọc `dashboard_token` (hoặc `token`) từ hash/query, lưu access token vào `localStorage` key `zalobot.dashboard.access-token` rồi xóa token khỏi URL. Nếu query chứa token không có dấu `.` (token exchange), web tự chuyển sang `/api/access` để đổi lấy phiên.
- Màn hình hết phiên (`SessionStateScreen`) có form nhập mã đăng nhập.
- Mọi request gửi `Authorization: Bearer ...`. Khi nhận `401` (trừ `/api/refresh` và `/api/access/code`), client gọi `POST /api/refresh` đúng một lần (dùng chung một promise cho các request song song), thử lại request; nếu refresh thất bại thì xóa token.
- `POST /api/logout` xóa cookie refresh.

## Các trang (nhóm private)

- `/` và `/dashboard`: Tổng quan.
- `/transactions`: Thu chi; `/expenses` và `/income` tự chuyển sang `/transactions?type=expense|income`.
- `/debts`: Vay & cho vay.
- `/analytics`: Phân tích thu–chi.
- `/calendar`, `/tasks`, `/reminders`: Lịch Google, việc cần làm, lời nhắc.
- `/contacts`: Người liên quan; `/places`: Nơi chốn.
- `/zca`: Zalo & Người dùng (đăng nhập ZCA, cuộc trò chuyện, quản lý user cho admin).
- `/google-storage`: Google Drive (tài khoản Google lưu trữ media, chỉ admin).
- `/activity`: Nhật ký hoạt động (ai thêm/sửa/xoá dữ liệu, chỉ admin).
- `/settings`: Cài đặt, danh mục thu chi.

## Biết mình đang đăng nhập bằng tài khoản nào

- Vì sao: một người có thể có nhiều ID Zalo, và link đăng nhập có thể là của ID không phải admin. Trước đây dashboard không cho biết phiên đang là ai, nên gặp thông báo "chỉ admin" thì không biết lý do.
- API `GET /api/me` trả về ID, tên Zalo, ảnh đại diện, có phải admin không và có phải chủ hệ thống (đăng nhập bằng mã cố định) không.
  - Tên lấy theo thứ tự: tên trong danh bạ ZCA (đọc cache, không gọi Zalo) → `firstName` trong bảng users → "Chưa rõ tên".
- Thẻ tài khoản hiện ảnh đại diện, tên, nhãn **Admin**/**Người dùng** và ID (bấm để copy).
  - Máy tính: ở cuối thanh bên, trên nút giao diện sáng/tối.
  - Điện thoại: ở đầu sheet "Thêm".
- Phiên `dashboard-owner` hiện "Chủ hệ thống (mã đăng nhập)", nếu chưa đổi tên.

## Mục menu chỉ dành cho admin

- "Zalo & Người dùng", "Google Drive" và "Nhật ký hoạt động" chỉ hiện khi đã xác nhận phiên là admin. Trong lúc đang tải, hoặc khi API `/api/me` lỗi, các mục này bị ẩn. Vì vậy admin F5 sẽ thấy chúng hiện ra trễ một nhịp; chuyển trang trong app thì không bị.
- Đây chỉ là ẩn trên giao diện. Quyền vẫn do API kiểm tra (`requireDashboardAdmin`); người không phải admin gõ thẳng URL vẫn gặp màn hình chặn.

Trang Người liên quan gọi `GET /api/contacts`; API tự lấy user từ access token (tối đa 200 người), không nhận `userId` từ client.

## Kiểm tra

1. Gửi `/dashboard`, mở link lần đầu: dashboard hiển thị bình thường.
2. Mở lại đúng link đó: phải thấy trang lỗi `401`, không tạo phiên mới.
3. Khi access token hết hạn (sau 24 giờ) nhưng cookie refresh còn: request đầu tiên `401` phải tự refresh và thử lại. Lưu ý client chỉ refresh khi vẫn còn access token trong `localStorage`.
4. Vào từng trang từ navigation; kiểm tra trạng thái loading/empty và cuộn ngang trên mobile.
5. Gửi `/dashboard`, nhập mã trong tin trả lời vào form ở màn hình hết phiên: vào được dashboard. Bấm lại link của cùng tin đó: phải ra trang lỗi `401`.
6. Nhập sai mã hơn 10 lần trong 15 phút: lần thứ 11 phải báo "thử quá nhiều lần" (`429`).
7. Đặt `DASHBOARD_LOGIN_CODE`, restart API, nhập mã vào form: vào được dashboard với quyền admin, log API có dòng `Dashboard sign-in with DASHBOARD_LOGIN_CODE from <ip>`. Nhập lại lần nữa vẫn vào được (mã không bị tiêu).
8. Chạy `npm run lint`, `npm run typecheck`, `npm run build`.
