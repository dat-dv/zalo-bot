# Kế hoạch: Cố định link Drive & Photos trong bảng trang /zca

- Route: `implement` · Phase 1 (Planning) · Rủi ro: **MEDIUM** (đổi logic lưu link ở backend, ảnh hưởng dữ liệu đã lưu)
- Giả định: "bị sai" = bấm 📁 Drive / 📸 Photos / nút Drive trong bảng mở **sai thư mục / sai album** (thư mục con theo tháng, hoặc thư mục khác chỗ bot thực sự lưu file). Nếu anh muốn nói lỗi giao diện (cột bị lệch/vỡ layout) thì báo em, plan sẽ đổi.

## 1. Chẩn đoán (bằng chứng từ code)

Bảng đọc `config.driveFolderUrl` / `config.photosAlbumUrl` (`getThreadDriveLink`, `getThreadPhotosLink` trong `apps/web/src/modules/zca/api/zca-api.ts`). Hai trường này bị **nhiều nơi ghi đè với giá trị khác nhau**, nên link "nhảy" theo lần ghi gần nhất:

| Nơi ghi `saveDriveFolderInfo` | Thư mục được lưu |
| --- | --- |
| Upload media (`zca-bot-feature.service.ts` ~741, ~994, ~1501) | **Thư mục lá** của file vừa upload: `zalobot/<channelId>/image/2026-10`, `…/video/2026-10`, hoặc `<customFolder>/2026-10` (do `GoogleDriveService.uploadImage/Video/Document` tự thêm `/<YYYY-MM>`, và `uploadFile` trả `folderId` của thư mục lá) |
| `GET_STORAGE_LINKS`, `SHARE_DRIVE` (Zalo tool) | `zalobot/<channelId>` — **bỏ qua `customFolder`** dù media nhóm đang lưu ở `customFolder` (mặc định `zalobot/<tên nhóm>`) |
| `POST /api/drive/share` | `zalobot/<channelId>` (cũng bỏ qua `customFolder`) |
| `GET /api/drive/open` khi chưa có cache | `driveFolderPath` cũ → `customFolder` → `zalobot/<threadName>` (khác `zalobot/<channelId>`) |

Hệ quả: tuỳ lần cuối là ảnh, video, file, sang tháng mới, hay ai đó gọi "share drive", link trong bảng trỏ tới thư mục khác nhau; tooltip `driveFolderPath` cũng hiện đường dẫn lá (`…/image/2026-10`).

Photos có lỗi tương tự:
- Upload chọn tên album theo thứ tự `mediaBackup.photosAlbum → photosAlbumTitle → [Zalo] <tên nhóm>`, còn `/api/photos/open` chọn `photosAlbumTitle → mediaBackup.photosAlbum → …` (**ngược thứ tự**).
- Khi admin đổi `photosAlbum` hoặc `customFolder` trong `ThreadConfigModal`, `photosAlbumId/Url` và `driveFolderUrl/Path` cũ **không bị xoá** → link vẫn trỏ album/thư mục cũ, và upload vẫn đẩy vào `photosAlbumId` cũ.

## 2. Hướng sửa: một "gốc lưu trữ" duy nhất cho mỗi kênh

Quy tắc bất biến mới:
- **Gốc Drive của kênh** = `mediaBackup.customFolder` (nếu có) ‖ `zalobot/<channelId>`. `driveFolderUrl/Path/Id` chỉ được phép lưu thư mục gốc này, không bao giờ lưu thư mục lá theo loại/tháng.
- **Album Photos của kênh** = `mediaBackup.photosAlbum` ‖ `photosAlbumTitle` đã lưu ‖ `[Zalo] <tên nhóm>` ‖ `[Zalo] Nhóm <channelId>` — dùng chung cho upload và link.
- Đổi `customFolder` / `photosAlbum` ⇒ xoá link đã lưu tương ứng, để lần mở kế tiếp tự resolve lại.

### Backend (`apps/api`)

1. `src/google/channel-storage.util.ts`
   - Thêm `resolveChannelDriveRoot(channelId, customFolder?)` và `resolveChannelPhotosAlbumTitle(channelId, { photosAlbum?, photosAlbumTitle?, threadName? })` (pure functions).
2. `src/zca/thread-config.service.ts`
   - `saveDriveFolderInfo`: chỉ ghi khi `folderPath` == gốc Drive của kênh; khác thì bỏ qua + log debug (chốt chặn duy nhất, mọi caller đều đi qua đây).
   - Hàm map entity → `ThreadBotConfig` (~dòng 123): nếu `driveFolderPath` ≠ gốc hiện tại thì **không trả `driveFolderUrl`** (dữ liệu cũ bị sai tự lành: web rơi về `/api/drive/open`, endpoint này resolve lại đúng gốc và lưu). Tương tự `photosAlbumUrl` khi `photosAlbumTitle` ≠ album hiện tại.
   - `updateConfig` (~dòng 500): khi `mediaBackup.customFolder` đổi → xoá `driveFolderId/Url/Path`; khi `mediaBackup.photosAlbum` đổi → xoá `photosAlbumId/Url/Title`.
3. `src/zca/zca-bot-feature.service.ts` (3 chỗ upload: lưu theo yêu cầu, auto backup, sync lịch sử)
   - Bỏ việc lưu thư mục lá vào `saveDriveFolderInfo`.
   - Tên album dùng `resolveChannelPhotosAlbumTitle`.
4. `src/google/google-resources.controller.ts`
   - `resolveDriveFolderLink`: thư mục = `resolveChannelDriveRoot(channelId, config.mediaBackup.customFolder)`; chỉ dùng `cachedUrl` khi `driveFolderPath` khớp gốc; bỏ nhánh `zalobot/<threadName>`.
   - `resolvePhotosAlbumLink`: dùng `resolveChannelPhotosAlbumTitle`; chỉ dùng `cachedUrl` khi title khớp.
   - `shareDrive`: share đúng gốc của kênh (tôn trọng `customFolder` với nhóm).
5. `src/zalo/text/strategies/get-storage-links-tool.strategy.ts`, `share-drive-tool.strategy.ts`: dùng `resolveChannelDriveRoot` (lấy `customFolder` từ thread config với nhóm) thay vì tự ghép `zalobot/<channelFolder>`.

### Web (`apps/web`)

6. `src/modules/zca/presentation/components/chat-table-row.tsx`: tooltip badge 📁 Drive và nút Drive dùng chung một hàm nhãn (hiện hai chỗ fallback khác nhau: `zalobot/<id>` vs `customFolder`). Không đổi layout cột.
   - Thêm helper `getThreadDriveFolderLabel(thread, config)` cạnh `getThreadDriveLink` trong `api/zca-api.ts`.

Không cần migration: dữ liệu cũ sai được bỏ qua khi đọc và tự ghi lại đúng ở lần mở link đầu tiên.

## 3. Kiểm thử

- Unit test mới/cập nhật:
  - `channel-storage.util.spec.ts`: `resolveChannelDriveRoot`, `resolveChannelPhotosAlbumTitle` (có/không override).
  - `thread-config.service.spec.ts`: `saveDriveFolderInfo` từ chối thư mục lá; config trả về ẩn `driveFolderUrl` lệch gốc; đổi `customFolder`/`photosAlbum` xoá link cũ.
  - `google-resources.controller.spec.ts`: cache lệch gốc bị bỏ qua; dùng `customFolder` làm gốc.
  - `zca-bot-feature.service.spec.ts`: upload không còn gọi `saveDriveFolderInfo` với thư mục lá.
  - `apps/web/.../zca-drive-link.spec.ts`: helper nhãn thư mục.
- Lệnh: `npm run test --workspace @zalobot/api`, `npm run test --workspace @zalobot/web`, `npm run typecheck`, `npm run lint`.
- Không test được thực tế với Google Drive (DB/Google local không chạy) → sẽ báo rõ là chưa verify end-to-end.

## 4. Tài liệu (Hard Completion Gate)

- `.agents/knowledge/modules/zca/README.md` (EN): ghi quy tắc "channel storage root", album resolution, invalidation khi đổi config, bỏ dòng ghi thư mục lá.
- `.agents/docs/modules/zca/README.md` (VI): giải thích vì sao link phải cố định ở thư mục gốc kênh.
- Chạy `node .claude/hooks/docs-drift-check.mjs` phải exit 0.

## 5. Ngoài phạm vi

- Không đổi cấu trúc thư mục upload (`<gốc>/<loại>/<YYYY-MM>` vẫn giữ nguyên).
- Không di chuyển file đã upload trên Google Drive.
- Không đổi luồng lưu link cho người dùng cá nhân trong bảng `users` (`UsersService.saveDriveFolderInfo`) ngoài việc dùng chung hàm resolve gốc.
