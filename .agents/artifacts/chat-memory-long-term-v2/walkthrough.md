# Walkthrough: Trí nhớ dài hạn v2

Ngày: 2026-10-25 · Branch: `feat/chat-memory-v2` (chưa commit) · Plan: `implementation_plan.md` (đã duyệt cùng các mặc định C1–C22)

## Đã làm

### Lưu tin một nguồn + phân loại tin
- Migration `1724980000000-AddChatMemoryV2`: thêm `zca_messages.memory_kind` (tin bot cũ chuyển thành `bot_chat`) và `expires_at`; tạo 3 bảng mới `zca_channel_notes`, `zca_learned_facts`, `zca_memory_ingestions`.
- `memory-kind.ts`: 10 loại tin và `OutgoingMemoryKind` (AsyncLocalStorage). Wrapper `api.sendMessage` gán loại cho mọi tin bot gửi.
- Trí nhớ ngắn hạn đọc thẳng từ `zca_messages` (`ChatMemoryService.getRecent`); bỏ danh sách Redis `zca:short_memory:*`, bỏ bản dự phòng trong RAM.
- Kênh chỉ bật ngắn hạn: tin có `expires_at` = lúc gửi + 7 ngày, job đêm xoá; tra cứu dài hạn và Cognee bỏ qua các tin này.
- Thu hồi tin: xoá nội dung và đánh dấu ngày tương ứng `stale` để nạp lại Cognee.

### Tool call chỉ vào trí nhớ khi thành công (D6, C1–C16)
- Thẻ xác nhận vẫn ở Redis. Tin của `TransactionConfirmationService` mặc định là `system`; thẻ là `card`; tin ✅ là `result`.
- `executeConfirmed` chỉ ghi dòng `action` "(đã duyệt) …" khi nhánh chạy xong không lỗi, đứng tên người yêu cầu. Không ghi khi huỷ, hết hạn, lỗi, xoá không thấy, `BAN_USER` hay `FORGET_MEMORY`.
- Tin người gây ra tool call và lệnh `yes/cancel/edit` được đánh dấu `request` (ở lại trong cửa sổ, không nạp Cognee).
- Tool chỉ đọc gắn loại `tool`, tin nhắc gắn `reminder`, link dashboard gắn `secret` (chỉ lưu placeholder).

### Ghi nhớ
- `ChannelNotesService`, tool `REMEMBER_NOTE` / `FORGET_MEMORY` (strategy + pending action + thẻ + tóm tắt).
- Prompt: `BOT_IDENTITY_LINE` nhường cho phần ĐIỀU ĐƯỢC DẶN; `buildMemoryProfileBlock` đặt ngay sau câu danh tính ở cả hai lượt gọi AI; thêm luật "số liệu hiện tại phải tra bằng tool"; tiêu đề khối ngữ cảnh gần đây nói rõ lời dặn trong đó vẫn có hiệu lực.

### Cognee + tự học
- `CogneeClient` (REST 1.6.5: login, remember, forget, recall `only_context`).
- `MemoryIngestService` + `MemoryIngestProcessor` (queue `chat-memory`, 03:00): nạp từng ngày, gửi lại ngày `stale`, thử lại ngày lỗi, tự học về bot và tối đa 10 người hay nói.
- `SEARCH_CHAT_HISTORY` gộp tìm theo từ khoá với ngữ cảnh Cognee; Cognee lỗi thì chỉ dùng từ khoá.
- `docker-compose.yml`: service `cognee` (không mở cổng, volume riêng, access control bật, telemetry tắt, embedding đa ngôn ngữ chạy trong container); API nhận `COGNEE_URL=http://cognee:8000`.
- Config `cognee` + kiểm tra `COGNEE_URL` trong env validator; `.env.example` có mục mới.

### Dashboard
- `ChannelMemoryController`: notes CRUD, learned facts (xem, xoá), memory status.
- Trang cấu hình kênh: nhóm "🧠 Trí nhớ" gồm Ghi nhớ, Nhớ đoạn chat gần đây, Nhớ lâu dài (tự học, trạng thái nạp, Bot đã học, Nâng cao), Đọc chữ trong ảnh.

### Gộp tài khoản
- `UserMergeService.merge` chuyển `created_by` của Ghi nhớ, `subject_user_id` và `deleted_by` của điều tự học.

### Tài liệu
- knowledge + docs: `modules/zca/chat-memory.md` (viết lại), `global/local-first-ai-usage.md` (ngoại lệ mới), `global/environment-guard.md` (khoá Cognee), chỉ mục `modules/zca/README.md` (EN + VI), `.agents/docs/README.md`, `CONTEXT.md` (Ghi nhớ, Thao tác đã duyệt, Điều bot tự học…).

## Đã kiểm tra

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck --workspace @zalobot/api` | 0 lỗi |
| `npm run lint:check --workspace @zalobot/api` | 0 lỗi |
| `npm run test --workspace @zalobot/api` | 796/796 pass |
| `npm run typecheck --workspace @zalobot/web` | 0 lỗi |
| `npm run lint:check --workspace @zalobot/web` | 0 lỗi |
| `npm run test --workspace @zalobot/web` | 144/144 pass |
| `npm run build --workspace @zalobot/web` | thành công |
| `npm run typecheck --workspace @zalobot/contracts` | 0 lỗi |
| `docker compose -f docker-compose.yml config -q` | hợp lệ |
| `node .claude/hooks/docs-drift-check.mjs` và `--all` | PASS |
| REST Cognee 1.6.5 thật (container local, đoạn chat 25/10) | login, tạo API key, `remember` (trả `dataset_id`, `items[].id`), list datasets/data, `recall` CHUNKS/SUMMARIES/GRAPH_COMPLETION `only_context`, dataset lạ → 404, `forget` → xoá xong |

## Chưa kiểm tra được

- **Chất lượng Cognee với LLM thật**: 9router trả **410** (model `minimax-m3.1-flash-free` sau alias đã ngừng phục vụ; model thay thế `deepseek-v4.1-flash-free` báo thiếu credential openrouter). Không lấy được key Gemini (bị chặn quyền), nên chỉ chạy được bộ trích không dùng LLM (`gliner_demo`); bộ này cho node tiếng Việt kém, đúng như dự đoán. Các tiêu chí ở `research.md` mục 6 (mỗi người một node, JSON ổn định, 8/10 câu hỏi, forget sạch fact) **chưa đo**.
- Chưa chạy migration trên DB thật, chưa chạy luồng Zalo thật, chưa xem trang cấu hình trong trình duyệt (cần API + DB đang chạy).
- Chưa sửa `.env.production` (file không theo dõi trong git, có secret).

## Việc anh cần làm

1. Sửa 9router (đổi model hoặc thêm credential), hoặc chọn LLM khác cho Cognee.
2. Thêm vào `.env.production`: `COGNEE_USER_PASSWORD`, `COGNEE_JWT_SECRET`, `COGNEE_LLM_PROVIDER`, `COGNEE_LLM_ENDPOINT`, `COGNEE_LLM_MODEL`, `COGNEE_LLM_API_KEY` (và `COGNEE_URL=http://cognee:8000` để khớp Coolify).
3. Xoá container và volume thử nghiệm local: `docker rm zalobot-cognee-smoke` và `docker volume rm zalobot-cognee-smoke` (hook an toàn chặn em xoá).
4. Có LLM chạy được rồi thì chạy kiểm tra chất lượng Cognee trên 1–2 tuần chat thật. Không đạt thì để trống `COGNEE_USER_PASSWORD`: Ghi nhớ, phân loại tin và cửa sổ gần đây vẫn chạy đầy đủ.
