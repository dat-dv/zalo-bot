---
metadata:
  agent-artifact:
    id: docs-module-auth
    type: documentation
    depends_on:
      - .agents/knowledge/modules/auth/README.md
      - apps/web/src/modules/auth/client/auth-storage.ts
      - apps/web/src/modules/auth/presentation/components/session-state-screen.tsx
      - apps/web/src/modules/auth/presentation/components/access-code-form.tsx
      - apps/web/src/modules/auth/api/access-code-api.ts
      - apps/web/src/modules/auth/api/access-code-query.ts
      - apps/web/src/shared/api/http-client.ts
      - apps/web/src/shared/ui/workspace-header.tsx
      - apps/api/src/reports/reports.controller.ts
---

# Module xác thực dashboard (auth)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/auth/README.md).

## Vai trò nghiệp vụ

Dashboard không có màn hình đăng nhập. Người dùng mở dashboard bằng link dùng một lần do bot gửi trong Zalo. Module `apps/web/src/modules/auth` giữ phần phía trình duyệt của phiên đó: lưu access token ngắn hạn và hiển thị màn hình "phiên đã kết thúc". Các màn hình báo cáo không bao giờ tự đọc/ghi token.

## Luồng mở dashboard

1. Người dùng gửi `/dashboard` (hoặc "dashboard", "mở dashboard") cho bot. `DashboardToolStrategy` trả về link `<appUrl>/api/access?token=<exchange>`; link chỉ dùng được một lần và hết hạn sau 20 phút.
2. `GET /api/access` (trong `ReportsController`) đổi exchange token lấy access token 24 giờ và cookie httpOnly `reports_refresh` 7 ngày, rồi redirect sang `<webOrigin>/dashboard#dashboard_token=<access>`. Link sai, hết hạn hoặc đã dùng nhận trang HTML tiếng Việt với HTTP 401.
3. Khi web khởi động, `AppProviders` gọi `captureDashboardToken` trước khi render:
   - Đọc token theo thứ tự: fragment `#dashboard_token=` / `#token=`, rồi query `?dashboard_token=` / `?token=`.
   - Token ở query mà **không chứa dấu `.`** được coi là exchange token: trang chuyển ngay sang `/api/access?token=...` để API tiêu thụ. Token ở fragment luôn được lưu như access token.
   - Lưu token vào `localStorage` với khoá `zalobot.dashboard.access-token`, sau đó xoá tham số token khỏi URL bằng `history.replaceState`.
4. `shared/api/http-client.ts` gắn header `Authorization: Bearer <token>`. Khi nhận 401, client gọi `POST /api/refresh` đúng một lần cho mỗi request (các request đồng thời dùng chung một lời gọi refresh), lưu token mới rồi gửi lại. Nếu refresh thất bại thì xoá token.
5. Đăng xuất (`WorkspaceHeader`): gọi `POST /api/logout` (xoá cookie refresh), sau đó luôn xoá token, xoá cache query và chuyển về `/?status=logged_out`.

## Màn hình `SessionStateScreen`

- Nhận `reason`: `logged_out`, `expired` (mặc định) hoặc `error`. `expired` và `error` dùng chung nội dung "phiên hết hạn"; hiện chưa nơi nào truyền `error`.
- Được dùng ở `DashboardHomeScreen` (đã đăng xuất hoặc lỗi tải dashboard), `TransactionsScreen` và `AnalyticsScreen` (lỗi tải dashboard → `expired`).
- Các nút:
  - **Mở Zalo Bot** (tab mới): ưu tiên `NEXT_PUBLIC_ZALO_BOT_URL`, sau đó `https://zalo.me/<NEXT_PUBLIC_ZALO_BOT_USERNAME>`, cuối cùng `https://zalo.me`. Tên biến viết thường kiểu cũ (`NEXT_PUBLIC_zalo_BOT_URL`, `NEXT_PUBLIC_zalo_BOT_USERNAME`) vẫn được đọc để tương thích.
  - **Đóng mini app**: chỉ hiện khi tồn tại `window.zalo.WebApp.close`. Đây là phần còn sót từ tích hợp mini-app trước đây; Zalo hiện không cung cấp biến toàn cục này nên thực tế nút gần như không bao giờ xuất hiện.
  - **Xoá phiên & thử lại**: xoá token, xoá cache query, xoá `sessionStorage`, rồi gọi `onRetry()` nếu có, nếu không thì về trang `/`.
  - Link về trang Giới thiệu (`APP_ROUTES.about`).

## Đăng nhập bằng mã (ứng dụng đã cài / PWA)

- **Vì sao cần**: trên iOS, app đã cài lên màn hình chính có bộ nhớ riêng, tách khỏi Safari. Link một lần mở từ Zalo sẽ đăng nhập vào Safari chứ không vào app, nên người dùng cần một cách đăng nhập ngay trong app.
- **Cách hoạt động**:
  - Tin trả lời của bot kèm một mã 8 ký tự (dạng `K7P2-QX9M`), sinh cùng bản ghi với link.
  - Dùng link hoặc mã thì cả hai đều hết hiệu lực, hạn 20 phút.
  - Form `AccessCodeForm` luôn hiện trong `SessionStateScreen`. Form tự chuẩn hoá mã: không phân biệt hoa/thường, bỏ dấu `-` và khoảng trắng.
  - Đăng nhập thành công thì lưu access token và tải lại trang `/dashboard`. API cũng đặt cookie `reports_refresh` như khi dùng link.
- **Thông báo lỗi**:
  - `401`: mã sai, đã hết hạn hoặc đã dùng.
  - `429`: thử quá nhiều lần, phải đợi 15 phút.
- `httpClient` không tự refresh rồi gọi lại khi `/api/access/code` trả 401, vì mã sai không phải là phiên hết hạn.

## Lưu ý khi phát triển

- Chỉ module này được biết khoá lưu token; nơi khác phải import hàm từ `auth-storage.ts`.
- Access token có dạng `payload.signature` (có dấu `.`), exchange token thì không. `captureDashboardToken` dựa vào khác biệt này; nếu đổi định dạng token phải cập nhật hàm này.
- Khi gặp 401 liên tục: kiểm tra cookie `reports_refresh` (domain/HTTPS), endpoint `/api/refresh`, rồi mới xem tới UI.
