---
RequestFeedback: true
Route: implement
Authority: inspect-and-plan
Risk: medium
---

# Kế hoạch: env guard, loại bỏ fallback cấu hình

## Mục tiêu

Buộc ứng dụng dừng sớm với lỗi rõ ràng khi thiếu hoặc sai biến môi trường đã được coi là bắt buộc; không tự dùng địa chỉ, cổng, secret, giới hạn, hay API URL mặc định để che lỗi triển khai.

## Phạm vi đã xác nhận

- API: `apps/api/src/config/configuration.ts`, `env.validator.ts`, `main.ts`, và các service đang truyền default vào `ConfigService` hoặc đọc lại `process.env`.
- Dashboard: `apps/web/next.config.ts` và `apps/web/src/shared/api/http-client.ts`.
- Đồng bộ template `.env.example` cùng tài liệu global tiếng Anh/Vietnamese và các index liên quan.
- Không sửa các fallback nghiệp vụ/UX không thuộc cấu hình môi trường.

## Hiện trạng

1. `env.validator.ts` mới kiểm tra zalo bot, admin, Gemini, mã hóa và Google OAuth; nhiều cấu hình còn lại vẫn có giá trị mặc định.
2. `configuration.ts` gán fallback cho URL, port, CORS, model Gemini, Whisper, OCR, timezone, Google credential path và các giới hạn xử lý.
3. `main.ts`, zalo/voice/OCR/Google services tiếp tục gán default tại điểm tiêu thụ; `zaloCallerService` và `UsersService` bỏ qua cấu hình tập trung để đọc lại `process.env`.
4. Dashboard tự đổi sang `http://localhost:3000` hoặc base URL rỗng khi thiếu `NEXT_PUBLIC_API_URL`, có thể làm build/deploy sai mà không báo lỗi.

## Cách thực hiện đề xuất

1. Tập trung định nghĩa schema env API: danh sách key bắt buộc, quy tắc trim, kiểu số/boolean và ràng buộc giá trị; validation chạy trước khi Nest khởi tạo và thông báo chính xác key lỗi.
2. Chỉ giữ các biến thật sự tuỳ chọn theo feature (ví dụ GramJS flash-call); mọi giá trị được ứng dụng sử dụng sẽ phải có trong env và được parse một lần tại `configuration.ts`. Loại bỏ fallback ở config factory và ở các `ConfigService.get` tiêu thụ.
3. Thay các lần đọc thẳng `process.env` sau bootstrap bằng `ConfigService`, để guard là cổng vào duy nhất cho runtime configuration.
4. Thêm guard phía Next.js cho `NEXT_PUBLIC_API_URL`: lỗi build/start rõ ràng khi thiếu hoặc URL không hợp lệ; `http-client` chỉ dùng giá trị đã được guard, không tự chuyển endpoint.
5. Cập nhật `.env.example` thành danh sách đầy đủ, có giá trị placeholder an toàn cho toàn bộ key bắt buộc, và nêu rõ các key tuỳ chọn.
6. Bổ sung unit test cho parser/guard (thiếu key, số/boolean/URL không hợp lệ, nhánh optional) và chạy `npm run typecheck`, `npm run lint`, cùng test liên quan.
7. Đồng bộ `.agents/knowledge/global/` (English), `.agents/docs/global/` (Vietnamese), và cả hai README index về hợp đồng fail-fast mới.

## Rủi ro và quyết định

- Đây là thay đổi nhiều file, tác động khởi động API và build dashboard nên xếp mức **medium**.
- Runtime/deployment đang thiếu bất kỳ key nào trước đây được default sẽ bắt đầu fail-fast. Đây là hành vi chủ đích để phát hiện cấu hình sai sớm.
- Không đọc hoặc in giá trị secret trong error/log/test.

## Tiêu chí hoàn thành

- Không còn fallback ENV trong các đường khởi tạo/tiêu thụ cấu hình đã kiểm kê.
- API và dashboard báo đúng key/định dạng cấu hình khi không hợp lệ.
- `.env.example` đầy đủ, không có secret thật.
- Typecheck, lint và test liên quan chạy đạt; tài liệu global đã đồng bộ.
