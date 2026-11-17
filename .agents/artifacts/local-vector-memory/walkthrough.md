# Walkthrough: Trí nhớ dài hạn bằng pgvector + MiniLM local (bỏ Cognee)

- Nhánh: `feat/local-vector-memory` (worktree `../zalo-bot-worktrees/local-vector-memory`), chưa commit.
- Plan: [implementation_plan.md](implementation_plan.md), anh Đạt duyệt D1–D5 theo mặc định (17/11/2026).

## Đã làm

### API
- `LocalEmbedder` (`zca/memory/long-term/local-embedder.ts`): transformers.js 4.3.2, `Xenova/paraphrase-multilingual-MiniLM-L12-v2` q8, 384 chiều. Nạp lười (lazy), lỗi thì thử lại sau 10 phút, không bao giờ throw.
- `buildEmbeddingText`: tin trước, sau đó tối đa 2 tin liền trước (trong vòng 10 phút) làm ngữ cảnh.
- `MemoryEmbeddingService` + `MemoryEmbeddingScheduler` + `MemoryEmbeddingProcessor`:
  - queue `chat-memory`, các job `nightly`, `embed`, `sync`; job `segment` cũ còn sót được xử lý như `embed`;
  - hẹn giờ 20 giây (chậm nhất 2 phút) sau mỗi thay đổi của kênh;
  - quét bù sau khi boot 1 phút và lúc 03:00.
- `ChatMemoryService`:
  - `onChange` để báo kênh có thay đổi;
  - `search` chạy song song tìm theo từ khoá và theo ý nghĩa, gộp bằng RRF;
  - thu hồi tin và cập nhật chữ trong ảnh thì xoá embedding của tin đó và các tin trong 10 phút sau nó.
- `chat-memory.query.ts`: thêm `hitConditions` dùng chung, `buildVectorHitQuery` (cosine < 0,6) và `mergeRankedIds`.
- Migration `1725040000000-AddMessageEmbeddings`: extension `vector`, bảng `zca_message_embeddings`; drop `zca_memory_segments` và `zca_memory_ingestions`.
- `/sync`: không còn kiểm tra Cognee, trả kết quả "Đã cập nhật trí nhớ: N tin mới."
- Gỡ:
  - `CogneeClient`, phần nạp theo đoạn và theo ngày;
  - `LlmProxyModule` (cổng `/api/internal/llm`);
  - prompt tự học, `LearnedFactsService.replaceForSubject/deletedFor`;
  - config và validator `COGNEE_*`;
  - route `internalLlmChatCompletions`.
- `IChannelMemoryStatus` đổi thành `{ embedder, embeddedMessages, pendingMessages, lastEmbeddedAt }`.

### Web
- Thẻ "Nhớ lâu dài":
  - viết lại phần mô tả;
  - thêm dòng trạng thái "Đã nhớ N tin…";
  - bỏ công tắc tự học;
  - đổi tên mục thành "Điều bot đã học trước đây" và ẩn khi không có gì.

### Hạ tầng
- `docker/postgres/Dockerfile`: `postgres:16-alpine` + pgvector 0.8.1 build từ source. Collation giữ nguyên nên không phải REINDEX.
- API Dockerfile:
  - các stage prod-deps, builder, runner chuyển sang `node:22-bookworm-slim`;
  - thêm stage `embedding-model` để nhúng model vào `/app/models` (`EMBEDDING_MODEL_DIR`).
- Compose:
  - bỏ `cognee`, `cognee-ui`, volume `zalobot-cognee`, `COGNEE_URL`, port 8081;
  - postgres build từ image tự dựng (cả file local).
- Web nginx: bỏ `/api/internal/` và phần include cognee; xoá `30-cognee-proxy.sh`. `.env.example`: bỏ khối Cognee.

### Tài liệu
- `knowledge` + `docs`:
  - `modules/zca/chat-memory.md`, `modules/zca/README.md`;
  - `global/llm-providers.md`, `environment-guard.md`, `local-first-ai-usage.md`, `zalo-command-intake.md`;
  - `docs/README.md`.
- `CONTEXT.md`: sửa Trí nhớ dài hạn, thêm "Tìm theo ý nghĩa", sửa `/sync`, đổi "Điều bot tự học" thành "Điều bot đã học", bỏ "Đoạn".

## Kiểm tra đã chạy
- `npm run typecheck`, `npm run lint`: sạch.
- `npm run test`: API 941/941, web 176/176.
- `npm run build`: OK (contracts, api, web).
- `node .claude/hooks/docs-drift-check.mjs` và `--all`: PASS.
- Smoke test model trên macOS: nạp 6,7 giây, embed 3 câu 8 ms. Hai câu cùng ý giống nhau 0,842, khác ý 0,083.

## Kiểm tra bằng Docker (sau khi Docker Desktop chạy lại)
- Image Postgres: bản đầu lỗi do thiếu `clang-21` (gói `clang21` không đặt lệnh này vào PATH). Đã chuyển sang `make with_llvm=no` theo hướng dẫn của pgvector. Build OK, `CREATE EXTENSION vector` ra bản 0.8.1.
- Chạy toàn bộ migration từ đầu trên image này: OK. Bảng `zca_message_embeddings` đúng schema, hai bảng Cognee đã bị xoá.
- Chạy thật trên DB (lưu tin → `embedPending` → tìm → thu hồi):
  - 5 tin được nạp; chạy lại thì 0 tin.
  - Tìm theo ý nghĩa xếp câu đúng ý lên đầu: "pass wifi là gì" → "mật khẩu wifi…" (khoảng cách 0,427); "hoá đơn điện bao nhiêu" → "tiền điện tháng này 850k" (0,411). Câu sai ý đều trên 0,6 nên bị loại.
- **Phát hiện và sửa lỗi có sẵn**: `returning(['sent_at'])` dạng mảng bị TypeORM hiểu là tên property nên không trả gì. Hệ quả là `markRecalled` luôn trả `[]` (với Cognee, việc đánh dấu ngày `stale` và gửi lại đoạn khi thu hồi chưa bao giờ chạy). Đã đổi sang `returning('sent_at')`. Kiểm tra lại: sau khi thu hồi, 3 tin trong 10 phút sau về trạng thái chờ và được nạp lại.

## Chưa kiểm tra
- Chưa đo RAM của API trên Linux. Image được build và thử trên Mac arm64; server chạy x86_64.

## Việc sau khi deploy (cần anh duyệt)
- Xoá volume `zalobot-cognee` và các image `cognee/cognee`, `cognee/cognee-ui` trên máy chủ (khoảng 4,6 GB).
- Xoá `COGNEE_*` khỏi env Coolify; bỏ tunnel `cognee-zalobot.datintech.site`.
