---
RequestFeedback: true
Route: implement
Authority: inspect-and-plan
Risk: high
Status: in-progress
---

# Kế hoạch hoàn tất nâng cấp độ tin cậy zalo Bot

## Quyết định kiến trúc đề xuất

Chuyển hệ thống từ SQLite đơn tiến trình sang **PostgreSQL làm system of record** và **Redis làm shared ephemeral state**.

| Nhu cầu                                | Hiện trạng                            | Đích đến                                                                      |
| -------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| Dữ liệu nghiệp vụ                      | SQLite volume với `synchronize: true` | PostgreSQL + TypeORM migrations                                               |
| Xác nhận AI, transcript voice, history | `Map` trong RAM                       | Redis, TTL rõ ràng, user-bound                                                |
| Cooldown/rate limit                    | `Map` trong RAM; admin bypass         | Redis atomic counter/window, policy theo loại request                         |
| Idempotency thao tác thay đổi dữ liệu  | Chưa có durable key                   | PostgreSQL idempotency ledger + transaction                                   |
| Polling                                | Một instance, retry cố định           | Chỉ leader poll zalo; backoff+jitter; instance khác vẫn phục vụ HTTP/outbound |
| Quan sát                               | Log rời rạc                           | `/api/health`, readiness, metrics nền tảng và correlation ID                  |

**Lý do không chọn SQLite làm giải pháp cuối:** SQLite có thể lưu lại state qua restart trong một container, nhưng không đảm bảo vận hành nhiều API instance với write concurrency, distributed cooldown hoặc leader election. Duy trì `synchronize: true` cũng không phù hợp để kiểm soát migration production.

## Phạm vi

### Đợt 2A — Nền dữ liệu bền vững

1. Thêm Postgres và Redis vào Docker Compose; bổ sung ENV validation, `.env.example`, tài liệu deploy/backup/rollback.
2. Cấu hình TypeORM qua PostgreSQL; tắt `synchronize` ở production; thiết lập migrations có version.
3. Viết migration dữ liệu SQLite hiện có sang Postgres theo thứ tự foreign-key và có báo cáo số lượng bản ghi/mismatch.
4. Tạo entity/repository cho:
   - `pending_actions`: ID, user ID, tool, encrypted payload, reference ID, trạng thái `pending|executing|completed|cancelled|expired`, TTL, idempotency key;
   - `idempotency_records`: scope user/tool/key, request fingerprint, kết quả cuối cùng, TTL;
   - các state ngắn hạn còn lại ở Redis: conversation history và transcript voice (TTL 10 phút).
5. Thay các `Map` trong Gemini, VoiceTranscriptionService và UsersService bằng store interfaces; Redis implementation là mặc định, test implementation in-memory là test-only.
6. Làm confirmation atomic: chỉ transition `pending -> executing` một lần; xác nhận lại trả cùng kết quả/“đang xử lý”, không chạy tool lần hai.
7. Làm redemption invite atomic bằng update có điều kiện/transaction, để một mã chỉ được dùng một lần khi có request đồng thời.

### Đợt 2B — Bảo vệ tải và AI

1. Rate policy Redis: phân biệt callback nhẹ, chat AI, OCR, voice; giới hạn theo user và theo toàn bot; không bypass hoàn toàn cho admin.
2. Hàng đợi/bulkhead cho Gemini, OCR và Whisper để giới hạn số tác vụ nặng đồng thời; timeout, retry có backoff và lỗi thân thiện.
3. Thêm idempotency key vào mọi tool thay đổi dữ liệu: calendar, tasks, reminders, finance, debt, invite và moderation.
4. Thêm audit events có correlation ID, loại thao tác và outcome; tuyệt đối không log token, OAuth code, payload tài chính đầy đủ hoặc transcript.

### Đợt 3 — Vận hành đa instance

1. Thay retry polling cố định bằng exponential backoff có jitter và phân loại lỗi retryable/non-retryable.
2. Redis leader lease cho zalo long polling: chỉ instance giữ lease được poll; mất lease thì dừng polling sạch; các instance khác vẫn phục vụ REST/OAuth/outbound.
3. Thêm liveness `/api/health/live`, readiness `/api/health/ready` (Postgres, Redis, zalo lease), và endpoint status nội bộ đã được bảo vệ.
4. Thêm zalometry cấu trúc: request/correlation ID, latency, lỗi dependency, queue depth, rate-limit rejections, polling lease state.
5. Chuẩn hóa runbook deploy theo rolling update, backup/restore Postgres, Redis availability, single-bot-token incident và rollback migration.

### Đợt 4 — Tách module và trải nghiệm

1. Tách `zaloUpdate` thành command/query/callback use cases, giữ decorator lớp mỏng.
2. Đưa quy tắc confirmation và authorization vào service dùng chung thay vì phân tán ở callback handlers.
3. Tách Google authorization policy theo capability: finance, debt và reminders nội bộ không bị chặn chỉ vì chưa kết nối Google; calendar/tasks vẫn yêu cầu Google. Đây là **thay đổi trải nghiệm nghiệp vụ** cần test contract và nội dung hướng dẫn mới.
4. Tạo knowledge/docs mô-đun zalo chính thức, đồng bộ danh mục docs/knowledge và runbook vận hành.

## Tệp/khu vực dự kiến thay đổi

- `docker-compose.yml`, `apps/api/Dockerfile`, `.env.example`/tài liệu môi trường.
- `apps/api/src/config/*`, `apps/api/src/database/*`, entities/migrations/repositories mới.
- `apps/api/src/gemini/*`, `apps/api/src/zalo/*`, `apps/api/src/users/*`, `apps/api/src/main.ts`.
- `apps/api/src/common/*` cho health, correlation và observability abstractions.
- Test API unit/integration và test lifecycle deploy/migration có fixture.
- `docs/`, `.agents/knowledge/`, `.agents/docs/` và artifact bàn giao.

## Chuỗi triển khai an toàn

1. Đưa Postgres/Redis lên staging, thêm health checks và snapshot SQLite trước migration.
2. Thử migration copy-only, đối chiếu count/checksum, sau đó chạy smoke test bot với polling tắt.
3. Cutover dữ liệu trong maintenance window: dừng writer, migration delta cuối, bật API một instance với Redis/Postgres, chạy smoke test callback/idempotency.
4. Sau khi ổn định mới bật leader-election cho deployment nhiều instance.
5. Cuối cùng tách handler và thay đổi policy Google theo rollout feature flag.

## Kiểm thử bắt buộc

- Unit: state TTL, ownership, cancel/confirm race, idempotency replay, rate policy và backoff.
- Integration: Postgres migrations, atomic invite redemption, concurrent confirmation chỉ gọi tool một lần, Redis outage/degraded behavior.
- E2E staging: restart giữa lúc chờ xác nhận, hai instance API, failover lease, duplicate zalo update.
- Quality gates: `npm run test --workspace @zalobot/api`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run agent-system:validate`.

## Rollback

- Giữ SQLite snapshot read-only ít nhất một release window; migration không xóa dữ liệu nguồn.
- Feature flags tách DB backend, Redis state, leader polling và Google capability policy để có thể rollback theo từng lớp.
- Không rollback schema bằng `synchronize`; rollback bằng migration có kiểm thử hoặc restore snapshot có xác nhận.

## Rủi ro và giả định

- Đây là thay đổi hạ tầng và dữ liệu lớn; cần cửa sổ bảo trì khi cutover production.
- Cần nơi chạy Postgres và Redis có backup, secret management và monitoring. Docker Compose chỉ phù hợp local/single-host; production cần managed services hoặc hạ tầng tương đương.
- Em giả định anh chấp thuận Postgres + Redis, không phải “chữa cháy” bằng SQLite. Nếu anh muốn chỉ triển khai single-instance, phạm vi có thể thu hẹp đáng kể nhưng sẽ không giải quyết scale ngang.

## Cần phê duyệt

Anh xác nhận giúp em lựa chọn **PostgreSQL + Redis** và phạm vi bốn đợt trên. Sau khi duyệt, em sẽ thực hiện tuần tự từ Đợt 2A, bắt đầu bằng migration có thể rollback và không cắt traffic trực tiếp.

## Tiến độ Đợt 2A

- Đã thêm PostgreSQL client (`pg`) và Redis client (`ioredis`) vào API; chưa thực hiện nâng cấp dependency ngoài hai package này.
- Đã thêm PostgreSQL và Redis (persistent volumes, health checks) vào Docker Compose; API chỉ dùng Postgres khi có `DATABASE_URL` và production không tự schema-sync.
- Đã chuyển các cột ngày giờ explicit từ SQLite-only `datetime` sang `Date` portable giữa SQLite/PostgreSQL.
- Đã thêm `database:migrate-sqlite`: migration copy một chiều từ snapshot SQLite sang Postgres, từ chối target không rỗng, chỉ tạo schema đích khi có opt-in `MIGRATION_CREATE_SCHEMA=true`.
- Đã cập nhật `.env.example` và deployment runbook. Không migration data, không bật Postgres ở môi trường đang chạy và không cắt traffic.
- Xác minh phần API: typecheck, lint và format check đều pass.

## Điều kiện trước khi cutover

1. Có `POSTGRES_PASSWORD` production và backup snapshot `data/zalobot.sqlite`.
2. Chạy migration khi API writer đã dừng, sau đó đối chiếu số bản ghi.
3. Chỉ sau khi xác minh mới cấu hình `DATABASE_URL`/`REDIS_URL`, khởi động lại API và chuyển tiếp các hạng mục Redis state/confirmation atomic.
