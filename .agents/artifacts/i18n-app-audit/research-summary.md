# Rà soát i18n toàn ứng dụng

## Mục tiêu

Xác định phạm vi chuỗi hiển thị và các điểm phụ thuộc locale trước khi triển khai i18n cho zalobot.

## Bằng chứng trong repository

- `apps/web` là Next.js 16 App Router, hiện không cài hoặc cấu hình thư viện i18n.
- Thẻ gốc cố định `lang="vi"`; metadata cũng có tiếng Việt.
- Dashboard có chuỗi giao diện trực tiếp trong 6 tệp:
  - `app/layout.tsx`
  - `src/shared/ui/reports-navigation.tsx`
  - `src/modules/dashboard/view/dashboard-screen.tsx`
  - `src/modules/contacts/view/contacts-screen.tsx`
  - `src/modules/debts/view/debts-screen.tsx`
  - `src/modules/expenses/view/expenses-screen.tsx`
- Có ít nhất 119 dòng chứa tiếng Việt ở `apps/web/src` và 1 dòng ở `apps/web/app`.
- Các formatter web đang cố định `vi-VN` trong dashboard, contacts, debts và expenses.
- `apps/api/src` có khoảng 570 dòng tiếng Việt trong 42 tệp. Chúng bao gồm phản hồi Gemini tool, menu/nút zalo, lỗi, hướng dẫn OAuth và lời nhắc. Đây là một delivery channel khác với dashboard web.
- Các locale backend hiện cố định gồm `vi-VN`, `vi`, và trong vài tác vụ nội bộ là `en-US`.

## Phân chia phạm vi

| Kênh              | Tình trạng                                                        | Cách i18n phù hợp                                                                                    |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Web dashboard     | Chuỗi JSX/metadata/aria-label và formatter cố định                | Locale theo URL/cookie; provider/hook dịch ở client; formatter dùng locale đang chọn                 |
| zalo bot          | Chuỗi nghiệp vụ do update handler, UI service và Gemini tools tạo | Resolve locale theo từng zalo user; dịch ở service/tool boundary, không nhận locale từ message tự do |
| Nội dung Gemini   | Prompt/tool descriptions/mẫu hướng dẫn hiện bằng tiếng Việt       | Tách prompt theo locale và truyền locale vào context; giữ schema/tool name bất biến                  |
| Dữ liệu nghiệp vụ | Tên người, nội dung giao dịch/lời nhắc do người dùng nhập         | Không dịch; chỉ format ngày, tiền, trạng thái và nhãn UI                                             |

## Khuyến nghị kiến trúc

1. Chọn `vi` làm default/fallback và thêm `en` trước; dùng mã locale ngắn cho catalog, ánh xạ sang `vi-VN`/`en-US` khi format số và ngày.
2. Với web Next.js, ưu tiên `next-intl`: routing locale, metadata, server/client messages và type-safe key. Cần quyết định URL theo locale (`/vi/reports`, `/en/reports`) hoặc locale cookie không đổi URL. URL locale là lựa chọn tốt hơn cho deep link và SSR metadata; cookie-only ít thay đổi route hơn cho dashboard mở từ zalo.
3. Đặt catalog theo domain (ví dụ `navigation`, `dashboard`, `contacts`, `debts`, `expenses`, `common`) thay vì một file phẳng. Dùng ICU message cho chuỗi có biến/thời gian.
4. Tạo package i18n dùng chung hoặc module backend riêng cho zalo/API. Không nên cố dùng `next-intl` trong NestJS vì runtime và luồng xác định locale khác nhau; có thể dùng catalog JSON cùng shape với adapter runtime độc lập.
5. Bổ sung `preferredLocale` vào user profile/database và dùng nó khi gửi zalo reply/reminder hoặc sinh link dashboard. Chỉ có ngôn ngữ được hỗ trợ mới được lưu.
6. Di chuyển mọi `Intl.NumberFormat('vi-VN')` và `Intl.DateTimeFormat('vi-VN')` sang formatter nhận locale/time zone. Time zone nghiệp vụ `Asia/Ho_Chi_Minh` giữ riêng khỏi locale.
7. Không dịch API contract, enum nội bộ, route path, tool name, mã lỗi kỹ thuật hay dữ liệu do người dùng nhập. API client nhận mã lỗi ổn định, còn presentation/bot map mã đó sang câu dịch.

## Rủi ro cần xử lý

- Dịch trực tiếp các `error.message` từ backend sẽ làm UI lệ thuộc vào ngôn ngữ server. Cần error code ổn định hoặc fallback trung tính.
- zalo jobs/lời nhắc chạy nền phải resolve locale của người dùng tại thời điểm gửi, không dựa vào locale của request trước đó.
- Dịch Gemini prompt có thể làm đổi hành vi gọi tool; cần test theo từng locale với cùng intent.
- Ngôn ngữ dài hơn có thể làm vỡ toolbar/dashboard data-dense; cần smoke test `vi` và `en` ở desktop/mobile.

## Đề xuất thứ tự thực hiện

1. Xác nhận phạm vi phát hành đầu tiên: chỉ dashboard web, hay cả zalo/Gemini/reminder.
2. Xác nhận URL locale hay cookie-only cho dashboard; xác nhận danh sách locale v1 (đề xuất `vi`, `en`).
3. Tạo nền i18n, catalog tiếng Việt chuẩn và tiếng Anh; chuyển toàn bộ 6 tệp dashboard cùng metadata và formatter.
4. Thêm lưu/chọn locale trong zalo, chuyển menu/reply/reminder và Gemini tool output theo từng module.
5. Bổ sung kiểm tra không còn text UI hard-code, test locale fallback, format số/ngày, deep link và luồng zalo job.

## Kết luận

Có thể i18n toàn bộ app. Nếu chỉ tính web dashboard, phạm vi hiện tại tương đối gọn. Nếu tính cả zalo bot và phản hồi Gemini, đây là một migration cross-channel cần tách thành các đợt nhưng có thể dùng chung catalog và chuẩn locale.
