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
      - apps/web/src/modules/auth/presentation/components/access-code-form.tsx
      - apps/api/src/zalo/text/strategies/dashboard-tool.strategy.ts
      - apps/web/src/modules/auth/client/auth-storage.ts
      - apps/web/src/shared/api/http-client.ts
---

# Phiên Dashboard và các trang web

Tài liệu này giải thích cơ chế đăng nhập Dashboard từ Zalo và cấu trúc các trang web, ánh xạ với tri thức canonical [`dashboard-session.md`](../../knowledge/global/dashboard-session.md).

## Vì sao dùng link một lần

Người dùng Zalo không có mật khẩu dashboard. Thay vào đó bot cấp một link đăng nhập dùng **một lần**, sống ngắn, gắn với chính tài khoản Zalo đã nhắn. Database chỉ lưu hash SHA-256 của token, nên dù lộ database cũng không dùng lại được link.

## Luồng đăng nhập từ Zalo

1. Người dùng nhắn `/dashboard` hoặc `dashboard`, `mở dashboard`, `xem dashboard`. Đây là lệnh fast-path, không đi qua LLM nên luôn trả link thật.
2. Bot sinh token ngẫu nhiên 32 byte, lưu hash vào bảng `dashboard_exchange_tokens` với hạn **20 phút**, rồi gửi link `<APP_URL>/api/access?token=...`. Khi chạy qua tunnel (trycloudflare, ngrok, loca.lt), bot ưu tiên origin của tunnel để link mở được từ điện thoại.
3. Khi mở link, API đánh dấu token đã dùng trong cùng một câu `UPDATE` có điều kiện (chưa dùng, chưa hết hạn). Link cũ hoặc hết hạn nhận trang lỗi `401` "Liên kết này đã hết hạn hoặc đã được sử dụng".
4. API cấp access token (24 giờ) và refresh token (7 ngày). Refresh token chỉ nằm trong cookie HTTP-only `reports_refresh`, không bao giờ đi qua URL hay body.
5. API chuyển hướng sang `<WEB_ORIGIN>/dashboard#dashboard_token=<access token>`. Nếu request đi qua domain/tunnel thật (không phải localhost), API dùng host đang truy cập thay cho `WEB_ORIGIN` để không bị đá sang domain khác.
6. Nếu tạo token lỗi, bot trả thông báo lỗi cấu hình thay vì link.

## Đăng nhập bằng mã (cho ứng dụng đã cài)

- **Vì sao cần**: trên iOS, app đã cài lên màn hình chính (PWA) có bộ nhớ và cookie riêng, tách khỏi Safari. Bấm link từ Zalo chỉ đăng nhập Safari hoặc trình duyệt trong Zalo, không bao giờ vào được app. Vì vậy tin trả lời của bot kèm thêm một **mã 8 ký tự** dạng `K7P2-QX9M` ngay dưới link.
- **Mã và link là một**: mã sinh cùng bản ghi `dashboard_exchange_tokens` (cột `code_hash`, chỉ lưu hash) và dùng chung trạng thái "đã dùng". Dùng link hoặc mã thì cả hai đều hết hiệu lực; hạn vẫn 20 phút.
- **Bảng chữ của mã**: số và chữ hoa, bỏ `I L O U` để không nhầm với `1` và `0`. Khi nhập, hệ thống không phân biệt hoa/thường và bỏ qua dấu `-`, khoảng trắng.
- **API**: `POST /api/access/code` với body `{ code }`.
  - Thành công: trả access token dạng JSON và đặt cookie `reports_refresh` như khi dùng link.
  - Mã sai, hết hạn hoặc đã dùng: `401`.
- **Chống dò mã**: mã ngắn hơn nhiều so với token 32 byte của link, nên số lần thử bị giới hạn.
  - Tối đa 10 lần mỗi IP và 200 lần cho tất cả mọi người trong 15 phút; vượt thì trả `429`.
  - IP lấy từ `cf-connecting-ip`, sau đó `x-real-ip`. Các header này có thể bị giả, nên cần thêm giới hạn tổng.
  - Bộ đếm nằm ở Redis; nếu Redis lỗi thì đếm tạm trong bộ nhớ tiến trình.

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
- `/settings`: Cài đặt, danh mục thu chi.

Trang Người liên quan gọi `GET /api/contacts`; API tự lấy user từ access token (tối đa 200 người), không nhận `userId` từ client.

## Kiểm tra

1. Gửi `/dashboard`, mở link lần đầu: dashboard hiển thị bình thường.
2. Mở lại đúng link đó: phải thấy trang lỗi `401`, không tạo phiên mới.
3. Khi access token hết hạn (sau 24 giờ) nhưng cookie refresh còn: request đầu tiên `401` phải tự refresh và thử lại. Lưu ý client chỉ refresh khi vẫn còn access token trong `localStorage`.
4. Vào từng trang từ navigation; kiểm tra trạng thái loading/empty và cuộn ngang trên mobile.
5. Gửi `/dashboard`, nhập mã trong tin trả lời vào form ở màn hình hết phiên: vào được dashboard. Bấm lại link của cùng tin đó: phải ra trang lỗi `401`.
6. Nhập sai mã hơn 10 lần trong 15 phút: lần thứ 11 phải báo "thử quá nhiều lần" (`429`).
7. Chạy `npm run lint`, `npm run typecheck`, `npm run build`.
