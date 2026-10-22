---
metadata:
  agent-artifact:
    id: docs-module-zca-channel-storage
    type: documentation
    depends_on:
      - .agents/knowledge/modules/zca/channel-storage.md
      - apps/api/src/zca/storage/channel-storage-link.service.ts
      - apps/api/src/receipt-storage/media-storage.service.ts
      - apps/api/src/google/google-auth.service.ts
      - apps/api/src/database/migrations/1724830000000-CreateChannelStorageLinks.ts
      - apps/web/src/modules/zca/presentation/components/thread-storage-links-dialog.tsx
---

# Lưu trữ media theo kênh (Drive/Photos)

Tài liệu canonical tương ứng: [`channel-storage.md`](../../../knowledge/modules/zca/channel-storage.md).

## 1. Bài toán

- Ảnh, video, tệp và hoá đơn của mỗi kênh Zalo được lưu lên Google Drive và Google Photos.
- Khi admin **đổi tài khoản Google**, ảnh cũ vẫn nằm ở tài khoản cũ, không bị xoá. Nhưng trước đây mỗi kênh chỉ nhớ được **một** link Drive và **một** album. Đổi tài khoản là link cũ biến mất khỏi dashboard, ảnh hoá đơn cũ cũng không xem được nữa.
- Ngoài ra, ảnh hay bị **lưu sai album**. Có 4 nguyên nhân, đều đã sửa (xem mục 3).

## 2. Hoạt động hiện tại

### 2.1. Một tài khoản lưu trữ dùng chung, cố định

- Mọi media của kênh đều lưu bằng **tài khoản Google dùng chung**, không dùng token Google riêng của thành viên.
- Tài khoản dùng chung được ghim bằng cột `user_tokens.is_shared`. **Chỉ khi admin bấm `/login` và cấp quyền** thì tài khoản dùng chung mới đổi. Việc tự làm mới token mỗi giờ không còn làm đổi tài khoản.
- Mỗi lần đăng nhập, app tạo một OAuth client mới, nên cache ID thư mục/album của tài khoản cũ bị bỏ đi ngay mà không cần khởi động lại API.

### 2.2. Nơi lưu của từng kênh

- **Drive**: thư mục gốc của kênh là `zalobot/<channelId>`, trong đó có `bill`, `image`, `video`, `file`, mỗi thư mục chia tiếp theo tháng `YYYY-MM`. Nếu kênh đặt "thư mục Drive riêng" thì mọi thứ vào thẳng thư mục đó (chia theo tháng).
- **Photos**: **mỗi kênh có một album trên mỗi tài khoản Google**. Hoá đơn, ảnh và video đều vào album này. Tên album: tên album riêng nếu có, nếu không thì `[Zalo] <tên nhóm>`.
- Hàm upload bắt buộc phải nhận "nơi lưu của kênh" (`ChannelStorageTarget`), nên không còn đường upload nào tự rơi vào album mặc định dùng chung.

### 2.3. Lịch sử link (bảng `channel_storage_links`)

- Mỗi lần upload thành công, hệ thống ghi lại thư mục gốc Drive và album Photos, kèm **email tài khoản Google** và thời gian dùng.
- Đổi tài khoản thì có thêm dòng mới; dòng cũ vẫn giữ nguyên.
- Khi chạy migration, link đang lưu trong cấu hình kênh được chép sang bảng này với email để trống (hiển thị là "Tài khoản cũ").

### 2.4. Trên dashboard (`/zca`)

- Ở cột thao tác, mở menu **⋯** rồi chọn mục xem thư mục Google Drive hoặc album Google Photos của kênh. Hộp thoại sẽ liệt kê mọi link của kênh:
  - Dòng **Đang dùng** (viền xanh) là nơi media mới sẽ vào.
  - Mỗi dòng ghi đường dẫn hoặc tên album, email tài khoản và khoảng thời gian dùng.
  - Bấm vào link Drive sẽ mở thẳng thư mục gốc của kênh, thấy ngay `bill`, `image`, `video`.
- Trang cấu hình của kênh (`/zca/thread?id=…`) cũng mở cùng hộp thoại này từ banner Drive/Photos.
- Hộp thoại được render thẳng vào `document.body` qua `createPortal`. Lý do: nó được mở từ một ô trong bảng có `whitespace-nowrap text-right`, và `<dialog>` dù nổi lên trên cùng màn hình vẫn kế thừa các style đó. Trước khi sửa, mô tả bị kéo thành một dòng dài và làm vỡ layout. **Quy tắc:** hộp thoại nào mở từ một dòng của bảng đều phải dùng portal để thoát khỏi ô đó.

### 2.4a. Sửa và xoá link

Mỗi dòng trong hộp thoại có hai nút **✏️ Sửa** và **🗑️ Xoá**.

- **Sửa** (form ngay tại dòng):
  - **Tên hiển thị**: đặt tên dễ nhớ (ví dụ "Kho nhà 2025"). Tên lưu ở cột riêng `display_name`, upload sau **không ghi đè**. Để trống thì quay về đường dẫn thư mục / tên album.
  - **Đường link**: phải là `https`. Link Drive phải thuộc `drive.google.com`; link Photos thuộc `photos.google.com` hoặc `photos.app.goo.gl`. **Dòng đang dùng không sửa được link**, vì mỗi lần upload hệ thống sẽ ghi lại link đúng.
  - **Email tài khoản**: hay dùng để điền cho các dòng "Tài khoản cũ". Để trống thì quay lại là không rõ.
  - Web và API dùng chung một hàm kiểm tra (`validateChannelStorageLinkUpdate` trong contracts), nên lỗi hiện ngay dưới ô nhập mà không cần gọi server.
- **Xoá**: chỉ gỡ dòng khỏi danh sách trên dashboard. **Thư mục hoặc album trên Google vẫn giữ nguyên**, vì app không có quyền xoá và cũng không nên xoá. Có hỏi xác nhận trước khi xoá. **Dòng đang dùng không xoá được**: mở hộp thoại hoặc upload lần sau là hệ thống ghi lại ngay, nên xoá cũng vô ích.
- Một mục trong hộp thoại có thể gồm nhiều dòng trong DB có cùng link (dòng backfill + dòng có id thật). Sửa hoặc xoá sẽ áp dụng cho tất cả các dòng đó.
- Mọi thao tác sửa/xoá đều được ghi vào **nhật ký kiểm toán** (dữ liệu trước/sau).
- API: `PATCH` và `DELETE /api/zca/threads/:threadId/storage-links/:linkId` (chỉ admin), đều trả về danh sách mới để web cập nhật ngay.

### 2.5. Ảnh hoá đơn cũ

- API tải ảnh hoá đơn theo thứ tự: token tài khoản dùng chung → token người tạo giao dịch → **link công khai** của file. File được đặt sẵn quyền "ai có link cũng xem được" ngay khi upload.
- Vì vậy, sau khi đổi tài khoản, ảnh hoá đơn cũ vẫn hiện được. Không hiện được trong hai trường hợp: tài khoản Google cũ đã bị xoá, hoặc Google Workspace chặn chia sẻ công khai.

## 3. Bốn nguyên nhân "lưu sai album" đã sửa

| Nguyên nhân | Cách sửa |
| --- | --- |
| 5 đường upload (ảnh hoá đơn gửi thẳng/quote, video gửi thẳng, ảnh chọn "lưu trữ", tạo bill từ ảnh chờ, video của bot chính thức) không truyền album của kênh nên rơi vào album mặc định chung cho mọi kênh | Upload bắt buộc nhận `ChannelStorageTarget` |
| Tài khoản dùng chung tự nhảy sang token vừa được làm mới (nhiều admin, hoặc một người có hai ID) | Ghim bằng `is_shared`, chỉ đổi khi đăng nhập |
| Tìm album chỉ đọc 50 album đầu, nên tạo album trùng tên | Đọc hết các trang |
| Cache ID thư mục/album gắn với user, không gắn với tài khoản Google | Cache theo OAuth client, và client mới được tạo mỗi lần đăng nhập |

## 4. Vận hành và kiểm tra

- **Đổi tài khoản Google**: admin gõ `/login` trên Zalo, chọn Gmail mới, rồi bấm Cho phép. Không cần khởi động lại API. Media mới sẽ vào Drive/Photos của tài khoản mới; mở dialog Drive/Photos sẽ thấy dòng mới ở trạng thái "Đang dùng", còn dòng cũ vẫn giữ.
- **Migration** `1724830000000-CreateChannelStorageLinks` và `1724840000000-AddDisplayNameToChannelStorageLinks` tự chạy khi API khởi động (`migrationsRun: true`). Rollback: `migration:revert`, mỗi lần gỡ một migration (lần đầu bỏ cột `display_name`, lần sau bỏ bảng `channel_storage_links` và cột `is_shared`); không đụng dữ liệu tài chính.
- Test liên quan: `channel-storage-link-update.spec.ts` (kiểm tra dữ liệu + sửa/xoá theo nhóm), `media-storage.service.spec.ts`, `google-photos.service.spec.ts`, `google-auth.service.spec.ts`, `channel-storage-links.mapper.spec.ts`, `receipt-source.spec.ts`, `zca.controller.spec.ts`.
- Không tự động kiểm chứng được upload thật lên Google và việc đổi tài khoản thật; cần thử trên môi trường thật.
