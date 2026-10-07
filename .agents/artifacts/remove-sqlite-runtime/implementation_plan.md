---
Task: remove-sqlite-runtime
Route: implement
Authority: inspect-and-plan
Risk: high
RequestFeedback: true
Status: completed
---

# Kế hoạch loại bỏ hoàn toàn SQLite

## Mục tiêu

Chuyển hệ thống sang PostgreSQL là cơ sở dữ liệu runtime duy nhất, xóa toàn bộ mã, dependency, volume và tài liệu còn nhắc hoặc hỗ trợ SQLite. Redis vẫn giữ nguyên trong Compose, nhưng không thay đổi hành vi cache trong phạm vi này.

## Điều kiện và tác động dữ liệu

- Anh đã chọn chạy mới từ đầu; vì vậy sẽ **không giữ đường migrate SQLite → PostgreSQL** trong mã nguồn.
- Sau khi xóa Docker volume SQLite trên server, dữ liệu cũ không thể khôi phục nếu không có backup riêng. PostgreSQL sẽ là nguồn dữ liệu duy nhất.
- Triển khai mới cần có `DATABASE_URL` hợp lệ. Khi database PostgreSQL còn trống, dùng `TYPEORM_SYNCHRONIZE=true` đúng một lần để tạo schema, sau đó trả về `false` và deploy lại.

## Phạm vi thay đổi

1. Bắt buộc PostgreSQL trong cấu hình runtime
   - Đổi `database.url` thành bắt buộc trong `apps/api/src/config/configuration.ts`.
   - Bổ sung/điều chỉnh validation để ứng dụng dừng với lỗi rõ ràng nếu thiếu hoặc sai `DATABASE_URL`.
   - Rút gọn `apps/api/src/database/database.module.ts` thành cấu hình TypeORM PostgreSQL duy nhất; xóa nhánh `better-sqlite3`, thao tác tạo thư mục `data/`, và các import phục vụ SQLite.

2. Xóa toàn bộ cơ chế và dependency SQLite
   - Xóa script `apps/api/scripts/migrate-sqlite-to-postgres.cjs`, npm script tương ứng, và lệnh copy script khỏi Dockerfile.
   - Gỡ `better-sqlite3` và `@types/better-sqlite3` khỏi package manifest/lockfile.
   - Xóa migration JSON cũ (`data/users.json`) trong `UsersService`, kèm import, interface và log chỉ phục vụ quá trình chuyển dữ liệu cũ.
   - Đổi các log/comment còn ghi SQLite thành PostgreSQL; cập nhật test của exception filter để xác nhận lỗi unique kiểu PostgreSQL vẫn được trả đúng HTTP response.

3. Loại SQLite khỏi hạ tầng và cấu hình
   - Bỏ volume `zalobot-data` và API mount `/app/data` trong `docker-compose.yml`.
   - Xóa biến mẫu `SQLITE_SOURCE_PATH` và thư mục/file placeholder dữ liệu cũ nếu không còn người dùng nào trong repository.
   - Giữ volumes PostgreSQL và Redis; không động đến dữ liệu của chúng trong source code.

4. Đồng bộ tài liệu vận hành và kiến trúc
   - Viết lại `docs/deployment.md`, `docs/architecture.md`, `docs/google-integration.md`, `docs/zalo-bot.md`, `docs/README.md` sang PostgreSQL.
   - Cập nhật canonical knowledge bằng tiếng Anh tại `.agents/knowledge/global/` và tài liệu developer tiếng Việt tại `.agents/docs/global/`, bao gồm exception filter và kiến trúc monorepo; cập nhật index `.agents/docs/README.md` nếu mục lục bị ảnh hưởng.
   - Nêu rõ quy trình Coolify: dùng các volume PostgreSQL/Redis, không còn volume SQLite, và bootstrap schema an toàn cho database trống.

## Kiểm chứng sau khi thực hiện

1. Cài dependency lockfile sạch và chạy toàn bộ API tests, typecheck, lint check, build.
2. Kiểm tra `docker compose config` để bảo đảm không còn `zalobot-data`, `/app/data`, hoặc biến SQLite.
3. Tìm toàn repository các chuỗi `sqlite`, `better-sqlite`, `zalobot.sqlite`, `users.json`; chỉ chấp nhận các ghi chú lịch sử tối thiểu nếu thực sự cần, còn lại phải bằng 0.
4. Khởi động stack với PostgreSQL trống và `TYPEORM_SYNCHRONIZE=true`; xác minh API tạo schema và seed admin, rồi chuyển về `false` để kiểm tra khởi động lại ổn định.

## Rủi ro và phương án quay lại

- Rủi ro chính là một deploy thiếu `DATABASE_URL` hoặc PostgreSQL chưa bootstrap sẽ dừng ngay thay vì tự tạo SQLite. Điều này là chủ đích để tránh phát sinh dữ liệu sai nơi.
- Có thể quay lại code bằng commit trước đó, nhưng **không thể khôi phục dữ liệu SQLite đã xóa** nếu không có backup. Vì anh đã chọn khởi tạo mới, em sẽ không giữ fallback SQLite trong bản cuối.

## Tiêu chí hoàn thành

- Không còn runtime path, dependency, Docker volume/mount, script hay tài liệu vận hành nào yêu cầu SQLite.
- API chỉ kết nối PostgreSQL và fail-fast khi cấu hình database không hợp lệ.
- Stack Docker/Coolify khởi tạo được database PostgreSQL trống theo tài liệu và toàn bộ kiểm chứng nêu trên đều đạt.

## Kết quả thực hiện

- Đã xóa SQLite runtime, migration script, dữ liệu mẫu, Docker volume/mount, dependency trực tiếp và chuyển cấu hình sang PostgreSQL bắt buộc.
- Đã xóa chuyển đổi `users.json`, đồng thời cập nhật log, kiểm thử constraint và toàn bộ tài liệu vận hành/kiến trúc bị ảnh hưởng.
- Đã kiểm chứng: API tests 49/49, typecheck, lint check, build, Docker Compose config và `git diff --check`.
