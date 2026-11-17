# Kế hoạch: Trí nhớ dài hạn bằng pgvector + embedding MiniLM chạy local (bỏ Cognee)

- Route: implement · Phase 1 (inspect-and-plan) · Rủi ro: **HIGH** (đổi kiến trúc, schema DB, image Postgres, image API, contract API)
- Nhánh/worktree (Phase 2): `feat/local-vector-memory` tại `../zalo-bot-worktrees/local-vector-memory` (tạo từ `main` local)

## 1. Bối cảnh & lý do

- Prod 24h qua: khoảng 19.000 lượt LLM cho Cognee, chỉ 313 lượt thành công. Cả `ggstudio` và `gemini` đều trả 429 (hết quota Google). 49 ngày ở trạng thái `failed`, chỉ 22 ngày nạp xong.
- Cognee bắt buộc dùng LLM để dựng graph, nên không thể nạp nếu không có LLM. Lúc rảnh nó vẫn chiếm 1,84 GB RAM, image 3,9 GB.
- Dữ liệu nhỏ: khoảng 1.960 tin/30 ngày. Bảng `zca_messages` **đã lưu toàn bộ tin** và đã có tìm theo từ khoá (`search_vector`, `zalobot_unaccent`, lấy kèm tin xung quanh).

## 2. Mục tiêu

1. Nạp trí nhớ **không gọi LLM nào**: embedding chạy ngay trong API, dùng `paraphrase-multilingual-MiniLM-L12-v2` (384 chiều, bản ONNX quantized).
2. Tra trí nhớ = tìm theo từ khoá (đang có) **cộng** tìm theo ý nghĩa (pgvector), gộp hai kết quả bằng RRF, lấy kèm tin xung quanh như hiện tại.
3. Gỡ hẳn Cognee: service `cognee` và `cognee-ui`, cổng LLM nội bộ `/api/internal/llm`, cấu hình nginx `cognee.locations`, các env `COGNEE_*`.
4. Không có ngày nào bị "fail vì quota": tin vào là tìm được ngay theo từ khoá, và có embedding sau vài giây.

**Phạm vi LLM còn lại:** khi có người hỏi chuyện cũ, bot vẫn dùng **1 lượt LLM** của chain để viết câu trả lời (giống mọi câu chat khác). Phần nạp và tìm thì không gọi LLM.

## 3. Quyết định cần anh duyệt

| # | Vấn đề | Mặc định em đề xuất | Lựa chọn khác |
|---|---|---|---|
| D1 | "Điều bot tự học" hiện chạy mỗi đêm và cần LLM | **Tắt tự học** (không còn gọi LLM). Các điều đã học vẫn dùng trong prompt và vẫn xoá được trên dashboard. Ẩn công tắc `learnPeople` trên UI; contract giữ field để tương thích. | Giữ tự học, mỗi đêm khoảng 11 lượt LLM/kênh có tin, nguồn đổi sang tìm vector |
| D2 | Image Postgres hiện là `postgres:16-alpine`, collation `en_US.utf8` trên musl | **Tự build image `postgres:16-alpine` + pgvector** (`docker/postgres/Dockerfile`, biên dịch pgvector v0.8.x). Dữ liệu và collation giữ nguyên, không phải REINDEX. | Dùng `pgvector/pgvector:pg16` (Debian/glibc), sau khi đổi phải `REINDEX DATABASE` vì collation đổi hành vi |
| D3 | `onnxruntime-node` không chạy trên Alpine (musl) | **Đổi stage `prod-deps` và `runner` của API sang `node:22-bookworm-slim`** | Dùng backend WASM của onnxruntime trên Alpine (chậm hơn khoảng 3–5 lần, ít phụ thuộc) |
| D4 | Model embedding lấy từ đâu | **Tải trong lúc build image** (stage riêng). Lúc chạy không cần mạng, boot không phải chờ. Image tăng khoảng 120 MB. | Tải lần đầu khi chạy, cache trong `/app/data/models` |
| D5 | Bảng `zca_memory_ingestions` và `zca_memory_segments` (chỉ dùng cho Cognee) | **Drop bằng migration mới** | Giữ lại, không dùng nữa |

## 4. Thiết kế

### 4.1 Lưu trữ

Migration mới `17250400000000-AddMessageEmbeddings` (số thứ tự sau `1725030000000`):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE zca_message_embeddings (
  message_id uuid PRIMARY KEY REFERENCES zca_messages(id) ON DELETE CASCADE,
  channel_id varchar NOT NULL,
  embedding vector(384) NOT NULL,
  model varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "IDX_zca_message_embeddings_channel" ON zca_message_embeddings (channel_id);
DROP TABLE zca_memory_segments; DROP TABLE zca_memory_ingestions;   -- theo D5
```

- **Không tạo index HNSW.** Mỗi kênh chỉ vài nghìn dòng: quét chính xác theo `channel_id` nhanh (dưới 10 ms) và không bỏ sót kết quả như HNSW khi có lọc. Ghi lý do vào knowledge; khi một kênh vượt khoảng 100k tin thì thêm HNSW.
- Thêm entity TypeORM `ZcaMessageEmbeddingEntity`. Cột vector được đọc/ghi bằng SQL thô dạng `'[...]'::vector`, không cần thêm thư viện pgvector cho TypeORM.
- `down()`: tạo lại 2 bảng cũ, drop bảng embeddings. Không drop extension.

### 4.2 Dịch vụ embedding (`apps/api/src/zca/memory/embedding/`)

- `local-embedding.service.ts`: tải pipeline `feature-extraction` của `@huggingface/transformers` một lần (lazy, singleton), `pooling: 'mean'`, `normalize: true`. Hàm `embed(texts: string[]): Promise<number[][]>` chạy theo lô (32 câu/lô).
  - Lỗi tải model thì log một lần, `isReady()` trả `false`, và việc tìm quay về chỉ dùng từ khoá. Hàm này không throw ra ngoài.
- `embedding-text.ts` (hàm thuần, có spec): văn bản đem đi embed của một tin = tối đa 2 tin trước đó trong cùng kênh, cách nhau không quá 10 phút, rồi tới `Tên: nội dung` của chính tin đó. Cắt tối đa khoảng 1.000 ký tự. Tin ngắn kiểu "ok chốt" vì vậy vẫn mang theo ngữ cảnh.
- Config: `memory.embeddingModel` (mặc định `Xenova/paraphrase-multilingual-MiniLM-L12-v2`) và `memory.embeddingModelDir` (đường dẫn model đã bake trong image). Không thêm env bắt buộc mới.

### 4.3 Nạp (thay `MemoryIngestService` + `MemorySegmentScheduler` + `CogneeClient`)

- `MemoryEmbeddingService.embedPending(channelId?, limit=256)`: chọn các tin trong `zca_messages` **chưa có embedding**, với điều kiện: kênh đang listen và bật Nhớ lâu dài, `recalled_at IS NULL`, `expires_at IS NULL`, `text IS NOT NULL`, `NOT is_bot`, `memory_kind IN LONG_TERM_INGEST_KINDS`. Tính embedding rồi ghi bằng `INSERT … ON CONFLICT DO NOTHING`.
- Kích hoạt, vẫn dùng queue BullMQ `chat-memory` với concurrency 1:
  - mỗi tin mới của kênh bật trí nhớ → job `embed` sau khoảng 20 giây (debounce theo kênh, thay cho chờ 3–15 phút);
  - khi boot → quét toàn bộ (backfill 1.957 tin cũ, ước tính dưới 1 phút trên CPU);
  - lúc 03:00 → quét bù.
- Thu hồi tin (`markRecalled`): xoá embedding của tin đó, và của các tin mà ngữ cảnh embedding có chứa tin đó (tối đa 2 tin sau nó, sẽ được tính lại).
- OCR ảnh xong (`attachImageText`): xoá embedding của tin ảnh để tính lại cùng chữ đọc được.
- `/sync`: chạy `embedPending(channelId)` ngay, trả lời "🧠 Đã cập nhật trí nhớ: N tin mới." Bỏ hết thông báo kiểu "LLM lỗi, tạm dừng 60 phút".

### 4.4 Tra (`SearchChatHistoryToolStrategy` + `ChatMemoryService.search`)

- Tìm theo từ khoá: giữ nguyên `buildHitQuery`.
- Tìm theo ý nghĩa: query mới `buildVectorHitQuery`: embed câu hỏi (`question`), lọc theo `channel_id`, cùng điều kiện ngày/kind/`excludeMsgId`, `ORDER BY embedding <=> $q LIMIT k`, bỏ kết quả có khoảng cách cosine lớn hơn ngưỡng (`0.6`, hằng số, chỉnh khi test).
- Gộp: `mergeHitsRrf(keywordIds, vectorIds, k=60)` là hàm thuần có spec. Tin trúng ở cả hai danh sách được xếp lên đầu. Sau đó đưa vào `buildNeighbourQuery` như cũ, giới hạn `MAX_MEMORY_LINES`.
- Bỏ khối "Ngữ cảnh trí nhớ (Cognee)" khỏi prompt. Quy tắc trả lời giữ nguyên.

### 4.5 Gỡ Cognee

- Xoá: `cognee.client.ts(+spec)`, `chat-day-document.ts`, `memory-segment.scheduler.ts(+spec)`, `memory-ingest.service.ts(+spec)` (thay bằng service mới), `learned-facts.prompt.ts` (theo D1), entity ingestion/segment, `llm/llm-proxy.*` (module, controller, service, spec), `apps/web` nginx `/api/internal/` + `cognee.locations` + script `30-cognee-proxy.sh`.
- `docker-compose.yml`: bỏ service `cognee` và `cognee-ui`, volume `zalobot-cognee`, env `COGNEE_URL`, cổng `COGNEE_UI_PORT`. Postgres dùng image build từ `docker/postgres/Dockerfile` (D2). `docker-compose.local.yml` đổi tương tự.
- `configuration.ts` / `env.validator.ts` / `.env.example`: bỏ `COGNEE_*`.
- `apps/api/Dockerfile`: theo D3 và D4.

### 4.6 Contract và dashboard

- `IChannelMemoryStatus` (breaking, chỉ web dùng): `{ embeddingReady: boolean; embeddedMessages: number; pendingMessages: number; lastEmbeddedAt: string | null }`. Bỏ `cogneeEnabled`, `lastIngestedDay`, `failedDays`, `lastError`, `todayIngestedUntil`.
- Web `long-term-memory-section.tsx` + `model/channel-memory.ts(+spec)`: viết lại phần mô tả (bỏ Cognee, bỏ cảnh báo "gửi chat tới AI dựng trí nhớ", vì giờ tin không rời server), hiển thị "Đã nhớ N tin · còn chờ M". Ẩn công tắc tự học (D1), vẫn giữ `LearnedFactsPanel` để xem và xoá.
- Route `memory-status` giữ nguyên đường dẫn.

## 5. Kiểm thử

- Unit (Jest): `embedding-text`, `mergeHitsRrf`, `buildVectorHitQuery`, `MemoryEmbeddingService` dùng embedder giả (chọn tin chờ, bỏ tin bị thu hồi hoặc của bot, xử lý lỗi), `syncResultText` mới, cập nhật spec `chat-memory.service`/strategy, spec web `channel-memory`.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` cho cả 3 workspace.
- Docker local: build image Postgres+pgvector, chạy migration trên bản sao dữ liệu dev, build image API (bookworm), xác nhận model nạp được khi không có mạng. Đo RAM của API và thời gian embed 2.000 tin.
- Thử tay trên local: hỏi "hôm trước nói đi đâu ăn" với từ khác nhau, để thấy tìm theo ý nghĩa bắt được những câu mà tìm theo từ khoá bỏ sót.
- `node .claude/hooks/docs-drift-check.mjs` exit 0.

## 6. Tài liệu (Hard Completion Gate)

- Knowledge (EN) và docs (VI): `modules/zca/chat-memory.md`, `modules/zca/README.md`, `global/llm-providers.md` (bỏ cổng LLM cho Cognee), `global/environment-guard.md` (bỏ `COGNEE_*`), `global/local-first-ai-usage.md`, `global/zalo-command-intake.md` (`/sync`), `.agents/docs/README.md`.
- `CONTEXT.md`: sửa định nghĩa **Trí nhớ dài hạn**, **Đồng bộ trí nhớ (`/sync`)**, **Điều bot tự học**. Bỏ **Đoạn (trí nhớ)**.

## 7. Triển khai & dọn dẹp (sau merge, chỉ khi anh nói push)

1. Push `main` → Coolify build lại. Image Postgres đổi nhưng dùng lại volume cũ (cùng alpine/pg16, không đổi dữ liệu). Migration tạo extension và bảng. API boot tự backfill embedding.
2. Kiểm tra: log `[MemoryEmbedding] Embedded N messages`, hỏi thử trong một nhóm.
3. Dọn volume `zalobot-cognee` (khoảng 290 MB) và 2 image Cognee (khoảng 4,3 GB) trên server. **Em sẽ hỏi lại anh trước khi xoá.**

## 8. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Build pgvector trên alpine lỗi hoặc Coolify không build image Postgres | Thử build local trước. Phương án dự phòng là D2-b (`pgvector/pgvector:pg16` + REINDEX) |
| Đổi API sang bookworm làm hỏng Tesseract OCR hoặc `zca-js` | Chạy lại spec OCR, test boot container local, kiểm tra stage `tessdata` |
| MiniLM tìm tiếng Việt chưa đủ tốt | Hybrid với tìm từ khoá. Sau này có thể đổi sang `bge-m3` (đổi cột sang 1024 chiều + embed lại) |
| RAM API tăng khoảng 300–400 MB | Server còn khoảng 23 GB trống; gỡ Cognee còn bớt được 1,84 GB |
| Mất trí nhớ graph cũ của 22 ngày đã nạp | Tin gốc vẫn còn trong `zca_messages` và được embed lại toàn bộ |
