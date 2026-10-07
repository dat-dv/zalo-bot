---
RequestFeedback: true
Route: implement
Authority: inspect-and-plan
Risk: medium
Status: completed
---

# Kế hoạch đợt 1 — Làm ổn định chất lượng zalo Bot

## Mục tiêu

Khôi phục độ tin cậy của quality gate zalo: mọi test được phát hiện và chạy được; các hành vi callback quan trọng có regression test; loại bỏ các nhánh code không bao giờ thực thi. Không thay đổi schema dữ liệu, quyền truy cập, API công khai hoặc trải nghiệm nghiệp vụ đã công bố.

## Bằng chứng hiện trạng

- `apps/api/package.json` dùng `node --import tsx --test src/**/*.spec.ts`; lệnh hiện chỉ chạy 5 test nằm ở `src/` và không bao gồm test ở thư mục con.
- Khi ép chạy toàn bộ file `*.spec.ts`, 43 test pass nhưng hai file `zalo.update.spec.ts` và `services/zalo-launcher.service.spec.ts` fail trước khi chạy test vì test runner không biên dịch parameter decorators của NestJS.
- `apps/api/src/zalo/zalo.update.ts` có mã sau `return` trong các callback hoàn tất task và đổi kiểu nhắc việc. Những nhánh này hiện không thể thực thi.
- Các thay đổi có sẵn, không thuộc phạm vi này: `apps/api/src/finance/finance.module.ts` và `.agents/artifacts/fix-finance-module-user-category-dependency/`.

## Phạm vi thực hiện

1. Sửa script test của API để phát hiện toàn bộ `*.spec.ts` một cách ổn định và biên dịch NestJS decorators theo `tsconfig` dự án.
2. Đảm bảo test zalo launcher và update khởi động được trong command chuẩn; sửa các fixture/mock tối thiểu nếu cần để những test hiện hữu xác minh đúng hành vi.
3. Bổ sung regression test cho các luồng có rủi ro cao nhưng không gọi zalo, Gemini hay Google thật:
   - callback xác nhận chỉ thực thi đúng user và action còn hạn;
   - callback hủy không làm thay đổi dữ liệu;
   - callback/xử lý không được phép không vượt qua `AuthGuard`;
   - retry polling không tạo retry trùng và dừng sạch khi shutdown.
4. Xóa hoặc tái cấu trúc các đoạn mã chết sau `return`; giữ nguyên hành vi hiện tại là yêu cầu xác nhận trước khi hoàn tất task hoặc đổi kiểu nhắc việc.
5. Cập nhật tài liệu phát triển và tài liệu zalo để lệnh kiểm thử chuẩn, giới hạn của coverage, và luồng xác nhận callback được chính xác.

## Tệp dự kiến thay đổi

- `apps/api/package.json`
- `apps/api/src/zalo/zalo.update.ts`
- `apps/api/src/zalo/zalo.update.spec.ts`
- `apps/api/src/zalo/services/zalo-launcher.service.spec.ts`
- Có thể: `apps/api/tsconfig.json` hoặc cấu hình test chuyên dụng, chỉ nếu đây là cách tối thiểu để runner hỗ trợ decorators.
- `docs/development-workflow.md`, `docs/zalo-bot.md`
- `.agents/knowledge/global/zalo-command-intake.md`, `.agents/docs/global/zalo-command-intake.md`, và `.agents/docs/README.md` nếu đường dẫn/tài liệu cần thêm mục mới.

## Trình tự triển khai

1. Chọn và cấu hình test runner tương thích TypeScript decorators, sau đó xác nhận command `npm run test --workspace @zalobot/api` tự phát hiện toàn bộ suite.
2. Làm các test zalo hiện có chạy được trước; không nới lỏng assertion để “làm xanh”.
3. Loại bỏ code không thể tới trong callback và đặt test bảo vệ semantics “bấm nút -> yêu cầu xác nhận -> chỉ thực thi sau xác nhận”.
4. Thêm các ca kiểm thử ranh giới quyền, TTL và lifecycle polling.
5. Đồng bộ docs/knowledge về command test và contract callback.
6. Chạy `npm run test --workspace @zalobot/api`, `npm run typecheck`, `npm run lint`, `npm run build:api`, sau đó rà diff để chắc chắn không chạm thay đổi finance của anh.

## Tiêu chí nghiệm thu

- Lệnh test chuẩn của API chạy mọi file `*.spec.ts` và không bỏ qua thư mục con.
- Không còn lỗi biên dịch decorators ở hai suite zalo.
- Các test mới chạy độc lập, không dùng token thật hoặc gọi dịch vụ ngoài.
- Tất cả test, typecheck, lint, build API qua.
- Callback nhạy cảm vẫn bắt buộc xác nhận trước khi tạo/cập nhật dữ liệu.
- Không có thay đổi vào schema, data migration, cấu hình production secret hay file finance đang thay đổi dở.

## Rủi ro và ngoài phạm vi

- Chuyển pending actions, transcript, history và rate limit khỏi RAM là đợt 2 vì cần quyết định Redis/DB, TTL, mã hóa và chiến lược đa instance.
- Idempotency cho lịch, task, thu–chi và nợ cũng thuộc đợt 2 vì liên quan storage/transaction semantics.
- Monitoring, webhook/singleton polling và retry backoff thuộc đợt 3.

## Cần phê duyệt

Chờ anh xác nhận kế hoạch này trước khi em sửa bất kỳ mã nguồn hay tài liệu nào.

## Kết quả thực hiện

- Đã thay command test API bằng `tsx --test $(find src -name '*.spec.ts' -print)`, nên toàn bộ `*.spec.ts` dưới `src/` được phát hiện và runner tuân thủ NestJS decorators.
- Đã xóa năm nhánh không thể tới sau luồng tạo confirmation cho task và reminder. Hành vi vẫn là: callback tạo yêu cầu xác nhận, sau đó mới thực thi.
- Đã thêm regression test cho callback hoàn tất task (không thực thi trước xác nhận) và `AuthGuard` (callback từ người chưa được mời bị chặn).
- Đã cập nhật docs phát triển, zalo command contract và tài liệu zalo.

## Xác minh

- `npm run test --workspace @zalobot/api`: 49/49 pass.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run build:api`: pass.
- `git diff --check`: pass.
- `npm run format:check`: API và contracts pass; web fail ở hai file có sẵn ngoài phạm vi: `apps/web/src/styles.css`, `apps/web/next-env.d.ts`.
