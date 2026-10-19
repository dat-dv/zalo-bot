---
metadata:
  agent-artifact:
    id: docs-module-zca
    type: documentation
    depends_on:
      - .agents/knowledge/modules/zca/README.md
---

# Module ZCA (Zalo Client Account)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/zca/README.md).

Module `apps/api/src/zca` và `apps/web/src/modules/zca` quản lý việc kết nối tài khoản Zalo cá nhân (`zca-js`), điều phối sự kiện tin nhắn/nhóm/reaction, cấu hình từng kênh (threads) và liên kết kho lưu trữ Google Drive phân vùng.

## 1. Chức Năng Chính Backend (`apps/api/src/zca`)

- **Quản lý kết nối & Phiên WebSocket (`ZcaService`)**:
  - Khởi tạo client `zca-js`, xử lý đăng nhập bằng mã QR (`/zlogin`, `/zca-login`).
  - Hỗ trợ lưu trữ phiên đăng nhập vào Redis (`zca:session:...`) và fallback ra file cục bộ để duy trì trạng thái đăng nhập khi restart server.
  - Tự động bắt cặp `msgId <-> cliMsgId` qua WebSocket echo và sự kiện reaction, lưu cache vào Redis (`zca:msg:cli:*`) với TTL 24h.
  - Cung cấp API thu hồi tin nhắn hai chiều (`undo(payload, threadId)`), tự động bù `cliMsgId` từ Redis/cache để tránh lỗi `"Lỗi không xác định"` từ máy chủ Zalo.
  - Hỗ trợ API xóa tin nhắn `deleteMessage(dest, onlyMe)`, trong đó `onlyMe: true` đóng vai trò fallback dọn dẹp phía bot nếu `undo` bị từ chối.
- **Lắng nghe & Xử lý tin nhắn (`ZcaBotFeatureService`)**:
  - Lắng nghe tin nhắn văn bản, ảnh, video, tệp tin và giọng nói từ cả chat 1-1 và nhóm chat.
  - Nhận diện trigger prefix (mặc định `@bot`).
  - Lắng nghe biểu cảm (Reactions): Trích xuất `cMsgID` (`cliMsgId`) từ mảng `rMsg` để chuyển tiếp chính xác vào `TransactionConfirmationService`. Thả tim (❤️) đạt ngưỡng quy định để xác nhận giao dịch; thả phẫn nộ (😡) để hủy bỏ.
- **Cấu hình theo kênh (`ThreadConfigService` & `ThreadConfigEntity`)**:
  - Lưu trữ cấu hình trong bảng `thread_configs`:
    - `isListened`: Bật/tắt lắng nghe kênh.
    - `directInteraction`: Bật/tắt bot, cấu hình bắt buộc tag `@bot` (`requireMention` - mặc định bật cho chat 1-1), tiền tố kích hoạt.
    - `mediaBackup`: Bật/tắt sao lưu ảnh (`uploadImages`), video (`uploadVideos`), tài liệu (`uploadFiles`), voice (`uploadAudios`), và tùy chọn gửi thông báo vào nhóm (`notifyInThread`).
    - `confirmationRules`: Quy định số lượt tim cần để duyệt (`requiredHearts`), thời gian hết hạn (`timeoutMinutes`).
    - `driveFolderId`, `driveFolderUrl`, `driveFolderPath`: Lưu vết thư mục Google Drive của riêng kênh (`zalobot/<channelId>`).

## 1a. Ba Luồng Xử Lý Tin Nhắn (L1 / L2 / L3)

Nguyên tắc phân vai: **module Users quyết định AI được tương tác với bot**, còn **cấu hình thread quyết định bot làm GÌ trong thread đó**. Mọi tin nhắn đều qua hai cổng chung trước (tin nhắn của chính bot theo `allowSelf`, thread phải đang `isListened`), sau đó rơi vào một trong các luồng:

| Luồng | Khi nào | Kiểm tra quyền user | Bot làm gì |
|---|---|---|---|
| **Thao tác chờ duyệt** | `yes/cancel/edit <mã>`, trả lời ảnh đang chờ | `yes`/`cancel`/thả tim: xác nhận tập thể, ai trong nhóm cũng được. `edit`: chỉ chủ yêu cầu, tài khoản bot hoặc user đã cấp quyền | `edit` chỉ được gọi lại đúng loại thao tác cũ |
| **L3 – Media thụ động** | Ảnh/video/file/voice không tag bot, thread bật `mediaBackup` | Không kiểm tra — kho Drive là của cả nhóm | Tự sao lưu lên Drive/Photos, không OCR, không gọi AI |
| **L1 – Gọi trực tiếp** | Có `@bot`, mention, tiền tố, hoặc thread tắt `requireMention` | Đầy đủ: bootstrap admin, `GrantAccessGuard` (báo từ chối, ghi nhận user chờ duyệt), cooldown có thông báo | Dùng toàn bộ tool, trò chuyện tự do theo `allowAiChat` |
| **L2 – Văn bản thụ động** | Tin nhắn chữ không tag bot, thread bật `expenseTracking` và/hoặc `calendarExtraction` | **Im lặng**: chỉ user đã `granted` (hoặc tài khoản bot); không gửi tin từ chối, không ghi nhận user chờ duyệt | AI chỉ thấy tool trong danh sách cho phép; không có tool nào bật thì không gọi AI; không bao giờ trò chuyện tự do |

**Danh sách tool cho phép ở L2** (`apps/api/src/zalo/text/text-tool.definitions.ts`):
- `expenseTracking` bật → `RECORD_TRANSACTION`, `MANAGE_DEBT`.
- `calendarExtraction` bật → `CREATE_CALENDAR_EVENT`, `SET_REMINDER`.

**Vì sao L2 phải im lặng và giới hạn tool?** Trước đây, tin nhắn không tag bot vẫn được đưa cho AI kèm đủ 14 tool. Ví dụ một thành viên gõ `@drive` trong nhóm, AI hiểu thành `GET_STORAGE_LINKS` và bot trả lời link Drive, dù không ai gọi bot và người gõ chưa được cấp quyền. Giờ AI ở L2 chỉ nhận một system prompt riêng mô tả đúng các tool được phép, và tool ngoài danh sách bị bỏ qua dù AI có trả về. Ở L2 bot cũng không hiện trạng thái "đang soạn tin", để người trong nhóm không thấy bot phản ứng với mọi tin nhắn.

**Vì sao `edit <mã>` bị giới hạn?** Lệnh `edit` chạy trước mọi guard. Trước đây nó còn gửi đủ tool cho AI, nên ai trong nhóm cũng có thể "sửa" một thẻ chờ thành yêu cầu khác (ví dụ lấy link Drive). Giờ:
- Người không có quyền gõ `edit` thì bị bỏ qua im lặng; thẻ chờ **không** bị thu hồi hay xoá.
- AI chỉ được gọi lại đúng tool của thao tác gốc. Muốn đổi sang loại thao tác khác thì `cancel <mã>` rồi nhắn lại.
- Thao tác không ứng với tool (ví dụ cấm user) không chỉnh sửa được; bot sẽ hướng dẫn hủy và tạo lại.

**Đánh đổi đã biết — cooldown ở L2**: L2 dùng chung cooldown 2 giây (in-memory) với L1. Nếu một người gửi hai dòng chi tiêu cách nhau dưới 2 giây, dòng thứ hai bị bỏ qua im lặng. Nếu họ vừa gửi một tin thụ động rồi `@bot` ngay sau đó, bot sẽ báo "gửi quá nhanh". Bỏ cooldown ở L2 chỉ cần sửa `checkPassiveGuards` trong `zca-bot-feature.service.ts`.

**Cách bật/tắt trên dashboard**: mở `ThreadConfigModal` của nhóm và bật "Phân tích & Quản lý thu chi" (`expenseTracking`) và/hoặc "Phân tích tin nhắn tạo lịch hẹn (Calendar)" (`calendarExtraction`). Muốn bot ghi nhận tin của một thành viên ở L2 thì cấp quyền cho người đó ở trang **Zalo & Người dùng** (cột Quyền tương tác).

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

Logic ghép dòng là hàm thuần trong `model/chat-rows.ts`, có unit test ở `chat-rows.spec.ts`.

### Cách duyệt người mới

1. Người dùng nhắn bot, bot trả lời "chưa được cấp quyền" kèm User ID của họ.
2. Admin mở **Zalo & Người dùng**, bấm thẻ **Quyền tương tác** (hoặc bộ lọc **Chờ duyệt**).
3. Bấm **Cấp quyền ✓** trên dòng của người đó.

### Thành phần màn hình

- **`ZcaScreen` (`view/zca-screen.tsx`)**: header (làm mới, đăng nhập QR / đăng xuất), 4 thẻ tổng quan (kết nối, số đang lắng nghe, số chờ duyệt, tổng số dòng), thanh công cụ ("Đồng bộ thông tin" lấy tên/avatar/SĐT từ danh bạ ZCA; "+ Thêm người dùng"; link kho Drive), ô nhập ID để bật lắng nghe thủ công, tìm kiếm (không dấu), sắp xếp, bộ lọc và phân trang.
- **Modal đăng nhập QR**: tự nạp mã QR, polling trạng thái và tự đóng khi đăng nhập thành công.
- **`ChatTableRow` (`presentation/components/chat-table-row.tsx`)**: một dòng của bảng. Bấm vào nhãn "Đang lắng nghe / Bỏ qua" để bật/tắt lắng nghe; nút Cấp quyền / Thu hồi (thu hồi Admin phải xác nhận); các nút Sao lưu (nhóm), Drive và Cấu hình.
- **Menu "⋯" (`chat-row-menu.tsx`)**: Sửa thông tin & vai trò, Gộp tài khoản trùng, Xoá người dùng (không áp dụng cho Admin).
- **`UserFormDialog` (`user-form-dialog.tsx`)**: thêm mới hoặc sửa tên, SĐT, vai trò của người dùng.
- **Modal Cấu hình Kênh (`ThreadConfigModal`)**:
  - Tùy chỉnh tương tác: Tắt/bật bot, yêu cầu mention `@bot`, đổi tiền tố.
  - Cấu hình sao lưu media: Chọn loại media tải lên Drive (Ảnh, Video, File, Âm thanh), thông báo trong thread.
  - Quy tắc xác nhận: Bật/tắt thả tim, đặt số lượng tim tối thiểu, thời gian timeout (phút).
  - Liên kết thư mục Google Drive phân vùng của nhóm.

## 3. Các Endpoint API (`API_ROUTES`)

- `GET /api/zca/status`: Lấy trạng thái kết nối ZCA và thông tin tài khoản.
- `GET /api/zca/login-qr`: Khởi tạo và lấy chuỗi QR đăng nhập.
- `GET /api/zca/threads`: Danh sách toàn bộ các cuộc trò chuyện (nhóm & cá nhân).
- `GET /api/zca/listened-threads`: Danh sách ID các thread đang được lắng nghe.
- `POST /api/zca/listened-threads/toggle`: Bật/tắt lắng nghe 1 thread cụ thể.
- `GET /api/zca/thread-configs`: Lấy danh sách cấu hình của các thread.
- `PATCH /api/zca/thread-configs/:threadId`: Cập nhật cấu hình cho 1 thread.
- `GET /api/drive/folder-link`: Lấy link thư mục Google Drive gốc hoặc channel.

## 4. Kiểm Thử

- Chạy `npm run test --workspace @zalobot/api` để chạy toàn bộ unit tests cho ZCA service và thread config service. Các luồng L1/L2/L3 và chặn `edit` được kiểm tra trong `apps/api/src/zca/zca-bot-feature.service.spec.ts`; danh sách tool thụ động trong `apps/api/src/zalo/text/text-input.service.spec.ts`.
- Thử tay trong nhóm test: user chưa cấp quyền gõ `ăn trưa 45k` hoặc `@drive` → bot im lặng; gửi ảnh → vẫn được sao lưu. User đã cấp quyền gõ `ăn trưa 45k` → hiện thẻ xác nhận; `@bot /drive` → trả link và **không** sinh user mới trong bảng người dùng.
- Chạy `npm run typecheck` và `npm run lint` để kiểm tra an toàn kiểu dữ liệu.
