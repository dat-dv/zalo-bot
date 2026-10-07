# Kế hoạch triển khai i18n toàn zalobot

RequestFeedback: true

## Mục tiêu và quyết định áp dụng

Triển khai song ngữ `vi` (mặc định) và `en` cho toàn bộ bề mặt người dùng: dashboard Next.js, zalo command/menu/inline keyboard, phản hồi nghiệp vụ, Gemini prompt và notification reminder.

Quyết định kỹ thuật:

- Dashboard dùng `next-intl` với locale theo **cookie** (không thay route) để giữ nguyên đường dẫn report/deep link zalo và tương thích static export hiện có.
- Backend dùng một i18n module runtime độc lập, đọc catalog dùng chung trong `packages/contracts`; không kéo runtime Next.js vào NestJS.
- Locale mặc định/fallback là `vi`; chỉ nhận `vi` và `en`.
- Cột `preferredLocale` được thêm vào user SQLite. Vì TypeORM đang `synchronize: true`, cột mới được tạo lúc API khởi động; giá trị cũ tự mặc định `vi`.
- Nội dung do người dùng cung cấp (tên, ghi chú, title reminder…) không dịch. Locale chỉ chi phối câu hệ thống và format số/ngày.

## Thay đổi theo lớp

### 1. Hợp đồng dùng chung và catalog

- Thêm loại `SupportedLocale`, default locale, validation/normalization và mapping locale định dạng (`vi-VN`, `en-US`) trong `packages/contracts`.
- Thêm message catalog có namespace ổn định: `common`, `web`, `zalo`, `reminder`, `gemini`, `errors`; tạo bản `vi` và `en` cùng key.
- Cung cấp resolver xử lý interpolation kiểu `{name}`, plural và fallback; không để frontend/bot dùng literal text mới.
- Viết test catalog: cùng key ở `vi`/`en`, interpolation không làm lộ placeholder, locale lạ quay về `vi`.

### 2. Locale người dùng và API/backend boundary

- Thêm `preferredLocale` vào `UserEntity`, cùng API trong `UsersService` để đọc/cập nhật locale và bảo toàn `vi` cho user cũ/new user.
- Mở một lệnh/nút chọn ngôn ngữ zalo; callback chỉ mang mã locale đã allow-list. Sau khi đổi, sync command menu bằng ngôn ngữ tương ứng.
- Truyền `locale` vào `ToolExecutionContext`, pending confirmation và Gemini chat/confirm execution để cùng một interaction dùng nhất quán một ngôn ngữ.
- Chuẩn hóa lỗi nghiệp vụ trả về bot thành error code hoặc message key tại ranh giới service/tool; không render `Error.message` của infrastructure cho người dùng.

### 3. zalo, Gemini và reminder

- Chuyển `zalo-menu.catalog.ts`, `zaloUiService` và tất cả button/confirmation/result message trong `zaloUpdate` sang resolver theo locale.
- Chuyển các câu kết quả/error do Gemini tools trả về, prompt hệ thống/OCR/tool declaration description và ví dụ hướng dẫn sang catalog/prompt theo locale. Giữ nguyên tool name, payload schema và callback data.
- Cập nhật `ReminderSchedulerService`: lấy locale của reminder owner trước khi gửi, format thời gian với locale đang chọn nhưng tiếp tục dùng time zone `Asia/Ho_Chi_Minh`; dịch header và action buttons.
- Cập nhật các service Google/finance và handler zalo còn trả câu tiếng Việt trực tiếp theo cùng adapter; log kỹ thuật vẫn giữ nguyên, không đưa vào catalog.

### 4. Dashboard web

- Cài `next-intl`; thêm provider/request config tương thích client-only/static export và đồng bộ `html[lang]`, metadata, aria-label, document title với locale cookie.
- Thêm locale switcher ở navigation; lựa chọn được lưu cookie (và đồng bộ `preferredLocale` khi có dashboard access token) để mở lại từ link zalo vẫn đúng ngôn ngữ.
- Tách formatter chung `formatMoney`/`formatDate` nhận locale, thay toàn bộ `Intl.*('vi-VN')` ở dashboard, contacts, debts, expenses.
- Chuyển toàn bộ JSX hard-code trong 6 tệp giao diện đã liệt kê, gồm loading/error/empty, bảng, navigation, tooltip, metadata, sang message key typed.
- Giữ route report và API contracts không đổi; không đưa locale vào API URL/path.

### 5. Bảo đảm chất lượng và tài liệu

- Bổ sung test unit cho resolver, locale persistence, zalo menu/reminder message ở cả `vi`/`en`, và formatter dashboard.
- Thêm kiểm tra tĩnh để phát hiện string UI hard-code mới tại web/zalo (cho phép log kỹ thuật, route, enum, test fixture và user-provided value).
- Chạy `npm run typecheck`, `npm run lint`, `npm run build`, test API/web liên quan; smoke test desktop/mobile cho `vi` và `en`, luồng đổi ngôn ngữ, deep link dashboard, confirmation và scheduled reminder.
- Cập nhật canonical knowledge tiếng Anh và hướng dẫn vận hành tiếng Việt cho các module `auth`, `dashboard`, `contacts`, `debts`, `expenses`, cùng tài liệu global/API zalo; cập nhật `.agents/docs/README.md` mapping.

## Files/phạm vi dự kiến

- Sửa: `apps/web/app`, `apps/web/src/shared`, các view module dashboard/contacts/debts/expenses, `apps/api/src/users`, `apps/api/src/zalo`, `apps/api/src/gemini`, `apps/api/src/reminders`, các backend service có user-facing message, `packages/contracts`.
- Thêm: runtime/catalog i18n, frontend provider/formatter/switcher, test và tài liệu module/global tương ứng.
- Không đổi: schema tool name, callback protocol, route report, dữ liệu nghiệp vụ do user nhập, time zone mặc định.

## Rủi ro và cách giảm thiểu

| Rủi ro                                                | Giảm thiểu                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| Prompt tiếng Anh làm Gemini gọi tool khác             | Test cùng intent `vi`/`en`, giữ declaration/schema invariant     |
| Locale không nhất quán trong job nền                  | Resolve `preferredLocale` theo user ngay trước send              |
| Static export không hỗ trợ locale routing/server i18n | Cookie-provider client-only; không đổi route                     |
| UI tiếng Anh dài hơn                                  | Smoke test viewport desktop/mobile, giữ toolbar/table responsive |
| Dịch lỗi infrastructure khó kiểm soát                 | Map error code/message key ở service boundary, fallback an toàn  |

## Tiêu chí nghiệm thu

1. Người dùng đổi được `vi`/`en` từ dashboard và zalo; lựa chọn được lưu và dùng cho các reply/reminder sau đó.
2. Dashboard không còn chuỗi UI tiếng Việt hard-code hoặc formatter locale cố định.
3. zalo menu, inline keyboards, confirmation/result/error phổ biến và reminder hiển thị đúng locale.
4. Fallback `vi` hoạt động nếu thiếu/invalid locale; callback/tool/API contract không bị thay đổi.
5. Catalog, typecheck, lint, build và test liên quan đều pass; tài liệu kiến trúc/vận hành đã đồng bộ.
