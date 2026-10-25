# Implementation plan: Trí nhớ dài hạn v2 (làm một lần)

Route: implement · Phase 1 (inspect-and-plan) · Rủi ro: **CAO** (schema DB, service mới trong docker-compose, gửi dữ liệu ra ngoài, đổi luồng prompt) · Ngày: 2026-10-25

Tài liệu nền: `design.md` (cùng thư mục), `.agents/artifacts/chat-memory-cognee/research.md` (Cognee đã kiểm chứng), `.agents/artifacts/chat-memory-persona-forgetting/investigation.md` (lỗi "mèo đen").

## 1. Mục tiêu và các quyết định đã chốt

Anh Đạt muốn làm toàn bộ trong một plan, không tách giai đoạn.

| # | Quyết định | Nguồn |
| --- | --- | --- |
| D1 | Bot nhớ mãi điều được dặn, hỏi lại chuyện cũ tốt hơn, tự hiểu về người trong nhóm, lưu mãi | Chọn ở câu hỏi mục tiêu |
| D2 | Việc chạy nền (nạp vào Cognee, tự học) dùng **9router** như hiện tại | Q1 |
| D3 | Điều tự học **dùng ngay, xoá được** | Q2 |
| D4 | Tin bị thu hồi **vẫn xoá khỏi trí nhớ** | Q3 |
| D5 | **Cognee** lo phần trí nhớ dài hạn có hiểu biết (graph theo kênh) | Các tin nhắn trước |
| D6 | **Thẻ xác nhận tool call vẫn do Redis xử lý.** Chỉ khi thao tác đã được duyệt **và chạy thành công** thì mới đưa vào trí nhớ | Tin nhắn này |
| D7 | Hội thoại thông thường thì đưa hết vào trí nhớ | Tin nhắn này |

## 2. Các case anh chưa nêu, kèm đề xuất mặc định

Anh duyệt plan nghĩa là đồng ý các mặc định dưới đây; muốn đổi điểm nào thì sửa thẳng vào bảng.

| # | Case | Đề xuất mặc định |
| --- | --- | --- |
| C1 | Duyệt bằng ❤️ đủ ngưỡng, `yes <mã>`, `yes all` | Cả ba đều đi qua `executeConfirmed`, nên móc ở đó là đủ. |
| C2 | Thao tác đi kèm (tạo nơi chốn khi ghi thu chi) | Mỗi thao tác thành công ghi một dòng sự kiện riêng. |
| C3 | Huỷ (😡, `cancel`), hết hạn 5 phút | **Không đưa gì** vào trí nhớ dài hạn. |
| C4 | Sửa thẻ (`edit <mã>`, tin bổ sung) | Chỉ bản cuối cùng được duyệt mới được đưa vào; các thẻ trung gian thì không. |
| C5 | Đã duyệt nhưng chạy lỗi (DB lỗi, Google Calendar lỗi) | Không đưa vào. Thành công một phần (lưu được trong app, lỗi bản sao Google) thì ghi phần đã lưu. |
| C6 | Tin của người dùng **gây ra** tool call ("@den ghi 70k đi bơi") | Vẫn vào cửa sổ ngắn hạn (để hiểu câu nối tiếp) và vẫn nằm trong `zca_messages`; **không nạp vào Cognee**. Dòng sự kiện đã duyệt thay cho nó, nên khoản bị huỷ không thành "ký ức giả". |
| C7 | Tool chỉ đọc (báo cáo, danh sách việc, lịch, link lưu trữ) | Câu hỏi và câu trả lời vào cửa sổ ngắn hạn; **không nạp Cognee**, vì số liệu cũ sẽ làm bot trả lời sai về sau. |
| C8 | Thẻ xác nhận, thông báo "Hết hạn", "Đã huỷ", "N yêu cầu chờ", thông báo thả tim | Không vào cửa sổ ngắn hạn, không vào Cognee. Đây chính là 4 tin rác đã đẩy lời dặn "mèo đen" ra khỏi cửa sổ. |
| C9 | Tin bot trò chuyện thường (đùa, trả lời) | Vào cửa sổ ngắn hạn; **không nạp Cognee**, để câu bot bịa (như "em chuẩn bị dao thớt") không thành fact. |
| C10 | Link + mã đăng nhập dashboard | Không bao giờ lưu nội dung; chỉ lưu "[Link đăng nhập dashboard]". |
| C11 | Tin nhắc nhở bot tự gửi | Vào cửa sổ ngắn hạn (để hiểu "ok mua rồi"); không nạp Cognee. |
| C12 | Sticker, file, voice, video | Giữ nhãn như hiện tại trong `zca_messages`; không nạp Cognee (trừ chữ trong ảnh và tên file). |
| C13 | Dữ liệu bị sửa hoặc xoá sau đó trên dashboard | Không đẩy vào trí nhớ. Thêm luật vào prompt: số liệu hiện tại (tiền, nợ, lịch, việc) phải tra bằng tool, không lấy từ trí nhớ. |
| C14 | Người dặn tính cách mà không nói "nhớ nhé" | Tool `REMEMBER_NOTE` nhận cả "dặn", "từ giờ mày là…" nên hiện thẻ ngay. Nếu bị bỏ lỡ, việc tự học ban đêm vẫn bắt được và đưa thành fact về bot. |
| C15 | Bot tự thu hồi thẻ sau khi duyệt | Không ảnh hưởng dòng sự kiện đã duyệt (là dòng riêng). |
| C16 | `BAN_USER` (chặn người dùng) | Không đưa vào trí nhớ (thao tác quản trị, nhạy cảm). |
| C17 | Gộp tài khoản | Chuyển người tạo của Ghi nhớ và người được nhắc trong điều tự học sang ID giữ lại. |
| C18 | Số dài trong chat (số thẻ, số tài khoản ≥ 12 chữ số) | Che bớt trước khi gửi cho Cognee; vẫn lưu nguyên trong `zca_messages`. |
| C19 | Cognee hoặc 9router lỗi, chạm giới hạn | Ngày đó đánh dấu `failed`, đêm sau thử lại; tra cứu tự rơi về full-text search hiện tại. Bot vẫn chạy bình thường. |
| C20 | Dữ liệu đã lưu trước khi có tính năng | Nạp dần, tối đa 7 ngày cũ mỗi đêm mỗi kênh, để không chạm giới hạn của model miễn phí. |
| C21 | Kênh chỉ bật ngắn hạn | Tin có `expires_at` (lúc gửi + 7 ngày), job hằng ngày xoá tin hết hạn. Trí nhớ dài hạn không bao giờ đọc các tin này, nên vẫn đúng "chỉ nhớ từ lúc bật". |
| C22 | Xoá toàn bộ trí nhớ của một kênh | **Không làm lần này** (anh đã chọn "lưu mãi"). Ghi lại để làm sau nếu cần. |

## 3. Kiến trúc sau khi làm

```text
Tin Zalo ──► zca_messages (Postgres, nguồn gốc, có memory_kind)
               │
               ├─► Cửa sổ ngắn hạn: đọc thẳng zca_messages (bỏ Redis list)
               ├─► Full-text search (dự phòng khi Cognee lỗi, và cho tin hôm nay)
               └─► Job 03:00: mỗi kênh, mỗi ngày một tài liệu ──► Cognee (dataset zca-<channelId>)
                                                             └─► Tự học: fact về bot và từng người ──► zca_learned_facts

Thẻ xác nhận ──► Redis (giữ nguyên) ──duyệt + chạy thành công──► dòng memory_kind='action' trong zca_messages

Ghi nhớ ──► zca_channel_notes (qua thẻ xác nhận hoặc dashboard)

Mỗi lượt bot trả lời: [danh tính] + Ghi nhớ + Bot tự học (bot, người gửi, người được tag, người trong cửa sổ) + cửa sổ ngắn hạn
Câu hỏi chuyện cũ: SEARCH_CHAT_HISTORY ──► Cognee recall (ngữ cảnh) + FTS ──► LlmService trả lời
```

Redis vẫn giữ: thẻ chờ duyệt, tin tạm để thu hồi, phiên ZCA, rate limit, cache, BullMQ. Chỉ bỏ `zca:short_memory:*`.

## 4. Phân loại tin (`memory_kind`)

| Kind | Gán ở đâu | Cửa sổ ngắn hạn | Nạp Cognee |
| --- | --- | --- | --- |
| `chat` | Tin của người, mặc định | ✅ | ✅ |
| `request` | Tin của người mà LLM trả về tool call (`TextInputService`) | ✅ | ❌ |
| `action` | Dòng tạo ra sau khi `executeConfirmed` thành công | ✅ | ✅ |
| `bot_chat` | Tin bot gửi, mặc định (trò chuyện, câu hỏi làm rõ) | ✅ | ❌ |
| `tool` | Kết quả tool chỉ đọc | ✅ | ❌ |
| `reminder` | Tin nhắc nhở | ✅ | ❌ |
| `result` | Tin "✅ [358] Chi …" sau khi duyệt | ❌ (đã có `action`) | ❌ |
| `card` | Thẻ xác nhận | ❌ | ❌ |
| `system` | Hết hạn, đã huỷ, N yêu cầu chờ, thông báo tim | ❌ | ❌ |
| `secret` | Link/mã đăng nhập dashboard (chỉ lưu placeholder) | ❌ | ❌ |

Cách gán kind cho tin bot: dùng `AsyncLocalStorage` (`OutgoingMemoryKind.run(kind, fn)`, giống `AuditContext`). Wrapper `api.sendMessage` trong `zca.service.ts:670` đọc kind hiện tại, mặc định `bot_chat`. Nhờ vậy không phải đổi chữ ký của mọi hàm gửi tin.

## 5. Thay đổi theo khu vực

### 5.1 Database (migration mới, chỉ thêm, không sửa migration cũ)

1. `zca_messages`: thêm `memory_kind varchar not null default 'chat'`, `expires_at timestamptz null`; index `(channel_id, sent_at desc) where recalled_at is null` dùng cho cửa sổ (kiểm tra lại với index đang có trước khi thêm). Tin bot cũ có `is_bot = true` thì backfill `memory_kind = 'bot_chat'`.
2. `zca_channel_notes`: `id uuid`, `channel_id`, `text varchar(200)`, `created_by` (users.id, null nếu tạo từ dashboard bởi `dashboard-owner`), `source_msg_id`, `created_at`, `updated_at`. Ghi vào nhật ký kiểm toán (thao tác có chủ đích).
3. `zca_learned_facts`: `id uuid`, `channel_id`, `subject_kind` (`bot` | `member`), `subject_user_id null`, `subject_name`, `fact varchar(300)`, `learned_at`, `deleted_at null`, `deleted_by null`. Dòng bị xoá giữ lại làm danh sách "không học lại".
4. `zca_memory_ingestions`: `channel_id`, `day date`, `status` (`pending` | `ingested` | `stale` | `failed`), `cognee_data_id null`, `attempts`, `last_error`, `ingested_at`; unique `(channel_id, day)`.
5. Thêm `zca_learned_facts` và `zca_memory_ingestions` vào `ignoredTables` của `AuditLogSubscriber` (job ban đêm ghi nhiều, không phải thao tác nghiệp vụ). Riêng việc admin xoá fact thì ghi `deleted_by`.

### 5.2 Contracts (`packages/contracts/src/index.ts`)

- `ThreadChatMemoryConfig` thêm `learnPeople: boolean` (mặc định `true`, chỉ có tác dụng khi dài hạn bật). `normalizeChatMemoryConfig` điền mặc định cho cấu hình cũ.
- DTO: `IChannelNote`, `IUpsertChannelNoteRequest`, `IChannelLearnedFact`, `IChannelMemoryStatus` (ngày đã nạp gần nhất, số ngày lỗi, Cognee có đang bật).
- `API_ROUTES` thêm: `zcaThreadNotes(threadId)`, `zcaThreadNote(threadId, noteId)`, `zcaThreadFacts(threadId)`, `zcaThreadFact(threadId, factId)`, `zcaThreadMemoryStatus(threadId)`.
- Hằng số giới hạn: `CHANNEL_NOTES_LIMITS` (20 dòng, 200 ký tự), `LEARNED_FACTS_LIMITS` (5 dòng mỗi người, tối đa 15 dòng vào prompt).
- i18n (vi + en) cho mục "Trí nhớ" mới.

### 5.3 API: lưu và đọc tin

- `apps/api/src/zca/memory/outgoing-memory-kind.ts` (mới): `AsyncLocalStorage<MemoryKind>`.
- `zca.service.ts` `recordBotReplyInMemory`: nhận kind, bỏ qua nội dung nếu `secret`. Ghi **một** đường duy nhất vào `zca_messages` khi kênh bật ít nhất một trí nhớ: `expires_at = null` nếu dài hạn bật, ngược lại là lúc gửi + 7 ngày.
- `zca-bot-feature.service.ts` `onMessage` (`:936`): tin người cũng ghi một đường như vậy (thay cho hai lệnh ghi Redis + Postgres hiện tại).
- `ChatMemoryService`: thêm `setKind(channelId, msgId, kind)`, `recordAction(...)`, `getRecent(channelId, { limit, maxAgeDays, excludeMsgId })` (lọc theo kind ở mục 4, `recalled_at is null`, `sent_at >= now - days`), `purgeExpired()`. Các truy vấn của trí nhớ dài hạn thêm `expires_at is null`.
- `ShortTermMemoryService`: bỏ phần Redis và Map dự phòng, chỉ còn là lớp mỏng gọi `getRecent` (giữ nguyên interface cho `TextInputService`). Chữ trong ảnh cắt 500 ký tự lúc đọc. Xoá `recordImageText` bản ngắn hạn; `ImageTextMemoryService` chỉ còn cập nhật một dòng.
- Thu hồi (`onUndo`, `ZcaService.undo`): `markRecalled` như hiện tại, thêm đánh dấu `zca_memory_ingestions` của ngày đó thành `stale` nếu đã nạp.

### 5.4 API: chỉ đưa tool call vào trí nhớ khi đã thành công (D6)

- `transaction-confirmation.service.ts`:
  - Gửi thẻ (`:561`, `:571`) trong `OutgoingMemoryKind.run('card')`. Thông báo hết hạn, huỷ, tim, "còn N yêu cầu" (`:1045`, `:816`, `processCancel`…) dùng `system`; các tin "✅" trong `executeConfirmed` dùng `result`.
  - Tách mỗi nhánh `case` của `executeConfirmed` (`:1310`) thành "chạy và trả về tóm tắt". Chỉ khi một nhánh **chạy xong không lỗi** mới gọi `MemoryEventService.recordConfirmedAction(pending, summary)`. Các trường hợp `catch` và "không tìm thấy" không ghi. `BAN_USER` không ghi (C16). Thao tác đi kèm cũng được ghi (C2).
  - `recordConfirmedAction`: chỉ khi kênh bật ít nhất một trí nhớ. Chèn vào `zca_messages`: `msg_id = 'action:<code>:<createdAt>'`, `sender_uid` = người yêu cầu (`pending.userId`, tên lấy từ `UsersService`), `memory_kind = 'action'`, `text` = tóm tắt dạng chữ thường không emoji (ví dụ `Đã ghi: chi 70.000đ đi bơi, hồ bơi tây thạnh, 08:00 25/10`).
- `TextInputService`: khi LLM trả về tool call (trừ trò chuyện thường), gọi `setKind(chatId, input.messageId, 'request')` (C6). Strategy của tool chỉ đọc gửi tin trong `tool` (C7).
- `dashboard-tool.strategy.ts`: gửi trong `secret` (C10). Tin nhắc nhở (`reminder-target.service.ts:254`) dùng `reminder`.

### 5.5 API: Ghi nhớ

- `ChannelNotesService` (`apps/api/src/zca/memory/channel-notes.service.ts`): liệt kê, thêm, sửa, xoá; chặn quá 20 dòng hoặc quá 200 ký tự; chuẩn hoá khoảng trắng.
- Tool mới trong `text-tool.definitions.ts` và strategy:
  - `REMEMBER_NOTE { text, replaceNoteId? }`: khi người dùng nói "nhớ nhé", "tao dặn", "từ giờ mày là/hãy…". Tạo pending action `REMEMBER_NOTE` qua `TransactionConfirmationService` (thẻ: "Ghi nhớ [123]? …", hoặc "Thay '…' bằng '…'?"). Đủ 20 dòng thì trả lời phải xoá bớt.
  - `FORGET_MEMORY { query }`: tìm trong Ghi nhớ và điều tự học của kênh (khớp không dấu); thẻ liệt kê tối đa 5 mục sẽ xoá; không thấy thì trả lời không tìm thấy.
  - Hai loại pending mới thêm vào `PendingActionType`, `compact-summary.util.ts` và `executeConfirmed`, đi qua đúng luật xác nhận của kênh (số tim, ai được duyệt).
- Prompt (`text-input.service.ts:190` và `:603`): thêm `buildMemoryProfileBlock` ngay sau câu danh tính:
  - `ĐIỀU ĐƯỢC DẶN TRONG CUỘC CHAT NÀY (ưu tiên hơn mô tả mặc định ở trên):` + các dòng Ghi nhớ, mỗi dòng có mã ngắn `[n1]` để `replaceNoteId` dùng được.
  - `ĐIỀU BOT TỰ RÚT RA (có thể sai, Ghi nhớ thắng nếu mâu thuẫn):` + fact về bot, người gửi, người được tag (`input.taggedUsers`) và người có trong cửa sổ, tối đa 15 dòng.
  - Câu danh tính đổi thành: "Bạn là trợ lý cá nhân thông minh trên Zalo; nếu phần ĐIỀU ĐƯỢC DẶN mô tả bạn khác đi thì theo phần đó."
  - Thêm luật C13 (số liệu hiện tại phải tra bằng tool).
  - Khối được dựng **cả khi trí nhớ ngắn hạn tắt**, vì Ghi nhớ độc lập với các công tắc.
- `TextInputService`: sửa tiêu đề khối ngữ cảnh gần đây (`:592`) để vẫn cấm gọi tool lại cho yêu cầu cũ, nhưng nói rõ lời dặn trong khối vẫn có hiệu lực.

### 5.6 API: Cognee

- **Hạ tầng (`docker-compose.yml`)**: service `cognee`, image `cognee/cognee` ghim đúng bản (v1.6.5 hoặc digest tương ứng, xác minh tag lúc làm); **không mở cổng ra ngoài**, chỉ nằm trong network của compose; volume `zalobot-cognee:/cognee-storage`; healthcheck `GET /health`.
  - Dùng kho mặc định **trong volume riêng** (SQLite + LanceDB + Kuzu). **Không đổi** image Postgres chính (`postgres:16-alpine` sang image pgvector bản Debian có rủi ro lệch collation giữa musl và glibc, làm hỏng index text).
  - Env cố định: `ENABLE_BACKEND_ACCESS_CONTROL=true` (bắt buộc, vì khi tắt thì bộ lọc dataset bị bỏ qua), `TELEMETRY_DISABLED=true`, `LLM_PROVIDER=custom`, `LLM_ENDPOINT`/`LLM_MODEL`/`LLM_API_KEY` lấy từ cấu hình 9router, `SUMMARY_METHOD=from_extraction` (1 lượt LLM mỗi đoạn thay vì 2), `FASTAPI_USERS_JWT_SECRET`, `DEFAULT_USER_EMAIL`/`DEFAULT_USER_PASSWORD`.
  - **Embedding**: mặc định fastembed với model **đa ngôn ngữ** chạy trong container (không gửi dữ liệu đi, không cần key). Tên model chốt ở bước kiểm tra (mục 6, bước 2); nếu fastembed không có model đa ngôn ngữ dùng được thì chuyển sang Gemini embedding với key dự phòng đang có.
  - Theo quy tắc env (`global/environment-guard.md`, skill `env-docker`): khoá cố định của stack để trong `environment:` của service; khoá bí mật (`COGNEE_API_KEY`, `COGNEE_JWT_SECRET`, `COGNEE_DEFAULT_USER_PASSWORD`) thêm vào `.env.example` và `.env.production`; cập nhật `environment-guard.md`.
- **Client** `apps/api/src/zca/memory/cognee/cognee.client.ts`: `fetch` + `AbortSignal.timeout`, header `X-Api-Key`, parse response bằng zod. Các hàm: `remember(dataset, fileName, text)`, `listData(dataset)`, `forget(datasetId, dataId)`, `recallContext(dataset, query, { temporal })` (dùng `only_context`, nên câu trả lời cuối vẫn do `LlmService` viết theo luật trích ngày và người nói). Không cấu hình `COGNEE_URL`/`COGNEE_API_KEY` thì tính năng tắt, client không bao giờ throw (giống các LLM provider).
- **Job nạp hằng đêm** (`apps/api/src/zca/memory/memory-ingest.job.ts`, BullMQ `upsertJobScheduler`, 03:00 `Asia/Ho_Chi_Minh`, theo mẫu `queue/reminder-job.ts:50`):
  1. Với mỗi kênh bật dài hạn: các ngày cần nạp là hôm qua, các ngày `stale`, các ngày `failed` (tối đa 5 lần thử), và tối đa 7 ngày cũ chưa nạp (C20).
  2. Dựng tài liệu ngày: tiêu đề `Nhật ký <tên kênh> ngày 25/10/2026 (thứ Bảy)`, mỗi dòng `HH:mm <Tên>: <text>`, chỉ kind `chat` + `action`, bỏ tin đã thu hồi, che số dài (C18). Ngày không có dòng nào thì đánh dấu `ingested`, không gọi Cognee.
  3. Ngày `stale`: gọi `forget` bản cũ rồi nạp lại.
  4. Gọi `remember` vào dataset `zca-<channelId>`, tên file `<channelId>_<yyyy-mm-dd>.txt`; lưu `cognee_data_id` (lấy từ response hoặc `listData`).
  5. Lỗi thì ghi `failed` + `last_error`; chạy lần lượt từng kênh để không chạm giới hạn của 9router.
- **Tự học** (`apps/api/src/zca/memory/learned-facts.service.ts`), chạy ngay sau khi nạp xong một kênh, khi `learnPeople` bật:
  - Chọn bot và tối đa 10 người hoạt động nhiều nhất trong các ngày vừa nạp.
  - Với mỗi người: `recallContext("Những điều đã biết về <tên>")`, sau đó `LlmService` rút tối đa 5 dòng fact ổn định bằng tiếng Việt. Dặn AI bỏ qua câu đùa, chửi, đe doạ, và không đưa lại các dòng đã bị xoá (gửi kèm danh sách dòng đã xoá).
  - Thay các fact chưa bị xoá của người đó bằng kết quả mới (D3).
  - Thu hồi tin (D4): ngày `stale` được nạp lại, và người gửi tin đó được học lại trong cùng đêm. Fact cũ có thể còn tối đa tới đêm sau; ghi rõ giới hạn này trong tài liệu.
- **Tra chuyện cũ** (`search-chat-history-tool.strategy.ts`): Cognee bật và không lỗi thì gộp `recallContext` (truyền `temporal` khi có `fromDate`/`toDate`) với kết quả FTS (luôn chạy, để có tin hôm nay chưa nạp và để trích câu gốc), rồi đưa cho `LlmService`. Cognee lỗi thì dùng FTS như hiện tại (C19).
- **Job dọn hằng ngày**: `purgeExpired()` xoá tin có `expires_at` đã qua (C21).
- `UserMergeService.merge` (`users/user-merge.service.ts:99`): chuyển `zca_channel_notes.created_by`, `zca_learned_facts.subject_user_id` và `deleted_by` (C17).

### 5.7 Web (`apps/web/src/modules/zca/`)

- Gộp các card `short-term-memory-section.tsx`, `long-term-memory-section.tsx`, `image-text-memory-section.tsx` thành một mục "🧠 Trí nhớ" trên trang cấu hình kênh, gồm:
  1. **Ghi nhớ**: danh sách, thêm, sửa, xoá (dùng được cả khi các công tắc trí nhớ tắt).
  2. **Bot đã học**: nhóm theo người, có nút xoá; hiện "Chưa có" khi dài hạn tắt hoặc chưa nạp.
  3. **Nhớ đoạn chat gần đây**: công tắc, số tin, số ngày.
  4. **Nhớ lâu dài**: công tắc, "Tự học về người trong nhóm" (`learnPeople`), trạng thái nạp (ngày gần nhất, lỗi); "Nâng cao": số kết quả mỗi lần tra.
  5. **Đọc chữ trong ảnh**: giữ như hiện tại.
- Cảnh báo quyền riêng tư cạnh công tắc dài hạn: nói rõ mỗi đêm toàn bộ chat (kể cả của người không dùng bot) được gửi qua 9router.
- Query/mutation TanStack cho notes, facts, status (query key factory theo quy ước hiện có trong `zca-query.ts`), 4 trạng thái UI, bo góc nhỏ như hiện tại, giao diện điện thoại một cột.
- `thread-config-form.ts`: thêm `learnPeople`; Ghi nhớ và fact gọi API riêng, không nằm trong form PUT cấu hình.
- API controller: các endpoint ở mục 5.2, chỉ admin, theo mẫu `zca.controller.ts:259-298`.

### 5.8 Tài liệu (Hard Completion Gate)

- `.agents/knowledge/modules/zca/chat-memory.md`: viết lại theo kiến trúc mới (kind, Ghi nhớ, Cognee, tự học, job đêm, thu hồi, giới hạn). Bản tiếng Việt: `.agents/docs/modules/zca/chat-memory.md`.
- `.agents/knowledge/global/local-first-ai-usage.md` + docs: sửa ngoại lệ "Chat memory" (gửi cả chat trong ngày qua 9router, lý do D2, cách giảm thiểu C6–C12/C18, đường lui `qwen`).
- `.agents/knowledge/global/environment-guard.md` + docs: các khoá Cognee.
- `CONTEXT.md`: thêm **Ghi nhớ**, **Bot tự học**, **Nhật ký đã nạp**; sửa định nghĩa **Trí nhớ hội thoại**, **Trí nhớ ngắn hạn**, **Trí nhớ dài hạn**.
- `.agents/knowledge/modules/zca/README.md`, `.agents/docs/README.md`: cập nhật chỉ mục.
- `walkthrough.md` trong thư mục artifact sau khi xong.

## 6. Thứ tự thực hiện (Phase 2)

1. Migration + entity + contracts (mục 5.1, 5.2).
2. **Kiểm tra Cognee sớm**: dựng service `cognee`, gọi thử `remember`/`listData`/`recallContext`/`forget` bằng một ngày chat mẫu; chốt tên model embedding, dạng response của `remember` (endpoint này 404 trên trang tài liệu) và cách lấy `data_id`. Nếu REST khác tài liệu thì sửa client ngay ở bước này.
3. Phân loại tin + đường ghi một nguồn + cửa sổ ngắn hạn đọc từ Postgres (5.3, 5.4). Đây là phần sửa trực tiếp lỗi "mèo đen".
4. Ghi nhớ: service, tool, pending action, prompt (5.5).
5. Cognee client + job nạp + tự học + tra cứu + job dọn (5.6).
6. Web (5.7).
7. Test, kiểm tra chất lượng, tài liệu (mục 7, 5.8).

## 7. Kiểm thử và xác minh

- **Unit test (API)**:
  - Gán kind (AsyncLocalStorage, mặc định `bot_chat`, `secret` không lưu nội dung).
  - `getRecent` lọc đúng kind, ngày, tin thu hồi.
  - `recordConfirmedAction` chỉ chạy khi thành công: không chạy khi huỷ, hết hạn, lỗi, `BAN_USER`; có chạy cho thao tác đi kèm.
  - Strategy của `REMEMBER_NOTE`/`FORGET_MEMORY` (giới hạn 20 dòng, thay dòng, không tìm thấy).
  - `buildMemoryProfileBlock` (Ghi nhớ luôn có mặt dù cửa sổ rỗng hoặc trí nhớ tắt).
  - Dựng tài liệu ngày (chỉ `chat` + `action`, che số dài, múi giờ VN).
  - Job nạp (`stale` thì forget rồi nạp lại, `failed` thì thử lại, Cognee tắt thì bỏ qua).
  - Cognee client parse response và không throw.
  - Tra cứu rơi về FTS khi Cognee lỗi.
  - `normalizeChatMemoryConfig` với cấu hình cũ thiếu `learnPeople`.
- **Web**: test cho model form và các mapper.
- **Lệnh**: `npm run typecheck`, `npm run lint`, `npm run test` theo từng workspace (`@zalobot/contracts`, `@zalobot/api`, `@zalobot/web`), `npm run build --workspace @zalobot/web`, `node .claude/hooks/docs-drift-check.mjs`.
- **Kiểm tra chất lượng Cognee** (tiêu chí ở `research.md` mục 6), bằng 1–2 tuần chat thật xuất từ `zca_messages` của một nhóm, chạy trên máy local:
  - Mỗi người ra đúng một node.
  - Không có lỗi JSON khi nạp.
  - Đúng 8/10 câu hỏi mẫu tiếng Việt.
  - `forget` rồi nạp lại một ngày thì fact của tin bị bỏ biến mất.
  - Chi phí và thời gian nạp chấp nhận được.

  **Không đạt** thì giao bản có Cognee **tắt** (không đặt `COGNEE_API_KEY`): Ghi nhớ, phân loại tin, cửa sổ ngắn hạn và FTS vẫn chạy đầy đủ; em báo lại kết quả để anh quyết.
- **Không chạy được ở bước này**: kiểm thử với Zalo thật trên production. Em sẽ ghi rõ những gì chưa kiểm được.

## 8. Rủi ro và đường lui

| Rủi ro | Giảm thiểu / đường lui |
| --- | --- |
| Cognee hoặc model sau 9router trích sai, nhất là tên người tiếng Việt | Kiểm tra ở bước 2 và mục 7; fact xoá được; tắt bằng cách bỏ `COGNEE_API_KEY` |
| REST của Cognee khác tài liệu | Phát hiện ở bước 2, sửa client trước khi làm tiếp |
| Gửi cả chat qua dịch vụ miễn phí bên thứ ba | Anh đã chấp nhận (D2); có cảnh báo trên dashboard; đường lui `LLM_ENDPOINT` trỏ Qwen local |
| Migration trên bảng `zca_messages` lớn | Chỉ thêm cột có default, backfill `bot_chat` bằng một câu `UPDATE` theo `is_bot`; không khoá lâu với dữ liệu hiện tại |
| Prompt dài hơn | Giới hạn 20 dòng Ghi nhớ + 15 dòng tự học; cửa sổ ngắn hạn hết rác nên chất lượng tốt hơn ở cùng số tin |
| Đổi luồng ghi tin (bỏ Redis ngắn hạn) | Kênh chỉ bật ngắn hạn mất ngữ cảnh một lần lúc deploy; interface `getRecent` giữ nguyên |
| LanceDB chỉ xoá hẳn dữ liệu khi compaction | Ghi vào tài liệu; dữ liệu nằm trong volume nội bộ, không mở ra ngoài |

Rollback: migration chỉ thêm (có `down`); bỏ `COGNEE_API_KEY` để tắt Cognee; gỡ service `cognee` khỏi compose mà không ảnh hưởng phần còn lại.

## 9. Ngoài phạm vi

- Gửi link dashboard qua chat riêng (đã có thẻ việc riêng).
- Xoá toàn bộ trí nhớ của một kênh (C22).
- pgvector trong Postgres chính, Graphiti/Mem0.
- Kiểm thử trực tiếp trên Zalo production.
