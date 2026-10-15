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

## 2. Giao Diện Quản Trị Web (`apps/web/src/modules/zca`)

- **Màn hình `ZcaScreen` (`apps/web/src/modules/zca/view/zca-screen.tsx`)**:
  - Header trạng thái kết nối: Hiển thị trạng thái Online/Offline, thông tin tài khoản Zalo (tên, avatar, UID), thời gian phiên và nút mở modal quét mã QR.
  - Modal đăng nhập QR (`loginZcaQr`): Tự động nạp mã QR dạng Base64, có cơ chế polling kiểm tra trạng thái đăng nhập thành công và tự động đóng modal.
  - Bảng danh sách Kênh (Threads Table):
    - Cột thông tin: Avatar, Tên nhóm/người dùng, Thẻ phân loại (Nhóm / Cá nhân), Thread ID kèm nút sao chép 1-click.
    - Trạng thái Lắng nghe: Badge và công tắc bật/tắt lắng nghe tức thì (`toggleZcaListenedThread`).
    - Trạng thái Tương tác & Sao lưu: Badge hiển thị yêu cầu `@bot` hoặc Direct, các icon trạng thái sao lưu Ảnh/Video/File/Voice.
    - Nút mở thư mục Google Drive trực tiếp nếu đã được tạo.
    - Nút Cài đặt mở `ThreadConfigModal`.
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

- Chạy `npm run test --workspace @zalobot/api` để chạy toàn bộ unit tests cho ZCA service và thread config service.
- Chạy `npm run typecheck` và `npm run lint` để kiểm tra an toàn kiểu dữ liệu.
