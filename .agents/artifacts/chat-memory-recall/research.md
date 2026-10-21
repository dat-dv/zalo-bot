# Research: Trí nhớ hội thoại ZCA (hỏi lại mọi ngữ cảnh đã chat)

Route: research · Authority: research-only · Ngày: 2026-10-21

## 1. Câu hỏi

Lưu toàn bộ tin nhắn của các kênh ZCA đang listen vào DB. Khi người dùng mention bot và hỏi về quá khứ (vd "năm ngoái mình đi đâu?"), bot phải trả lời đúng, dựa trên lịch sử chat. API 9router (`/v1/chat/completions`, model `chat-daily`, hiện route sang `deepseek-v4.1-flash-free`) được đề xuất làm LLM cho tính năng này.

## 2. Hiện trạng (bằng chứng trong repo)

| Hạng mục | Hiện trạng | Nguồn |
| --- | --- | --- |
| Nhận tin nhắn | `ZcaService.startListener()` nhận toàn bộ event `message`, lọc theo tập kênh đang listen, rồi `dispatchMessage` sang plugin | `apps/api/src/zca/zca.service.ts:1346-1467`, `:1402-1409` |
| Lưu tin nhắn | **Không có bảng DB.** Chỉ có buffer 200 tin/kênh trong Redis `zca:buffered_msgs:<threadId>` (TTL 7 ngày), dùng làm fallback khi sync media | `apps/api/src/zca/zca-bot-feature.service.ts:402-439`, `:804` |
| Tin bot gửi | Không được buffer, trừ khi bật `ZCA_SELF_LISTEN` | `apps/api/src/config/configuration.ts:119` |
| Điều kiện kích hoạt | Mention bot / prefix / chat 1-1 | `apps/api/src/zca/zca-bot-feature.service.ts:1001-1017` |
| LLM | `LlmService.generate(prompt, tools?, systemInstruction?)` là **single-turn** (1 system + 1 user), không có history | `apps/api/src/llm/llm.service.ts:9-56`, `.agents/knowledge/global/llm-providers.md:31` |
| Provider OpenAI-compatible | Đã có, cấu hình bằng `OPENAI_BASE_URL`, `OPENAI_MODEL`, `OPENAI_API_KEY`, gọi qua raw `fetch` | `apps/api/src/llm/providers/openai.provider.ts:17-51` |
| Tool calling | `ZALO_TOOL_DEFINITIONS` gồm 14 tool, pattern strategy + factory | `apps/api/src/zalo/text/text-tool.definitions.ts`, `text-tool.factory.ts` |
| Vector / embeddings | Không có. Postgres là `postgres:16-alpine` thuần, chưa có pgvector | `docker-compose.yml:3` |
| Audit | `AuditLogSubscriber` ghi `audit_logs` cho **mọi** insert vào mọi bảng | `apps/api/src/database/audit-log.subscriber.ts:10-73` |
| Retention job | Không có. Cron duy nhất là reminder | `apps/api/src/reminders/reminder-scheduler.service.ts:19` |
| Chính sách AI | Local-first: LLM chỉ nhận lượng text tối thiểu; phụ thuộc hay model mới cần plan được duyệt | `.agents/knowledge/global/local-first-ai-usage.md` |

## 3. Nhận định cốt lõi

1. **API 9router không tự "nhớ".** `chat/completions` là stateless. Phần nhớ phải do mình làm: lưu DB, rồi truy xuất (retrieval) đúng đoạn liên quan và đưa vào prompt. 9router chỉ đóng vai LLM tổng hợp câu trả lời.
2. **Không thể nhét cả năm chat vào context.** Một nhóm hoạt động khoảng 1.000 tin/ngày sẽ ra khoảng 365k tin/năm. Bài toán thật là **retrieval theo thời gian và nội dung**, không phải lưu.
3. **Câu "năm ngoái đi đâu" là câu hỏi tổng hợp** (rải rác qua nhiều tin), không phải tìm một tin. Tìm keyword đơn thuần sẽ hụt. Cần (a) bộ lọc thời gian, (b) mở rộng từ khoá hoặc ngữ nghĩa, (c) lý tưởng nhất là tóm tắt định kỳ (episodic memory).
4. **Repo đã có dữ liệu có cấu trúc trả lời "đi đâu"**: `finance_places` + `finance_transactions` (có `placeId`, ngày phát sinh) và Google Calendar. Kết hợp các nguồn này thường chính xác hơn chat thô.
5. `prompt_tokens: 826` cho câu "hello" nghĩa là 9router đang chèn sẵn khoảng 800 token system prompt vào mỗi lần gọi. Đây là chi phí cố định cần tính.

## 4. Phương án truy xuất

| Phương án | Cách làm | Ưu | Nhược | Hạ tầng mới |
| --- | --- | --- | --- | --- |
| **A. Full-text search + lọc thời gian** | Bảng tin nhắn có cột `tsvector` (config `simple` + `unaccent` để "da lat" khớp "Đà Lạt"), GIN index. LLM gọi tool `search_chat_history({ keywords[], from, to, senderIds? })`, tự sinh từ đồng nghĩa ("đi", "du lịch", "vé", "khách sạn", tên địa danh). Lấy top-K kèm tin lân cận, rồi gọi LLM lần 2 để tổng hợp, có trích ngày và người gửi | Rẻ, không thêm dependency, chạy được ngay trên Postgres 16 | Hụt khi người dùng diễn đạt khác với từ đã chat | Extension `unaccent` (có sẵn trong contrib) |
| **B. Hybrid FTS + vector (pgvector)** | Thêm embedding cho mỗi tin hoặc cụm tin, tìm cosine kết hợp FTS | Recall ngữ nghĩa tốt nhất | Đổi image sang `pgvector/pgvector:pg16`, cần model embedding (local Ollama `bge-m3` hỗ trợ tiếng Việt tốt; 9router chưa rõ có `/v1/embeddings` không), backfill embedding | Image DB + model embedding |
| **C. Episodic memory (tóm tắt định kỳ)** | Cron hằng ngày/tuần dùng `chat-daily` tóm tắt từng kênh thành "sự kiện" (`{date, type: trip/meeting/purchase, place, people, summary, sourceMsgIds}`). Câu hỏi tổng hợp tìm trên bảng sự kiện trước, sau đó mới drill-down tin thô | Trả lời câu tổng hợp ("năm ngoái đi đâu") rất tốt, prompt ngắn | Tốn LLM theo lịch, tóm tắt có thể sai hoặc bỏ sót | Cron + bảng `chat_memories` |

**Đề xuất:** làm theo bậc **A → C → (B nếu cần)**. A là nền bắt buộc (vì C cũng drill-down từ bảng tin nhắn). C là thứ thực sự giải bài "năm ngoái đi đâu". B chỉ làm khi đo thấy recall của A+C chưa đủ.

## 5. Phác thảo dữ liệu (Phase 1, để thảo luận, chưa phải plan)

`zca_messages`:
- `id uuid`, `channel_id`, `msg_id` (unique cùng `channel_id`), `cli_msg_id`
- `sender_uid`, `sender_name`, `is_bot`
- `msg_type`, `text` (đã chuẩn hoá: text / caption / tên file), `content jsonb` (raw đã lọc), `quote_msg_id`, `mentions jsonb`
- `sent_at timestamptz` (từ `ts`), `recalled_at`, `created_at`
- `search tsvector` (generated: `to_tsvector('simple', immutable_unaccent(text))`)
- Index `(channel_id, sent_at)` và GIN(`search`)

Điểm móc nối:
- Ghi tại chỗ đang gọi `bufferRecentMessage` (`zca-bot-feature.service.ts:804`). Nên ghi bất đồng bộ hoặc theo batch để không chặn luồng trả lời.
- Tin bot gửi: ghi tại `ZaloService.sendMessage` hoặc `trackBotOutgoingMessage`.
- Event `undo` (thu hồi): đánh dấu `recalled_at` và loại khỏi kết quả tìm.
- Backfill: buffer Redis 200 tin + `getGroupChatHistory` (zca-js, có giới hạn).
- Bật/tắt theo kênh: thêm `memory` vào jsonb của `zca_thread_configs`.
- **Bắt buộc** thêm bảng này vào `ignoredTables` của `AuditLogSubscriber`, nếu không mỗi tin sẽ sinh thêm một dòng audit.

Tool mới (read-only, không cần pending action/xác nhận): `search_chat_history`. Strategy thực thi FTS, rồi gọi `LlmService` lần 2 với các đoạn tìm được. Hạn ngày tính theo `Asia/Ho_Chi_Minh` ("năm ngoái" = 2025-01-01 → 2025-12-31).

Bổ sung rẻ: ngữ cảnh ngắn hạn. Chèn N tin gần nhất của kênh vào prompt để hiểu câu nối tiếp ("thế tháng 5 thì sao?"). Việc này độc lập với retrieval dài hạn.

## 6. Rủi ro và điểm cần anh quyết

1. **Phạm vi nhớ**: đề xuất **theo từng kênh** (hỏi trong nhóm A chỉ tìm trong nhóm A; chat 1-1 chỉ tìm trong chat đó). Nếu tìm chéo kênh thì sẽ lộ nội dung nhóm này sang nhóm khác. Khác với tài chính là "sổ chung".
2. **Quyền riêng tư và chính sách local-first**: lưu mọi tin của thành viên nhóm (kể cả người không dùng bot), và gửi đoạn chat sang DeepSeek *free* qua 9router (bên thứ ba; model free thường có thể dùng dữ liệu để train). Theo `local-first-ai-usage.md` cần ghi nhận ngoại lệ: chỉ gửi top-K đoạn tối thiểu, không gửi cả lịch sử. Phương án thay thế là dùng `qwen` local cho bước tổng hợp.
3. **Retention**: giữ bao lâu (vô hạn / 2 năm…)? Có cần lệnh "quên" không?
4. **Model**: `chat-daily` là alias, 9router có thể đổi model phía sau bất cứ lúc nào. Chất lượng tool-calling của bản flash-free chưa kiểm chứng. Đề xuất giữ provider chính cho tool-calling, chỉ dùng 9router cho bước tổng hợp/tóm tắt qua cấu hình riêng (`MEMORY_LLM_BASE_URL`, `MEMORY_LLM_MODEL`, `MEMORY_LLM_API_KEY`).
5. **Log hiện tại**: listener đang log full raw payload ở mức LOG (`zca.service.ts:1400`). Khi lưu tin nhắn thì nên hạ mức log này.
6. **API key** đã được dán vào chat. Nên rotate.

## 6b. Phương án dùng memory server có sẵn (bổ sung)

Nguồn: kiến thức chung của agent, **chưa kiểm chứng trên web**. Tên image, version và trạng thái dự án cần xác minh trước khi lên plan.

| Server | Bản chất | Hợp "năm ngoái đi đâu"? | Hạ tầng kèm theo | Ghi chú |
| --- | --- | --- | --- | --- |
| **Mem0** (OSS, có REST server) | LLM trích "fact" từ hội thoại, lưu vector; `add(messages, user_id/agent_id/run_id, metadata)` + `search(query, filters)` | Trung bình: mạnh về fact ổn định (sở thích, thông tin người), yếu hơn về mốc thời gian | Vector store (Qdrant hoặc pgvector), tuỳ chọn graph Neo4j, LLM + embedder (hỗ trợ base URL OpenAI-compatible, Ollama) | Gọn nhất để tích hợp. Mặc định mỗi lần `add` gọi LLM 1–2 lượt |
| **Graphiti** (Zep, OSS) | Temporal knowledge graph: mỗi "episode" được trích thành entity/edge có thời điểm hiệu lực | **Tốt nhất** cho câu hỏi theo thời gian | Neo4j hoặc FalkorDB, LLM cần structured output tốt, embedder | Nặng nhất, tốn LLM nhất khi ingest. Zep Community Edition (server cũ) nghe nói đã ngừng, cần kiểm tra |
| **Letta** (MemGPT) | Cả một agent server có memory | Có, nhưng thay luôn agent loop hiện tại | Postgres + server riêng | Quá tay: đè lên `TextInputService` và tool catalog |
| LightRAG / Cognee | RAG trên tài liệu hoặc graph | Trung bình | Vector + graph | Thiết kế cho tài liệu, không cho chat stream |

Những việc vẫn phải tự làm dù dùng server nào:
- Ingest: vẫn móc ở listener (`zca-bot-feature.service.ts:804`), đẩy tin sang server. Nên gom theo batch (vd mỗi 30 tin hoặc mỗi giờ mỗi kênh), vì nhóm chat nhiều tin, mỗi lần add gọi LLM sẽ đụng rate limit của model free.
- Cô lập kênh: map `channelId` → `run_id`/`group_id`, filter bắt buộc khi search.
- Thu hồi (`undo`), quyền riêng tư, retention: server không tự biết.
- LLM + embedder: 9router lo phần LLM, nhưng **chưa rõ 9router có `/v1/embeddings`** không; nếu không thì cần Ollama embedder local (`bge-m3`, `nomic-embed-text`).
- Vẫn nên giữ bảng raw `zca_messages` nhẹ trong Postgres: để trích dẫn, xử lý thu hồi và re-index khi đổi server (memory server lưu fact đã qua LLM, có thể mất chi tiết).

Đánh giá: dùng server có sẵn **tiết kiệm phần retrieval và tóm tắt** (phương án B và C ở mục 4), nhưng không bỏ được phần ingest, cô lập và privacy. Gợi ý: Mem0 + Qdrant nếu muốn đơn giản; Graphiti nếu ưu tiên câu hỏi theo thời gian và chấp nhận thêm Neo4j.

## 7. Đề xuất bước tiếp theo

1. Anh chốt 4 quyết định ở mục 6 (phạm vi, LLM ngoài hay local, retention, backfill).
2. Chuyển sang route `implement`, Phase 1: viết `implementation_plan.md` cho **A** (bảng `zca_messages` + ingest + `undo` + tool `search_chat_history` + config 9router riêng + docs zca/llm).
3. Sau khi A chạy và có dữ liệu thật: plan tiếp cho **C** (cron tóm tắt sự kiện), rồi đo chất lượng để quyết định **B**.
