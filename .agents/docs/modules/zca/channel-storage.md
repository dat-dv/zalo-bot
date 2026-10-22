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
- Modal "Cấu hình" của kênh cũng mở cùng hộp thoại này.

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
- **Migration** `1724830000000-CreateChannelStorageLinks` tự chạy khi API khởi động (`migrationsRun: true`). Rollback: `migration:revert` (chỉ xoá bảng mới và cột `is_shared`, không đụng dữ liệu tài chính).
- Test liên quan: `media-storage.service.spec.ts`, `google-photos.service.spec.ts`, `google-auth.service.spec.ts`, `channel-storage-links.mapper.spec.ts`, `receipt-source.spec.ts`, `zca.controller.spec.ts`.
- Không tự động kiểm chứng được upload thật lên Google và việc đổi tài khoản thật; cần thử trên môi trường thật.
