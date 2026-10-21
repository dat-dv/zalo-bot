---
metadata:
  agent-artifact:
    id: docs-module-zca
    type: documentation
    depends_on:
      - .agents/knowledge/modules/zca/README.md
      - apps/api/src/zca/zca.service.ts
      - apps/api/src/zca/zca.controller.ts
      - apps/api/src/zca/zca-bot-feature.service.ts
      - apps/api/src/zca/thread-config.service.ts
      - apps/api/src/zca/group-event-dispatcher.service.ts
      - apps/api/src/zca/strategies/welcome-group-event.strategy.ts
      - apps/api/src/zca/pending-image/pending-image-dispatcher.service.ts
      - apps/api/src/database/entities/zca-thread-config.entity.ts
      - .agents/docs/modules/zca/chat-memory.md
      - apps/api/src/zalo/text/text-tool.definitions.ts
      - apps/api/src/google/google-resources.controller.ts
      - apps/api/src/dashboard-auth/dashboard-user.ts
      - apps/web/src/modules/zca/view/zca-screen.tsx
      - apps/web/src/modules/zca/view/thread-config-modal.tsx
      - apps/web/src/modules/zca/view/sync-media-modal.tsx
      - apps/web/src/modules/zca/model/chat-rows.ts
      - apps/web/src/modules/zca/api/zca-api.ts
      - apps/web/src/modules/zca/presentation/components/chat-table-row.tsx
---

# Module ZCA (Zalo Client Account)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/zca/README.md).

Module `apps/api/src/zca` và `apps/web/src/modules/zca` kết nối một tài khoản Zalo cá nhân qua `zca-js` (WebSocket), điều phối sự kiện tin nhắn/reaction/nhóm, lưu cấu hình bot cho từng cuộc trò chuyện, sao lưu media lên Google Drive/Photos, và chứa trang quản trị **Zalo & Người dùng**.

## 1. Chức Năng Chính Backend (`apps/api/src/zca`)

- **Kết nối & phiên đăng nhập (`ZcaService`)**:
  - Đăng nhập bằng mã QR từ dashboard, từ chat (`/zalo-login`, `/zca-login`, `/zlogin`; đăng xuất `/zalo-logout`, `/zca-logout`, `/zlogout`) hoặc bằng CLI `npm run zca:login --workspace @zalobot/api`.
  - Phiên được lưu ở **hai nơi**: file `.zca-session.json` trong thư mục `DATA_DIR`/`ZCA_DATA_DIR` (không có thì `./data` nếu tồn tại, cuối cùng là thư mục chạy) và Redis key `zca:session`. Khi khởi động, server đọc file trước, không có thì đọc Redis rồi ghi lại ra file. Nhờ vậy restart server hay đổi container (mất file) vẫn giữ được phiên. Đăng xuất xoá cả hai.
  - Ghi nhớ cặp `msgId -> cliMsgId` (bộ nhớ + Redis `zca:msg:cli:<msgId>`, 24 giờ) để lệnh thu hồi `undo(payload, threadId)` gửi đúng `cliMsgId`, tránh lỗi `"Lỗi không xác định"` của Zalo. `deleteMessage(dest, onlyMe)` là phương án dự phòng khi thu hồi bị từ chối.
  - Lấy danh sách nhóm/bạn bè (`getAvailableThreads`) và đồng bộ trạng thái lắng nghe sang `ThreadConfigService`.
- **Xử lý tin nhắn & reaction (`ZcaBotFeatureService`)**: xem mục 1a và 1c.
- **Cấu hình theo kênh (`ThreadConfigService`, entity `ZcaThreadConfigEntity`, bảng `zca_thread_configs`)**: đọc theo thứ tự bộ nhớ → Redis `zca:thread_config:<id>` (24 giờ) → DB. Danh sách thread đang lắng nghe lưu ở Redis `zca:listened_threads`.
- **Xác nhận thao tác (`TransactionConfirmationService`)**: mã `yes/cancel/edit <mã>`, thả tim/phẫn nộ, thu hồi thẻ chờ.
- **Ảnh chờ xử lý (`pending-image/`)**: `ImageBatchHandler` gom ảnh trong 1 giây rồi hỏi "1 tạo bill / 2 lưu ảnh"; ảnh được giữ 5 phút (bộ nhớ + Redis `pending:image:user:<userId>`). **Từ khi chuyển sang "chỉ làm khi được gọi", ZCA không còn mở menu này cho ảnh không kèm chữ** (ảnh đó chỉ được lưu, xem mục 1a), nên không phát sinh ảnh chờ mới từ ZCA. Dispatcher vẫn trả lời nếu còn ảnh chờ, chuyển câu trả lời tới một trong ba strategy:
  - `1` hoặc `tạo bill [ghi chú]` → OCR + AI ghi giao dịch.
  - `2` hoặc `lưu drive/ảnh/photo` → tải lên Drive và Google Photos.
  - `hủy`, `cancel`, `bỏ qua`, `không`… → huỷ.
- **Sự kiện nhóm**: `GroupEventDispatcher` có sẵn `WelcomeGroupEventStrategy`. Khi bật `ZCA_ENABLE_WELCOME=true`, bot chào thành viên mới vào nhóm ("Chào mừng @tên đến với nhóm!"), kèm ảnh `ZCA_WELCOME_IMAGE_PATH` (mặc định `./welcome.jpg`) nếu file tồn tại.

### Các trường cấu hình của một kênh

| Nhóm cấu hình | Trường | Mặc định | Ý nghĩa |
| --- | --- | --- | --- |
| Chung | `isListened` | tắt | Bot có nhận tin từ kênh này không |
| Tương tác trực tiếp | `enabled` | tắt | Mở phần cấu hình tương tác trực tiếp trên dashboard; việc định tuyến tin nhắn không phụ thuộc cờ này |
| | `triggerPrefixes` | rỗng | Danh sách tiền tố gọi bot trong nhóm, ví dụ `!`, `bot:`. Không phân biệt hoa thường, không chứa dấu cách, 1–20 ký tự, tối đa 10 cái |
| | `allowAiChat` | tắt | Cho phép trò chuyện tự do ở L1: bot trả lời cả câu hỏi ngoài tài chính/lịch (gọi LLM thêm một lần không kèm tool). Tắt thì bot im lặng với tin không gọi tool |
| | `allowSelf` | tắt | Xử lý cả tin do chính tài khoản bot gửi |
| Sao lưu media | `enabled` + `uploadImages/Videos/Files/Audios` | tắt hết | Tự sao lưu theo từng loại (L3) |
| | `notifyInThread` | tắt | Gửi link Drive/Photos vào nhóm sau khi sao lưu |
| | `customFolder` | `zalobot/<tên nhóm>` nếu biết tên | Thư mục Drive tuỳ chỉnh |
| | `fileSuffix` | `_<tên hoặc id>` | Hậu tố tên file |
| | `photosAlbum` | rỗng | Tên album Google Photos tuỳ chỉnh |
| Quy tắc xác nhận | `allowReactions` | tắt | Cho phép duyệt/huỷ bằng ❤️/😡 |
| | `requiredHearts` | nhóm `5`, cá nhân `1` | Số tim cần để duyệt |
| | `timeoutMinutes` | `5` | Thời hạn thẻ chờ |
| Lưu trữ | `driveFolderId/Url/Path`, `photosAlbumId/Url/Title` | trống | Link đã lưu tới **thư mục gốc** Drive và album Photos của kênh (xem mục "Link Drive/Photos cố định theo kênh") |

Lưu ý:
- Bật lắng nghe một kênh đang tắt tương tác trực tiếp thì hệ thống tự bật `directInteraction.enabled` kèm `allowAiChat` (giữ nguyên danh sách tiền tố).
- **Dữ liệu cũ**: kênh lưu từ trước có thể còn một chuỗi `triggerPrefix` đơn. Hệ thống tự gộp nó vào `triggerPrefixes` mỗi khi đọc (DB, Redis, file JSON cũ) và bỏ khoá cũ ở lần lưu sau. Trường `requireMention` không còn: nhóm luôn phải @mention hoặc dùng tiền tố.
- **Đã gỡ bỏ**: hai cấu hình "Thu chi thụ động" (`expenseTracking`) và "Lịch thụ động" (`calendarExtraction`). Migration `1724800000000-DropZcaPassiveTrackingColumns` xoá hai cột này và xoá `requireMention` khỏi `direct_interaction`. Migration không khôi phục được giá trị cũ khi chạy `down`.

## 1a. Luồng Xử Lý Tin Nhắn (L1 / L3)

Nguyên tắc phân vai: **module Users quyết định AI được tương tác với bot**, còn **cấu hình thread quyết định bot làm GÌ trong thread đó**.

Mọi tin nhắn đi qua hai cổng chung **theo đúng thứ tự**:
1. Lấy cấu hình (`getConfig` kèm loại kênh từ zca-js) và kiểm tra `isListened`. Kênh không lắng nghe thì bỏ qua ngay.
2. Quy tắc tin của chính bot: tin `isSelf` bị bỏ qua trừ khi bật `allowSelf` hoặc `ZCA_SELF_LISTEN`; tin do chính backend gửi đi luôn bị bỏ qua.

Sau đó tin nhắn rơi vào một trong các luồng:

| Luồng | Khi nào | Kiểm tra quyền user | Bot làm gì |
|---|---|---|---|
| **Thao tác chờ duyệt** | `yes/cancel/edit <mã>`, trả lời ảnh đang chờ | `yes`/`cancel`/thả tim: xác nhận tập thể, ai trong nhóm cũng được. `edit`: chỉ chủ yêu cầu, tài khoản bot hoặc user đã cấp quyền | `edit` chỉ được gọi lại đúng loại thao tác cũ |

**Lệnh chờ duyệt có tag bot**: người dùng trong nhóm hay gõ kèm tag, ví dụ `@Đen edit 125 …` hoặc `@bot yes 123`. Trước khi khớp lệnh, hệ thống gỡ tag **của bot**. Cách gỡ ưu tiên dựa trên dữ liệu mention Zalo gửi kèm (uid bot, vị trí, độ dài), vì tên hiển thị của bot trong nhóm ("Đen") có thể khác `botName` cấu hình; sau đó mới gỡ các bí danh `@bot`. Tag người khác được giữ nguyên để tin thường không bị hiểu nhầm thành lệnh. Trước đây tag đứng đầu làm lệnh `edit` không khớp, nên bot coi cả câu là yêu cầu mới và tạo thêm một thẻ chờ (ví dụ sự kiện có tiêu đề "Edit 125 …").
| **L3 – Media thụ động** | Ảnh/video/file/voice, thread bật `mediaBackup` và bật loại tương ứng | Không kiểm tra — kho Drive là của cả nhóm | Sao lưu lên Drive và album Photos của nhóm, chống trùng bằng Redis `zca:synced_media:<threadId>`; không OCR, không gọi AI |
| **L1 – Gọi trực tiếp** | **Nhóm**: có `@bot`/tên bot, mention bot, hoặc tin bắt đầu bằng một tiền tố của kênh (không phân biệt hoa thường). **Chat riêng 1-1**: mọi tin có chữ. Ảnh/video không kèm chữ không bao giờ tính là gọi bot | Đầy đủ: bootstrap admin, `GrantAccessGuard` (báo từ chối, ghi nhận user chờ duyệt), cooldown có thông báo; tài khoản bot được miễn | Dùng toàn bộ tool, trò chuyện tự do theo `allowAiChat` |
| **Không gọi bot** | Mọi trường hợp còn lại: tin nhóm không mention/tiền tố, media không kèm chữ | Không kiểm tra | **Bỏ qua hoàn toàn**: không gọi AI, không trả lời |

**Vì sao bot chỉ làm khi được gọi?** Trước đây có luồng "L2 – văn bản thụ động": nhóm bật thu chi hoặc lịch thì **mọi** tin chữ của người đã được cấp quyền đều được gửi cho AI để dò xem có khoản chi hay lịch hẹn không. Hệ quả:
- Tốn request: mỗi tin "ok", "haha", "chờ xíu" cũng là một lần gọi Gemini, dù gần như không bao giờ ra tool nào. Nhóm sôi nổi có thể chạm giới hạn rate limit, khiến cả lệnh `@bot` thật cũng lỗi.
- Ghi nhầm: người dùng kể chuyện ("chủ nhật rồi mua đồ bơi 300k") mà không định ghi sổ, bot vẫn tạo thẻ xác nhận.

Giờ nguyên tắc là **người dùng chủ động gọi thì bot mới làm việc**. Ngoại lệ duy nhất là chat riêng 1-1 với tài khoản bot (nhắn riêng cho bot đã là gọi bot) và Zalo Bot chính thức qua webhook (`apps/api/src/zalo/input-processor.service.ts`), vốn là kênh riêng nên không chặn theo mention.

**Ảnh và video ở L1**:
- **Trả lời trích dẫn (quote) một ảnh/video kèm `@bot`**: nếu câu lệnh là yêu cầu lưu (ví dụ "@bot lưu ảnh này lên drive") thì tải lên Drive/Photos; nếu không thì **bắt buộc OCR ảnh** để làm ngữ cảnh rồi mới chuyển cho AI. Ví dụ quote ảnh thực đơn quán rồi gõ "@bot tạo lịch hẹn chiều nay" → AI đọc được tên quán, địa chỉ trong ảnh để điền vào sự kiện.
  - **Vì sao cần lấy URL kỹ**: với ảnh được quote, Zalo không để link ảnh ở cấp ngoài mà nhét trong chuỗi JSON lồng `attach.params.hd`. Trước đây hệ thống chỉ đọc `href` nên bỏ sót ảnh, tin nhắn rơi về luồng text thường và AI tạo sự kiện trống thông tin. Nay `extractQuotedImageUrl` đọc `params.hd` trước, rồi mới tới `href`, `thumb`…; nếu vẫn không thấy link thì log `warn` để dễ truy vết.
  - **Prompt trung tính**: văn bản OCR được gửi kèm nhãn "có thể sai chính tả", không còn gọi là "hoá đơn", nên AI tự chọn tool phù hợp (thu chi, lịch, task, nhắc việc). OCR cắt tối đa 2.000 ký tự. Nếu OCR không đọc được chữ, bot vẫn gửi yêu cầu kèm ghi chú "ảnh không đọc được chữ". Nếu người dùng chỉ tag bot mà không dặn gì, mặc định là "Ghi nhận hóa đơn này".
  - **Kiểm tra log**: mỗi lần chạy có dòng `Quoted image in thread … -> OCR N chars`. Nội dung OCR chỉ in ở mức DEBUG để tránh lộ dữ liệu.
- **Gửi ảnh kèm chú thích có `@bot`**: tách y như trên (lưu, hoặc OCR bắt buộc làm ngữ cảnh). Hai luồng dùng chung `prepareImageOcrContext`; ảnh vẫn được lưu vào Drive như bill để link không chết khi CDN Zalo hết hạn.
- **Ảnh không kèm chữ (nhóm lẫn chat 1-1)**: chỉ sao lưu L3 nếu kênh bật `mediaBackup` + lưu ảnh; không OCR, không hỏi menu. Kênh tắt sao lưu thì ảnh bị bỏ qua.
- **Muốn bot đọc ảnh đã gửi**: reply (quote) ảnh đó và @mention bot hoặc dùng tiền tố (chat 1-1 thì chỉ cần nhắn chữ khi reply). Bot OCR ảnh được quote rồi ghép với nội dung tin để làm nhiệm vụ tiếp theo (luồng quote ở trên).
- **Video có `@bot`**: tải lên Drive/Photos và trả lời tóm tắt.
- Mọi tin của kênh đang lắng nghe được đệm lại (200 tin gần nhất, Redis `zca:buffered_msgs:<threadId>`, 7 ngày) để dùng khi API lịch sử của Zalo không khả dụng.

**Bộ tool đầy đủ ở L1** (`ZALO_TOOL_DEFINITIONS`, gọi qua `LlmService`) gồm 15 tool: `MANAGE_DEBT`, `RECORD_TRANSACTION`, `DELETE_TRANSACTION`, `SET_REMINDER`, `GET_REPORT`, `CREATE_CALENDAR_EVENT`, `LIST_CALENDAR_EVENTS`, `DELETE_CALENDAR_EVENT`, `CREATE_TASK`, `LIST_TASKS`, `COMPLETE_TASK`, `LOGIN_GOOGLE`, `CREATE_PLACE`, `GET_STORAGE_LINKS`, `SEARCH_CHAT_HISTORY`. `SEARCH_CHAT_HISTORY` tra lại chuyện cũ trong chính kênh đang hỏi, xem [Trí nhớ hội thoại](chat-memory.md).

**Vì sao `edit <mã>` bị giới hạn?** Lệnh `edit` chạy trước mọi guard. Trước đây nó còn gửi đủ tool cho AI, nên ai trong nhóm cũng có thể "sửa" một thẻ chờ thành yêu cầu khác (ví dụ lấy link Drive). Giờ:
- Người không có quyền gõ `edit` thì bị bỏ qua im lặng; thẻ chờ **không** bị thu hồi hay xoá.
- AI chỉ được gọi lại đúng tool của thao tác gốc. Muốn đổi sang loại thao tác khác thì `cancel <mã>` rồi nhắn lại.
- Thao tác không ứng với tool (ví dụ cấm user) không chỉnh sửa được; bot sẽ hướng dẫn hủy và tạo lại.

**Cách đặt tiền tố trên dashboard**: mở `ThreadConfigModal` của kênh → mục "Tương tác Bot trực tiếp" → ô "Tiền tố gọi bot nhanh". Gõ tiền tố rồi nhấn Enter (hoặc dấu phẩy, hoặc nút "Thêm"); bấm × để xoá. Ô báo lỗi ngay nếu tiền tố có dấu cách, quá 20 ký tự, trùng (không phân biệt hoa thường) hoặc đã đủ 10 cái. Nếu đặt tiền tố `/`, modal cảnh báo vì `/dashboard` sẽ bị cắt thành `dashboard`. Khi tin khớp nhiều tiền tố, tiền tố dài nhất được ưu tiên (`bot:` thắng `b`). Logic kiểm tra dùng chung giữa API và web nằm trong `packages/contracts` (`validateTriggerPrefix`, `normalizeTriggerPrefixes`, `findTriggerPrefix`).

## 1b. Nhận Biết Nhóm Hay Cá Nhân

- ID nhóm của ZCA là chuỗi số thuần, trông giống hệt UID người dùng. Chỉ ID cũ của Bot API mới có tiền tố `g-` / `group_`. Vì thế **không được** đoán loại kênh bằng tiền tố hay độ dài ID.
- Dùng `ThreadConfigService.isGroupThread(id)`. Hàm này đọc `threadType` đã lưu theo thứ tự memory → Redis → DB, không tạo config mới, và chỉ dùng tiền tố cũ khi không có dữ liệu nào.
- Khi lưu thông tin thư mục Drive (lệnh `/drive`, `@bot share <email>`, API share/folder-link của dashboard):
  - nhóm → chỉ lưu vào cấu hình thread;
  - cá nhân → chỉ lưu vào user.
  - Đây là nguyên nhân trước đây ID nhóm lọt vào trang Users với trạng thái "Chờ phê duyệt".
- `isGroupThread` chỉ đúng khi `threadType` được **lưu đúng**. Trước đây config mặc định được tạo mà không biết loại kênh, nên hàm `createDefaultThreadConfig` phải đoán bằng tiền tố. Kết quả là nhóm ZCA (ID số) bị lưu thành `user`. Hệ quả: `/drive` và share Drive không lưu link vào thread config, `users:cleanup-groups` bỏ sót nhóm, và đồng bộ media lịch sử từ chối nhóm. Cách sửa:
  - Nơi nào biết loại kênh từ zca-js thì truyền vào `getConfig(id, { threadType })`: `onMessage` (lấy từ `message.type`), `onReaction` (lấy từ `reaction.isGroup`), và thao tác bật/tắt lắng nghe trên dashboard. Thao tác này lấy loại kênh từ danh sách nhóm/bạn bè mà ZCA trả về. Mục dự phòng "Cuộc trò chuyện <id>" chỉ là đoán nên bị bỏ qua.
  - Nếu config đã lưu sai loại kênh, `getConfig` sẽ ghi đè bằng loại kênh mới nhận và lưu lại vào DB + Redis. Số tim xác nhận đã cấu hình được giữ nguyên.
  - Dữ liệu cũ tự được sửa: mỗi lần `getAvailableThreads` tải danh sách mới từ ZCA, hàm này chạy ngầm `reconcileThreadTypes`. Hàm chỉ sửa config đã có, không tạo config mới.
- **Vì sao không dùng migration?** Trong DB, ID nhóm và UID người dùng đều là chuỗi số, nên SQL không phân biệt được; chỉ ZCA biết ID nào là nhóm. Script `users:cleanup-groups` cũng không tự đăng nhập ZCA, vì làm vậy sẽ mở thêm một WebSocket và có thể làm rớt phiên của server.
- **Sau khi deploy:** mở trang **Zalo & Người dùng** (danh sách thread) hoặc bấm **Đồng bộ thông tin** ít nhất một lần, để các dòng `thread_type` sai được sửa. Sau đó mới chạy `npm run users:cleanup-groups --workspace @zalobot/api` (dry-run trước, rồi thêm `-- --apply`).

## 1c. Thả Tim / Phẫn Nộ & Sao Lưu Media Lịch Sử

- **Reaction** chỉ được xử lý khi kênh đang lắng nghe **và** bật `allowReactions`. Bot đọc `gMsgID`/`cMsgID` từ `rMsg` để biết reaction thuộc thẻ chờ nào. ❤️ cộng dồn tới `requiredHearts` (bot báo "❤️ x/y"), 😡 huỷ thao tác. **Chỉ reaction đặt đúng lên thẻ chờ mới được tính** (khớp `msgId` hoặc `cliMsgId` của thẻ, cùng kênh, còn hạn). Trước đây nếu không khớp, hệ thống lấy luôn thẻ chờ gần nhất của nhóm/người dùng. Hậu quả là thả tim vào một tin bất kỳ (ví dụ tin "🎉 đã xác nhận" của yêu cầu trước) lại duyệt nhầm một yêu cầu khác, rồi còn thu hồi luôn tin vừa được thả tim. Trong nhóm đông người, điều này cho phép duyệt hoặc huỷ giao dịch ngoài ý muốn, nên cơ chế fallback đã bị bỏ. Mỗi thẻ chờ chép `requiredHearts` từ cấu hình kênh lúc tạo thẻ, nên đổi cấu hình sau đó không ảnh hưởng thẻ đang mở.
- **Sao lưu media lịch sử** (`POST /api/zca/threads/:threadId/sync-media`, mở từ nút Sao lưu → `SyncMediaModal`):
  - Chọn khoảng thời gian (`1_month`, `2_months`, `3_months`, `6_months`, `all`) và loại media (ảnh, video, file, âm thanh). Tối đa 500 tin mỗi lần.
  - Chỉ hỗ trợ **nhóm**; chat 1-1 trả về thông báo và số đếm 0. ZCA phải đang đăng nhập.
  - Nếu API đọc lịch sử nhóm của Zalo lỗi, hệ thống dùng tin đã đệm trong Redis; không có thì trả cảnh báo `zalo_history_api_unavailable` (sao lưu thời gian thực vẫn chạy bình thường).
  - Media đã sao lưu trước đó được bỏ qua để không trùng.

## 2. Giao Diện Quản Trị Web (`apps/web/src/modules/zca`)

Trang này có tên **"Zalo & Người dùng"** (đường dẫn `/zca`). Trang **Người dùng** (`/users`) cũ đã bị xoá và gộp hẳn vào đây.

### Vì sao gộp?

Với chat 1-1, một dòng "Cá nhân" trên ZCA và một dòng trong bảng `users` là **cùng một người Zalo** (`thread.id === users.id`). Trước đây admin phải sang trang ZCA để bật lắng nghe, rồi sang trang Users để cấp quyền, và trang này không thấy trạng thái của trang kia. Bây giờ mỗi dòng có cả hai.

### Hai lớp kiểm soát (cố ý để độc lập)

| Cột | Ý nghĩa | Lưu ở đâu |
| --- | --- | --- |
| **Lắng nghe** | Bot có nhận tin nhắn từ cuộc trò chuyện này không | `zca_thread_configs.is_listened` |
| **Quyền tương tác** | Người này có được dùng tính năng của bot (thu chi, lịch, Drive…) không | `users.grant_access` và `users.role` |

Bật lắng nghe **không** tự cấp quyền, và ngược lại. Ví dụ: bật lắng nghe một nhóm 10 người, nhưng chỉ người nào đã được cấp quyền mới dùng được lệnh.

### Ba loại dòng

- **👥 Nhóm**: chỉ có cột Lắng nghe. Quyền được cấp cho từng người, không cấp cho nhóm.
- **👤 Cá nhân**: bạn bè ZCA. Nếu người này chưa có trong `users`, cột quyền hiện "Chưa cấp". Bấm **Cấp quyền** thì backend tự tạo bản ghi `users`.
- **🆔 Người dùng**: có trong `users` nhưng không có trong danh bạ ZCA, ví dụ ID của Zalo Bot chính thức (hex 20 ký tự) hoặc thành viên nhóm chưa kết bạn. Các dòng này vẫn hiện khi chưa đăng nhập ZCA, nên admin luôn duyệt được người mới.

Logic ghép dòng là hàm thuần trong `model/chat-rows.ts`, có unit test ở `chat-rows.spec.ts`. "Chờ duyệt" tương ứng `grantAccess = 0` trong DB.

### Cách duyệt người mới

1. Người dùng nhắn bot, bot trả lời "chưa được cấp quyền" kèm User ID của họ.
2. Admin mở **Zalo & Người dùng**, bấm thẻ **Quyền tương tác** (hoặc bộ lọc **Chờ duyệt**).
3. Bấm **Cấp quyền ✓** trên dòng của người đó.

### Thành phần màn hình

- **`ZcaScreen` (`view/zca-screen.tsx`)**: header (làm mới, đăng nhập QR / đăng xuất), 4 thẻ tổng quan (kết nối, số đang lắng nghe, số chờ duyệt, tổng số dòng), thanh công cụ ("Đồng bộ thông tin" lấy tên/avatar/SĐT từ danh bạ ZCA; "+ Thêm người dùng"; link kho Drive gốc), ô nhập ID để bật lắng nghe thủ công, tìm kiếm (không dấu), sắp xếp, bộ lọc và phân trang.
- **Modal đăng nhập QR**: tự nạp mã QR, polling trạng thái và tự đóng khi đăng nhập thành công.
- **`ChatTableRow` (`presentation/components/chat-table-row.tsx`)**: một dòng của bảng. Bấm vào nhãn "Đang lắng nghe / Bỏ qua" để bật/tắt lắng nghe; nút Cấp quyền / Thu hồi (thu hồi Admin phải xác nhận); nút Sao lưu lịch sử (nhóm, mở `SyncMediaModal`), link Drive, link album Google Photos và nút Cấu hình. Link Drive/Photos dùng URL đã lưu trong cấu hình; chưa có thì trỏ tới `/api/drive/open` hoặc `/api/photos/open` để backend tạo và chuyển hướng.
- **Menu "⋯" (`chat-row-menu.tsx`)**: Sửa thông tin & vai trò, Gộp tài khoản trùng, Xem người liên quan đã gắn, Xoá người dùng (không áp dụng cho Admin).
- **Badge "🔗 N người liên quan"** cạnh tên người dùng: hiện khi tài khoản đang được gắn với ít nhất một Người liên quan trong danh bạ công nợ. Bấm vào để mở dialog liệt kê (xem tài liệu module users). Nhờ badge này, trang ZCA và trang Người liên quan nối được với nhau theo cả hai chiều.
- **`UserFormDialog` (`user-form-dialog.tsx`)**: thêm mới hoặc sửa tên, SĐT, vai trò của người dùng.
- **`SyncMediaModal` (`view/sync-media-modal.tsx`)**: chọn khoảng thời gian và loại media để sao lưu lịch sử nhóm.
- **Modal Cấu hình Kênh (`ThreadConfigModal`)**:
  - Lắng nghe kênh.
  - Tương tác trực tiếp: bật/tắt, ghi chú quy tắc gọi bot (nhóm cần @mention/tiền tố, chat riêng thì không), cho phép trò chuyện AI, xử lý tin của chính bot, ô nhập nhiều tiền tố dạng chip (`presentation/components/trigger-prefix-input.tsx`).
  - Sao lưu media: bật/tắt, chọn loại (ảnh, video, file, âm thanh), thông báo trong nhóm, thư mục Drive tuỳ chỉnh, hậu tố file, tên album Photos.
  - Quy tắc xác nhận: thả tim, số tim tối thiểu, thời gian timeout (phút).
  - Link thư mục Drive và album Photos của kênh.

- Modal QR đăng nhập, `ThreadConfigModal`, `SyncMediaModal`, `UserFormDialog`: Dialog dùng khung `Modal` dùng chung: trên mobile là bottom-sheet, tiêu đề và nút hành động luôn nằm trên bàn phím ảo. Chi tiết xem [web-ui-direction](../../global/web-ui-direction.md#modal-trên-mobile--bàn-phím-ảo). `ThreadConfigModal` bỏ giới hạn `75vh` riêng của form, giờ cả panel cuộn.

## 3. Các Endpoint API

`ZcaController` (`/api/zca`):

| Phương thức | Đường dẫn | Ý nghĩa |
| --- | --- | --- |
| GET | `/api/zca/status` | Trạng thái đăng nhập, ID tài khoản, listener, số thread lắng nghe, proxy, trạng thái QR |
| GET | `/api/zca/qr` | Ảnh PNG của mã QR mới nhất |
| POST | `/api/zca/login-qr` | Bắt đầu đăng nhập QR (`forceNew` tuỳ chọn), trả `qrUrl` và mã |
| POST | `/api/zca/logout` | Đăng xuất và xoá phiên |
| GET | `/api/zca/threads` | Danh sách nhóm và bạn bè (`?refresh=true` để tải mới) |
| GET | `/api/zca/listened-threads` | ID các thread đang lắng nghe |
| PUT | `/api/zca/listened-threads` | Thay toàn bộ danh sách lắng nghe |
| POST | `/api/zca/listened-threads/toggle` | Bật/tắt lắng nghe một thread |
| GET | `/api/zca/thread-configs` | Tất cả cấu hình |
| GET | `/api/zca/thread-configs/:threadId` | Cấu hình một thread (chưa có thì tạo mặc định và lưu) |
| PUT | `/api/zca/thread-configs/:threadId` | Cập nhật cấu hình (`UpdateThreadBotConfigDto`) |
| POST | `/api/zca/threads/:threadId/sync-media` | Sao lưu media lịch sử của nhóm |

Link Google dùng trên trang (thuộc `GoogleResourcesController`): `GET /api/drive/folder-link`, `GET /api/drive/open`, `POST /api/drive/share`, `GET /api/photos/album-link`, `GET /api/photos/open`.

### Link Drive/Photos cố định theo kênh

**Vấn đề trước đây:** link 📁 Drive / 📸 Photos trong bảng lúc mở thư mục này, lúc mở thư mục khác. Nguyên nhân là nhiều nơi cùng ghi đè link đã lưu: mỗi lần bot sao lưu ảnh/video/file lại lưu **thư mục con của file vừa upload** (ví dụ `zalobot/<id>/image/2026-10`, sang tháng hoặc đổi loại file là đổi), còn lệnh `@bot share` / lấy link kho lại lưu `zalobot/<channelId>` và bỏ qua thư mục tuỳ chỉnh (`customFolder`) mà nhóm thực sự đang dùng. Album Photos cũng vậy: chỗ upload và chỗ mở link chọn tên album theo thứ tự khác nhau.

**Quy tắc hiện tại:**

- Mỗi kênh chỉ có **một thư mục gốc**: `customFolder` nếu admin đã đặt, ngược lại là `zalobot/<channelId>`. File vẫn được xếp vào thư mục con theo loại/tháng bên dưới, nhưng link luôn trỏ vào thư mục gốc để người dùng thấy toàn bộ.
- Mỗi kênh chỉ có **một album**: tên album tuỳ chỉnh (`photosAlbum`) → album đã lưu → `[Zalo] <tên nhóm>`. Upload và link dùng chung quy tắc này.
- Backend chặn tại một chỗ: `saveDriveFolderInfo` từ chối lưu thư mục không phải gốc, `savePhotosAlbumInfo` từ chối album khác album của kênh.
- Khi admin đổi thư mục tuỳ chỉnh hoặc tên album trong **Cấu hình**, link cũ tự bị xoá; lần bấm mở tiếp theo backend tìm lại đúng thư mục/album rồi lưu.
- Dữ liệu cũ đã lưu sai **không cần migration**: khi đọc cấu hình, link lệch gốc bị bỏ qua, web rơi về `/api/drive/open` / `/api/photos/open`, và endpoint này lưu lại link đúng.

**Khi phát triển thêm:** đừng gọi `saveDriveFolderInfo` với thư mục trả về từ upload; muốn lấy thư mục gốc hãy dùng `getThreadDriveRoot(config)` / `resolveChannelDriveRoot(channelId)`, và tên album dùng `getThreadPhotosAlbumTitle(config)`. Phía web dùng `getThreadDriveFolderLabel` / `getThreadPhotosAlbumLabel` để hiển thị.

### Phân quyền

Mọi route của `ZcaController` và 5 route Drive/Photos ở trên đều **chỉ dành cho admin**: request phải mang access token dashboard (`Authorization: Bearer`, web tự gắn qua `httpClient`) và người dùng phải là admin. Thiếu hoặc sai token thì trả **401**, có token nhưng không phải admin thì trả **403**.

**Vì sao phải chặn chặt?** Các route này đăng nhập/đăng xuất tài khoản Zalo cá nhân của bot và đổi nhóm nào được bot lắng nghe. Riêng `GET /api/zca/status` trả về `qrStatus.code`, tức chính nội dung mã QR. Nếu để mở, người ngoài có thể quét mã QR khi admin đang đăng nhập và chiếm phiên ZCA của bot.

**Ngoại lệ cho link mở bằng trình duyệt** (`<img>` hoặc `<a href>` không gửi được header):
- `GET /api/zca/qr` chấp nhận một trong ba: `?key=<khóa QR>`, Bearer token admin, hoặc cookie `reports_refresh` của admin.
  - **Khóa QR** là chuỗi ngẫu nhiên 32 byte, sinh mỗi khi bắt đầu một luồng đăng nhập QR mới và bị thu hồi khi luồng kết thúc (thành công hoặc lỗi) hoặc khi logout.
  - Link bot gửi qua Zalo khi gõ `/zalo-login` và `qrUrl` trả về từ `POST /api/zca/login-qr` đều kèm `?key=…`, nên người nhận link mở được ảnh QR trên điện thoại mà không cần đăng nhập dashboard. Log server không in khóa.
  - Ảnh QR trên dashboard dùng `getZcaQrImageUrl()` (dựa trên `API_ROUTES.zcaQr`) và xác thực bằng cookie.
- `GET /api/drive/open` và `GET /api/photos/open` (link "📁 Drive ↗", "📸 Photos ↗") nhận Bearer hoặc cookie `reports_refresh` của admin.

**Xử lý sự cố**: trang Zalo & Người dùng báo 403 nghĩa là tài khoản đang đăng nhập dashboard không phải admin. Link QR trong Zalo báo 401 nghĩa là luồng đăng nhập đó đã kết thúc; hãy gõ lại `/zalo-login` để lấy link mới.

Contracts liên quan trong `packages/contracts`: `ThreadBotConfig`, `UpdateThreadBotConfigDto`, `ThreadDirectInteractionConfig`, `ThreadMediaBackupConfig`, `ThreadExpenseConfig`, `ThreadCalendarConfig`, `ThreadConfirmationConfig`, `SyncThreadMediaDto`, `SyncMediaTimeRange`, `SyncThreadMediaResponse`.

## 4. Biến Môi Trường ZCA

Trí nhớ hội thoại dùng thêm `CHAT_MEMORY_ENABLED`, `CHAT_MEMORY_CONTEXT_WINDOW`, `CHAT_MEMORY_SEARCH_LIMIT`, `MEMORY_LLM_BASE_URL`, `MEMORY_LLM_MODEL`, `MEMORY_LLM_API_KEY`; cách bật và lý do nằm ở [Trí nhớ hội thoại](chat-memory.md).

`DATA_DIR`/`ZCA_DATA_DIR` (nơi lưu file phiên), `ZCA_PROXY_URL`, `ZCA_IMEI`, `ZCA_COOKIE`, `ZCA_USER_AGENT`, `ZCA_LANGUAGE`, `ZCA_SELF_LISTEN`, `ZCA_CHECK_UPDATE`, `ZCA_LOGGING`, `ZCA_AUTO_LOGIN`, `ZCA_ENABLE_WELCOME`, `ZCA_WELCOME_IMAGE_PATH` (đọc trong `apps/api/src/config/configuration.ts`).

## 5. Kiểm Thử

- Chạy `npm run test --workspace @zalobot/api` để chạy unit test cho ZCA service, thread config service, controller, chào mừng nhóm và ảnh chờ. Các luồng L1/L3, quy tắc chỉ xử lý khi được gọi (kể cả nhiều tiền tố) và chặn `edit` được kiểm tra trong `apps/api/src/zca/zca-bot-feature.service.spec.ts`; chuẩn hoá tiền tố trong `thread-config.service.spec.ts` và `bot-mention.util.spec.ts`.
- Test web: `apps/web/src/modules/zca/model/chat-rows.spec.ts`, `api/zca-drive-link.spec.ts`, `api/zca-sync-media.spec.ts`.
- Thử tay trong nhóm test: user chưa cấp quyền gõ `ăn trưa 45k` hoặc `@drive` → bot im lặng; gửi ảnh → vẫn được sao lưu. User đã cấp quyền gõ `ăn trưa 45k` → hiện thẻ xác nhận; `@bot /drive` → trả link và **không** sinh user mới trong bảng người dùng.
- Chạy `npm run typecheck` và `npm run lint` để kiểm tra an toàn kiểu dữ liệu.
