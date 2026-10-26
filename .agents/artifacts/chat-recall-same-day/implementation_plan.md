# Implementation plan: Cognee nạp theo đợt, lệnh /sync, không che dữ liệu

Risk: HIGH, vì có migration mới, đổi contract `IChannelMemoryStatus` và thêm hàng đợi chạy theo sự kiện. Chẩn đoán gốc ở [investigation.md](investigation.md).

## Quyết định của anh (26/10/2026)
1. **Ghi gì nhớ nấy**: không che mật khẩu, bỏ luôn bước che số dài ≥12 chữ số hiện có.
2. **Nạp theo đợt**: kênh im lặng khoảng 2–5 phút thì nạp đoạn chat mới vào Cognee.
3. **Lệnh `/sync`**: bắt Cognee cập nhật ngay cho kênh đang nhắn.

## Phần 1: theo yêu cầu

### 1.1 Bỏ che dữ liệu
- `chat-day-document.ts`: không gọi `maskLongNumbers` nữa. Xoá `maskLongNumbers` và test của nó nếu không còn chỗ nào dùng.
- Giữ loại `secret` cho link/mã đăng nhập dashboard **do bot gửi**. Đó là tin của bot, không phải lời người nói, và vốn không vào Cognee.

### 1.2 Nạp theo đợt ("đoạn" trong ngày)
- **Bảng mới `zca_memory_segments`** (migration mới, không sửa migration cũ):
  - Cột: `id`, `channel_id`, `day` (date, giờ VN), `from_sent_at`, `to_sent_at`, `cognee_data_id` (`<datasetId>:<dataId>`), `created_at`.
  - Mỗi dòng là một đoạn chat hôm nay đã gửi vào Cognee.
- **Hẹn giờ bền** qua BullMQ, cùng queue `chat-memory`, concurrency 1, nên không chạy chồng lên job đêm.
  - Mỗi tin của kênh bật Nhớ lâu dài sau khi lưu (`ZcaBotFeatureService.onMessage`) sẽ đặt hoặc dời job trễ `segment` có `jobId = segment:<channelId>`.
  - Có tin mới thì dời job thêm **3 phút** (`SEGMENT_IDLE_MS`). Nhưng nếu tin đầu tiên của đợt đã chờ quá **15 phút** (`SEGMENT_MAX_WAIT_MS`) thì không dời nữa, để nhóm nói liên tục vẫn được nạp.
  - Job nằm trong Redis nên khởi động lại không mất.
- **Job `segment`** (`MemoryIngestService.ingestSegment(channelId)`):
  - Lấy tin hôm nay sau mốc `max(to_sent_at)` của các đoạn hôm nay, cùng bộ lọc với `dayLines` (`chat` và `action`, không phải bot, chưa thu hồi).
  - Dựng tài liệu tiêu đề `Nhật ký cuộc trò chuyện "<tên>" ngày 26/10/2026 (Thứ Hai), 14:28–14:56`, các dòng `HH:mm Tên: nội dung`.
  - `cognee.remember`, rồi ghi một dòng segment.
  - Không có tin mới thì bỏ qua. Cognee lỗi thì log và không ghi dòng nào; đợt sau gom lại cả phần này.
  - Kênh tắt Nhớ lâu dài hoặc Cognee tắt thì không làm gì.
- **Job đêm** (`ingestDay`): trước khi nạp cả ngày, `forget` mọi đoạn của ngày đó và xoá các dòng segment. Như vậy mỗi ngày cuối cùng chỉ còn **một** tài liệu như hiện nay, graph không bị trùng. Tự học về mọi người vẫn chỉ chạy ban đêm.
- **Thu hồi tin hôm nay** (`onUndo`): `forget` mọi đoạn hôm nay của kênh, xoá các dòng, rồi đặt job `segment` ngay. Đợt mới gom lại cả phần hôm nay mà không có tin đã thu hồi. Ngày cũ vẫn đánh dấu `stale` như hiện nay.

### 1.3 Lệnh `/sync`
- Nhận ở fast-path trong `TextToolFactory.resolveFastPathToolType`: `/sync` hoặc `@bot /sync`. Thêm `TextToolType.SYNC_MEMORY` và `SyncMemoryToolStrategy`. Không qua LLM.
- Ai được dùng: người đang được gọi bot trong kênh (quyền như mọi lệnh khác).
- Hành vi:
  - Kênh tắt Nhớ lâu dài → "🧠 Kênh này chưa bật Nhớ lâu dài."
  - Máy chủ chưa bật Cognee → báo như vậy.
  - Còn lại: bỏ hẹn giờ đang chờ của kênh, thêm job `sync` chạy ngay. Job nạp các ngày cũ còn chờ hoặc lỗi (`ingestChannel`, không chạy tự học) và đoạn mới hôm nay.
  - Bot trả lời ngay "🔄 Đang cập nhật trí nhớ…". Xong thì processor gửi "🧠 Đã cập nhật trí nhớ: <N> tin mới" hoặc "⚠️ Chưa cập nhật được, thử lại sau".
- Thêm `/sync` vào `/help`.

### 1.4 Trạng thái trên dashboard
- `IChannelMemoryStatus` thêm `todayIngestedUntil: string | null` (ISO `to_sent_at` của đoạn mới nhất hôm nay).
- Dòng trạng thái thẻ Nhớ lâu dài hiện thêm "Hôm nay đã nạp tới HH:mm".
- Sửa câu mô tả "Mỗi đêm…" và "Hạn chế: tin hôm nay chỉ tìm được theo từ khoá cho tới đêm nay" cho đúng: tin được nạp sau vài phút im lặng.

## Phần 2: sửa lỗi "không nhớ" trong đoạn chat (đề xuất kèm, anh bỏ được)
- **B. Tìm theo từ khoá bền hơn** (`chat-memory.query.ts`):
  - Từ khoá nhiều chữ tách thành từng chữ, nối bằng OR, xếp hạng theo `ts_rank` (khớp nhiều chữ đứng trước).
  - Từ khoá có `.`, `@`, `/` (tên miền, email, link) thì thêm điều kiện `text ILIKE '%…%'` (escape ký tự `%` và `_`).
  - Mô tả tham số `keywords` nhắc AI thêm từ viết tắt (mk, pass, tk, sdt).
- **C. Phân loại ý định** (`INTENT_CLASSIFICATION_RULES`): khi kênh bật Nhớ lâu dài, thêm mẫu "chỉ/nói cho <ai> biết <thông tin đã nhắn>" và "lúc nãy/hồi nãy nói rồi" → `SEARCH_CHAT_HISTORY`. Thêm các ca này vào intent eval.

## Ngoài phạm vi
- **A** (đưa lượt hỏi đáp trước của người nhắn vào prompt) không làm, theo quyết định bỏ trí nhớ ngắn hạn. Câu chỉ có "lúc nãy a có nói r" mà không nói chuyện gì vẫn có thể không hiểu.

## Tests
- `chat-day-document`: không che số.
- `memory-ingest.service.spec`:
  - Đoạn chỉ lấy tin sau mốc.
  - Không có tin mới thì không gọi Cognee.
  - Cognee lỗi thì không ghi dòng segment.
  - Job đêm `forget` các đoạn rồi mới nạp cả ngày.
  - Thu hồi tin hôm nay thì xoá các đoạn.
- Hẹn giờ: tin mới dời job thêm 3 phút; quá 15 phút thì không dời. Dùng queue giả.
- `/sync`:
  - Nhận đúng lệnh qua fast-path.
  - Báo đúng khi kênh tắt Nhớ lâu dài hoặc Cognee tắt.
  - Thêm job `sync`.
- Phần 2: query tách chữ, OR, ILIKE cho tên miền; intent eval thêm ca.
- Chạy `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build --workspace @zalobot/web`.

## Tài liệu
- knowledge và docs `modules/zca/chat-memory.md`: bảng segment, nạp theo đợt, `/sync`, không che. Cập nhật `global/local-first-ai-usage.md`: tin được gửi tới LLM của Cognee sau vài phút chứ không phải ban đêm, và **không che** gì. `global/zalo-command-intake.md`: thêm `/sync`.
- `CONTEXT.md`, mục "Trí nhớ dài hạn": nạp sau vài phút im lặng, không chỉ ban đêm; thêm thuật ngữ **Đồng bộ trí nhớ (`/sync`)**.
- docs-drift check phải pass.

## Rủi ro
- Số lần gọi LLM của Cognee tăng: mỗi đợt một lần, cộng một lần nạp lại cả ngày ban đêm, tổng khoảng gấp 2 lượng token hiện nay.
- Mọi tin, kể cả mật khẩu, tới LLM ngoài (9router) chỉ sau vài phút. Anh đã chấp nhận.
- Đã kiểm với Cognee 1.6.5 (`remember` đồng bộ, `forget` theo `dataId`, theo `.agents/artifacts/chat-memory-cognee/`). Một đoạn đang nạp dở mà job đêm chạy tới thì hai job vẫn chạy lần lượt (concurrency 1).
