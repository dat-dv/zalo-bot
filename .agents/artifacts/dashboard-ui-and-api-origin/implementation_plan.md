# Kế hoạch: cải thiện Dashboard và chuẩn hoá domain API

RequestFeedback: true

## Bối cảnh đã xác nhận

- Dashboard Next.js được xuất tĩnh tại `apps/web/out`; không có Next.js API Route, Route Handler hoặc BFF.
- NestJS là API duy nhất và đã đặt global prefix `/api`.
- `https://zalobot.datintech.site` là origin chung. Nginx ở tầng web server quyết định route: `/api/*` được chuyển thẳng sang NestJS; các route còn lại được trả từ static Next.js output.
- Vì vậy `NEXT_PUBLIC_API_URL` là `https://zalobot.datintech.site` (không có `/api`). Các API route dùng sẵn tiền tố `/api`, nên request thực tế là `https://zalobot.datintech.site/api/...` và không tạo `/api/api/...`.

## Mục tiêu

1. Làm mới dashboard theo phong cách B2B vận hành: gọn, ưu tiên dữ liệu, dễ quét trên desktop và vẫn sử dụng tốt trên điện thoại.
2. Cố định rõ hợp đồng URL production: domain mặc định là frontend; browser gọi `/api/*` cùng origin và Nginx định tuyến request đó sang NestJS.
3. Giữ nguyên session qua zalo, API contract, dữ liệu và luồng đăng xuất hiện có.

## Phạm vi thay đổi dự kiến

### 1. Cấu hình endpoint frontend và deployment

- Cập nhật `apps/web/src/shared/api/http-client.ts` để chuẩn hoá public origin (loại bỏ slash cuối) và ngăn cấu hình `NEXT_PUBLIC_API_URL` kết thúc bằng `/api`; các `API_ROUTES` hiện hữu giữ nguyên tiền tố `/api`.
- Cập nhật `.env.example`, `apps/web/.env.local.example`, `docker-compose.yml`, `README.md`, và tài liệu kiến trúc để ghi rõ:
  - `APP_URL` và `WEB_ORIGIN`: `https://zalobot.datintech.site`.
  - `NEXT_PUBLIC_API_URL`: `https://zalobot.datintech.site`.
  - Không sử dụng API route của Next.js: Nginx chuyển `/api/*` sang NestJS, còn các URL khác phục vụ static frontend.
- Giữ và bổ sung kiểm tra cho rule Nginx `/api/ -> api:3000/api/`; đây là biên định tuyến bắt buộc, không phải API route của Next.js.

### 2. Làm mới UI dashboard

- Chỉnh `dashboard-screen.tsx`, shared navigation/table và stylesheet để tạo một workspace phẳng, data-dense:
  - header rõ trạng thái kết nối Google, nút làm mới và đăng xuất có thứ bậc;
  - thanh truy cập nhanh đồng nhất với navigation và hỗ trợ trạng thái hover/focus;
  - chỉ số tài chính thành một dải thông tin dễ so sánh, dùng màu ngữ nghĩa cho số dư/cần thu/cần trả;
  - bảng giữ mật độ cao, cột dễ quét, empty/loading/error state gọn và có CTA;
  - responsive: thanh điều hướng cuộn ngang, action dễ chạm, bảng tiếp tục cuộn ngang thay vì biến thành card.
- Không thay đổi DTO, endpoint hay business logic trong dashboard.

### 3. Đồng bộ tài liệu bắt buộc

- Cập nhật `.agents/knowledge/modules/dashboard/README.md` bằng tiếng Anh: yêu cầu UI, quy tắc API origin và seam reverse-proxy.
- Cập nhật `.agents/docs/modules/dashboard/README.md` bằng tiếng Việt và `.agents/docs/README.md`: hướng dẫn cấu hình/kiểm tra production.

## Kiểm thử và nghiệm thu

1. `npm run lint --workspace @zalobot/web`
2. `npm run typecheck --workspace @zalobot/web`
3. `npm run build --workspace @zalobot/web` để đảm bảo static export vẫn hợp lệ và bundle nhận đúng public origin.
4. Kiểm tra bản build/preview ở desktop và mobile: navigation, focus keyboard, loading/error/empty/success, cùng URL request đúng dạng `https://zalobot.datintech.site/api/...` và không bị lặp `/api/api`.

## Rủi ro và cách kiểm soát

- `NEXT_PUBLIC_API_URL` là biến build-time: sau khi đổi production config cần build/redeploy lại bundle static web.
- Không thay đổi trực tiếp `.env` hoặc `.env.local` vì đây là cấu hình runtime có thể chứa bí mật; hướng dẫn và template sẽ được cập nhật, còn server production cần nhập đúng giá trị khi deploy.
- `APP_URL` phải tiếp tục là frontend origin để backend tự tạo link zalo `.../api/access`, không được thêm `/api` vào biến này.

## Cần anh xác nhận

Anh duyệt kế hoạch này, em sẽ triển khai UI dashboard và chuẩn hoá tài liệu/cấu hình theo quy ước origin ở trên.

## Kết quả triển khai

- Hoàn tất: chuẩn hoá API origin ở HTTP client, UI dashboard, template cấu hình production, ghi chú Nginx và tài liệu dashboard/kiến trúc.
- Không thay đổi DTO, API contract hoặc session flow.
- Đã kiểm tra: `git diff --check`, `npm run lint --workspace @zalobot/web`, `npm run typecheck --workspace @zalobot/web`, và `npm run build --workspace @zalobot/web` đều thành công; 7 route web được xuất static.

## Bổ sung: callback OAuth có prefix `/api`

RequestFeedback: true

- Bỏ ngoại lệ `oauth2callback` khỏi NestJS global prefix để callback chính thức là `https://zalobot.datintech.site/api/oauth2callback`.
- Đổi URL callback mặc định trong cấu hình OAuth sang `${APP_URL}/api/oauth2callback`.
- Để Nginx định tuyến callback theo cùng rule `/api/*` sang NestJS; gỡ location `/oauth2callback` riêng để không còn public route không prefix.
- Cập nhật tài liệu và test/check script liên quan; Google Cloud Console phải khai báo chính xác `https://zalobot.datintech.site/api/oauth2callback` trong Authorized redirect URIs.
- Xác minh bằng typecheck/test phù hợp cho API và Nginx config/diff review.

## Bổ sung: mở CORS cho development từ mọi origin

RequestFeedback: true

- Đổi cấu hình CORS NestJS sang phản chiếu origin request (`origin: true`) khi `CORS_ALLOW_ALL=true`; cách này tương thích `credentials: true`, khác với `origin: '*'` vốn bị browser từ chối khi dùng cookie.
- Giữ mặc định production an toàn theo `WEB_ORIGIN`; chỉ bật mở toàn bộ khi biến `CORS_ALLOW_ALL=true` được đặt rõ ràng.
- Thêm `CORS_ALLOW_ALL=false` vào template ENV và hướng dẫn: dùng `true` tạm thời để web local `http://localhost:5173` gọi remote API; tắt lại sau khi thử nghiệm.
- Xác minh typecheck API và kiểm tra cấu hình CORS không làm thay đổi route `/api/*` hoặc redirect OAuth.

### Kết quả triển khai CORS

- Đã thêm `CORS_ALLOW_ALL`; giá trị mặc định trong template là `false`, còn `.env` và `.env.local` trong workspace đang đặt `true` theo yêu cầu.
- Khi bật, NestJS phản chiếu origin request với `credentials: true`; khi tắt, chỉ cho phép `WEB_ORIGIN` (và `http://localhost:5173` ở non-production).
- Đã kiểm tra thành công: API typecheck, API lint, `git diff --check`, và `npm run agent-system:validate`.

## Bổ sung: xử lý 401 cho link Dashboard một lần

RequestFeedback: true

### Dấu hiệu đã xác nhận

- `GET /api/access?token=...` đã đến NestJS (trả JSON `401 Unauthorized`), vì vậy không phải lỗi Next.js static route, Nginx routing hay CORS.
- `consumeExchangeToken` trả 401 khi token trống, hết hạn, đã tiêu thụ, không tồn tại trong database của instance nhận request, hoặc user ID lưu trong record không hợp lệ.

### Kế hoạch khắc phục

1. Thêm kiểm tra/diagnostic bảo mật cho exchange token: log có cấu trúc chỉ gồm mã lý do (`missing`, `expired`, `consumed`, `not-found`, `invalid-user`), không ghi token hoặc token hash.
2. Thêm test regression cho luồng phát rồi tiêu thụ token cùng repository để khóa hành vi valid, expired và one-time use.
3. Bổ sung health/check script xác nhận bot và `/api/access` nhìn thấy cùng database token trước khi phát hành; hướng dẫn production đảm bảo bot/API dùng cùng instance hoặc cùng persistent SQLite volume.
4. Cập nhật runbook xử lý 401 và điều chỉnh response người dùng cuối tại endpoint access để hướng họ mở link mới từ bot, thay vì JSON 401 thô.
5. Chạy test/typecheck/lint API và kiểm tra route qua Nginx. Việc deploy/restart production hoặc đồng bộ volume sẽ được báo riêng vì cần quyền hạ tầng.

## Bổ sung: nút Dashboard sinh link mới khi bấm

RequestFeedback: true

### Hành vi hiện tại

- Mỗi lần người dùng gửi `/help`, bot phát một exchange token mới và gắn trực tiếp vào URL button.
- Bấm lại cùng URL button sẽ dùng lại token cũ; vì token chỉ dùng một lần, NestJS trả 401.

### Hành vi mới

1. Nút Dashboard trong menu `/start` và `/help` dùng `callback_data` thay vì chứa URL token cố định.
2. Callback xác nhận user zalo, phát token mới và cập nhật đúng nút đó thành URL `.../api/access?token=...`.
3. Bot hiển thị hướng dẫn ngắn để người dùng bấm nút vừa được làm mới để mở dashboard. Một lần bấm callback không thể đồng thời mở external URL một cách đáng tin cậy trên mọi zalo client.
4. Thêm test cho keyboard callback và handler phát URL mới; giữ test one-time token hiện có.
5. Cập nhật tài liệu dashboard/zalo, chạy typecheck, lint và test liên quan.

### An toàn

- Không gửi token trong callback data hoặc log.
- Callback chỉ phát link cho `ctx.from.id`; token vẫn còn TTL và one-time use như hiện tại.

### Kết quả triển khai nút Dashboard

- Menu `/start` và `/help` hiện phát callback `action:view_reports`, không tạo token sớm và không nhúng token vào URL button.
- Callback phát token mới, rồi gửi URL one-time mới trong một tin nhắn phản hồi để người dùng mở dashboard.
- Đã cập nhật regression test menu và sửa mock `AuditService` bị thiếu trong check script dashboard.
- Đã kiểm tra thành công: API typecheck, API lint, 9 unit tests của zalo UI, API build, dashboard routing check, `git diff --check`, và agent-system validation.

## Bổ sung: inline edit cho bảng Dashboard

RequestFeedback: true

### Phạm vi dữ liệu

| Bảng                                 | Inline edit                           | Nơi lưu                                |
| ------------------------------------ | ------------------------------------- | -------------------------------------- |
| Liên lạc                             | Tên, biệt danh, mô tả                 | SQLite `debt_contacts`                 |
| Công nợ                              | Hướng, đối tác, số tiền, hạn, ghi chú | SQLite `debts`                         |
| Khoản chi / giao dịch                | Danh mục, ghi chú, số tiền, ngày      | SQLite `finance_transactions`          |
| Lời nhắc                             | Tiêu đề, thời gian, kênh gửi          | SQLite `reminders`                     |
| Google Tasks                         | Tiêu đề, hạn hoàn tất                 | Google Tasks API                       |
| Google Calendar                      | Tiêu đề, thời gian bắt đầu            | Google Calendar API                    |
| Hoạt động gần đây / số liệu tổng hợp | Không chỉnh sửa                       | Audit log và dữ liệu dẫn xuất bất biến |

### Thiết kế

1. Khai báo request/response contract PATCH trong `@zalobot/contracts`, sau đó thêm endpoint có Bearer auth và validation/server-side ownership checks trong Reports API.
2. Bổ sung các mutation service cho SQLite, Google Tasks và Google Calendar; ghi audit cho dữ liệu nội bộ và không cho client sửa audit log.
3. Tạo reusable inline-edit cell trong frontend: idle giống text, hover hiện affordance, click/Enter để sửa, Enter/blur để lưu, Escape để hủy, lỗi hiển thị sát cell và aria-live/focus state đầy đủ.
4. Tạo TanStack Query mutation theo từng domain, optimistic update có rollback và invalidate cả bảng nguồn lẫn dashboard summary sau khi lưu thành công.
5. Gắn cell editor vào Contacts, Debts, Expenses và các bảng Dashboard tương ứng; dashboard chỉ hiển thị input cho các cột được phép sửa.
6. Không cài React Hook Form: các cell là mutation một-trường, không phải form nhiều-field; local state giúp giữ UX Excel-lite và dependency nhỏ hơn.
7. Thêm test API ownership/validation, test UI cell keyboard behavior, typecheck/lint/build web+API và cập nhật tài liệu contract/operating guide.

### Rủi ro và giới hạn

- Sửa Google Tasks/Calendar yêu cầu Google token còn hiệu lực; cell sẽ rollback và hiển thị lỗi nếu token mất hiệu lực hoặc API ngoài từ chối.
- Chỉnh số tiền/hướng công nợ phải duy trì invariant `remainingAmount <= originalAmount`; việc đổi đối tác phải đồng bộ contact relationship.
- Đây là thay đổi API contract, UI và external integration có rủi ro cao; không bao gồm sửa audit log hoặc admin aggregate.
