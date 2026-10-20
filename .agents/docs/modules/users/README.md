---
metadata:
  agent-artifact:
    id: docs-module-users
    type: documentation
    depends_on:
      - .agents/knowledge/modules/users/README.md
      - apps/api/src/users/users.service.ts
      - apps/api/src/users/users.controller.ts
      - apps/api/src/users/user-merge.service.ts
      - apps/api/src/users/user-merge.service.spec.ts
      - apps/api/src/database/entities/user.entity.ts
      - apps/api/src/google/channel-storage.util.ts
      - apps/api/scripts/cleanup-group-users.ts
      - apps/web/src/modules/users/api/users-api.ts
      - apps/web/src/modules/users/api/users-query.ts
      - apps/web/src/modules/users/presentation/components/merge-user-dialog.tsx
      - apps/web/src/modules/users/presentation/components/linked-contacts-dialog.tsx
      - apps/api/src/users/user-linked-contacts.service.ts
---

# Module Quản Lý Người Dùng (Users Management)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/users/README.md).

Module `apps/api/src/users` và `apps/web/src/modules/users` ghi nhận **ai được tương tác với bot**: danh tính Zalo, vai trò (Admin / User), quyền dùng bot (`grantAccess`), thư mục Google Drive của chat cá nhân và chức năng gộp tài khoản trùng.

## 1. Thực thể người dùng (`UserEntity`, bảng `users`)

| Trường | Ý nghĩa |
| --- | --- |
| `id` | ID Zalo, khoá chính. Đây là danh tính duy nhất của toàn hệ thống |
| `username`, `firstName` | Tên hiển thị (tuỳ chọn) |
| `role` | `admin` hoặc `user` (mặc định `user`) |
| `grantAccess` | Số nguyên: `0` = chưa cấp quyền (mặc định), `1` = đã cấp quyền. Trên giao diện, `0` hiện là "Chờ duyệt"; trong DB **không có** giá trị "pending" riêng |
| `phoneNumber`, `avatarUrl` | Lấy từ dashboard hoặc đồng bộ ZCA |
| `preferredLocale` | Ngôn ngữ ưa thích, mặc định `vi` |
| `timezone` | Mặc định `Asia/Ho_Chi_Minh` |
| `status` | `active` hoặc `suspended`, mặc định `active`. Hiện **chưa có code nào đặt `suspended`** |
| `driveFolderId`, `driveFolderUrl`, `driveFolderPath` | Thư mục Drive của chat cá nhân: `zalobot/<chatId đã làm sạch>` (hàm `getChannelDriveFolderPath` trong `apps/api/src/google/channel-storage.util.ts`). **Không có** tiền tố `u-` |
| `createdAt`, `updatedAt` | Dấu thời gian |

## 2. Phân quyền

- **Admin chỉ lấy từ DB** (`role = admin`): người đầu tiên chat với bot khi hệ thống chưa có admin hoặc người được cấp quyền nào (`bootstrapFirstAdmin`), hoặc người được đặt vai trò trên dashboard. Ngoài ra tài khoản ZCA của chính bot luôn được tạo lại thành admin mỗi khi API khởi động (`refreshMemoryCache`). **Không còn** cấu hình admin qua biến môi trường (`ADMIN_USER_IDS`, `ZALO_ADMIN_ID`…).
- **Kiểm tra quyền** (`isGrantAccess`): admin luôn được phép; nếu không thì đọc cache Redis `whitelist:user:<id>`, thiếu cache thì đọc DB rồi ghi lại cache.
- **Cấp/thu hồi quyền** (`setGrantAccess`): chỉ đổi dòng `users` (tạo mới với vai trò `user` nếu chưa có), cache bộ nhớ và whitelist Redis. Thao tác này **không** đụng tới phiên dashboard hay token Google.
- **Xoá người dùng** (`banUser`): không xoá được admin; với người khác thì xoá hẳn dòng `users` và cache. Không thu hồi token.
- **Chống spam**: mỗi người dùng phải cách nhau 2 giây giữa hai yêu cầu (lưu trong bộ nhớ); admin được miễn.
- Hệ thống **không có** mã mời (invite code).

## 3. Khi nào một user được tạo & dọn user giả là nhóm

Một dòng user chỉ xuất hiện qua các đường sau:
- `registerPendingUser`: người nhắn bot trực tiếp (L1) lần đầu, vào trạng thái chưa cấp quyền.
- `bootstrapFirstAdmin`: người đầu tiên khi hệ thống chưa có admin.
- Admin thêm trên dashboard (`POST /api/users`, mặc định cấp quyền luôn) hoặc bấm **Cấp quyền** cho một người chưa có dòng `users`.
- Tài khoản ZCA của bot khi khởi động, hoặc khi người dùng đổi ngôn ngữ ưa thích.

Các quy tắc đi kèm:
- `saveDriveFolderInfo` **không tự tạo user**. Nếu ID chưa tồn tại, hàm ghi log cảnh báo rồi bỏ qua. Trước đây hàm này tạo user `DENIED` cho bất kỳ ID nào, nên khi bot lưu link Drive của một nhóm ZCA (ID dạng số) thì nhóm đó hiện như một người "Chờ phê duyệt".
- ID nhóm không bao giờ là user. `syncUsersWithZca` chỉ lấy thread `type = 'user'` và chỉ điền avatar, SĐT, tên (khi tên đang trống hoặc chung chung).
- Tin nhắn thụ động (L2) trong nhóm chỉ kiểm tra quyền im lặng, không ghi nhận user chờ duyệt (xem tài liệu module ZCA, mục "Ba luồng xử lý tin nhắn").

**Dọn dữ liệu đã lỡ sinh ra** — script `apps/api/scripts/cleanup-group-users.ts`:

```bash
npm run users:cleanup-groups --workspace @zalobot/api
```

- Mặc định chạy **dry-run**: in bảng các user có ID trùng với thread nhóm trong `zca_thread_configs`, cột `action` cho biết `DELETE` hay `SKIP (lý do)`.
- Script tự bỏ qua admin và mọi ID đã có dữ liệu thật (giao dịch, nơi chốn, công nợ, nhắc nhở, danh mục, token Google, token dashboard). Những dòng này cần xem tay, không tự xoá.
- Sau khi kiểm tra bảng, chạy lại với `-- --apply`. Script xoá trong một transaction (audit log ghi lại từng dòng xoá) và xoá cache Redis `whitelist:user:<id>` nếu có `REDIS_URL`.
- Cần Postgres (`DATABASE_URL` trong `.env.local`/`.env`) đang chạy.

## 4. Gộp Tài Khoản Trùng (Merge)

### Vì sao có tài khoản trùng?

Cùng một người có thể nhắn bot qua 2 kênh, và Zalo cấp **2 ID khác nhau**:

- Kênh **Zalo Bot chính thức (webhook)** cũ: ID theo app, 20 ký tự hex (vd `573462d8909179cf2080`).
- Kênh **ZCA** (tài khoản Zalo cá nhân qua `zca-js`): UID Zalo, dạng số (vd `2285509137317769272`).

`GrantAccessGuard` của ZCA tự lưu mọi ID lạ thành user "Chờ phê duyệt". Vì vậy sau khi chuyển sang ZCA, danh sách người dùng có 2 dòng cho cùng một người, và dữ liệu cũ (giao dịch, công nợ, Google…) vẫn nằm ở ID cũ.

### Quy trình gộp (bắt buộc làm theo thứ tự)

1. Khuyến nghị `pg_dump` database trước khi gộp lần đầu.
2. Vào trang **Zalo & Người dùng**, mở menu **⋯** trên dòng tài khoản **nguồn** (ID cũ, sẽ bị xoá) và chọn **Gộp tài khoản trùng**.
3. Chọn **người dùng đích** (ID sẽ được giữ lại) và kiểm tra bảng xem trước: số dòng sẽ chuyển theo từng loại dữ liệu, số chỗ trùng sẽ được hợp nhất, và kết nối Google nào được giữ.
4. Tích "Tôi hiểu thao tác này không thể hoàn tác" rồi bấm **Gộp tài khoản**.
5. Nếu vừa gộp chính tài khoản đang đăng nhập dashboard, phiên hiện tại sẽ mất quyền. Mở lại dashboard bằng link mà bot gửi qua Zalo.

### Hệ thống làm gì khi gộp

Toàn bộ chạy trong **một transaction**: lỗi ở bất kỳ bước nào thì không có gì thay đổi.

- **Nơi chốn** trùng tên (đã chuẩn hoá): giao dịch được trỏ sang nơi chốn của user đích, bản trùng của user nguồn bị xoá.
- **Người liên quan** trùng tên + biệt danh: khoản nợ và giao dịch được trỏ sang người liên quan của user đích, bản trùng bị xoá. Liên kết `linkedUserId` cũng được đổi sang user đích.
- **Danh mục** trùng tên: bản của user nguồn bị xoá. Giao dịch lưu tên danh mục nên không mất dữ liệu.
- **Giao dịch, khoản nợ, lần trả nợ, phân bổ trả nợ, lời nhắc**: chuyển sang user đích.
- **Kết nối Google**: nếu chỉ một bên có thì giữ bên đó. Nếu cả hai cùng có thì giữ token có refresh token, còn hoà thì giữ token mới hơn.
- **Hồ sơ user đích**: các trường đang trống (tên, SĐT, avatar, thư mục Drive) được lấy từ user nguồn. Giữ quyền Admin và "Đã cấp quyền" nếu một trong hai có. Ngày kết nối lấy ngày sớm hơn.
- Xoá user nguồn và ghi **một** dòng nhật ký kiểm toán mới. Nhật ký cũ giữ nguyên, không bị sửa.
- Sau khi gộp: xoá whitelist Redis của ID nguồn và làm mới cache quyền.

### Xử lý sự cố

- **Nút Gộp bị mờ, có cảnh báo vàng**: tài khoản nguồn là tài khoản ZCA của chính bot. Tài khoản này không gộp được vì luôn được tạo lại khi API khởi động.
- **Lỗi khi gộp**: không có dữ liệu nào bị đổi (transaction đã rollback). Xem log API của `UserMergeService` để biết bước bị lỗi.

## 5. Giao Diện Quản Trị Web

- **Không có trang Người dùng riêng.** Mọi thao tác quản lý người dùng (cấp/thu hồi quyền, thêm, sửa tên/SĐT/vai trò, gộp, xoá, đồng bộ từ ZCA) nằm trên trang **Zalo & Người dùng** (`/zca`). Xem mục 2 trong tài liệu module ZCA.
- Lý do: một người Zalo vừa là cuộc trò chuyện 1-1 trên ZCA, vừa là một dòng trong `users`. Gộp lại giúp admin thấy và đổi cả **lắng nghe** lẫn **quyền tương tác** ở cùng một chỗ.
- Thư mục `apps/web/src/modules/users` chỉ còn:
  - `api/users-api.ts` và `api/users-query.ts`: các hàm gọi API và hook TanStack Query, dùng chung cho trang ZCA, `UserFormDialog` và dialog gộp danh bạ (`contacts`).
  - `presentation/components/merge-user-dialog.tsx`: dialog gộp tài khoản trùng (xem mục 4), mở từ menu **⋯** của trang ZCA.
  - `presentation/components/linked-contacts-dialog.tsx`: dialog **Người liên quan đã gắn**, liệt kê các mục trong danh bạ công nợ (của bất kỳ người dùng nào) đang liên kết với tài khoản này, kèm tên chủ danh bạ và số khoản nợ. Mở bằng badge "🔗 N người liên quan" hoặc menu **⋯**. Dialog này giúp admin trả lời câu hỏi "người này đang có mặt trong sổ nợ của ai" mà không phải mở từng danh bạ. Việc gắn/bỏ gắn thì làm ở trang Người liên quan (xem tài liệu module contacts).
- **Backend và bảng `users` không đổi.** `users.id` vẫn là danh tính của toàn hệ thống: giao dịch, công nợ, nhắc lịch và token Google đều tham chiếu tới nó.

- `MergeUserDialog`: Dialog dùng khung `Modal` dùng chung: trên mobile là bottom-sheet, tiêu đề và nút hành động luôn nằm trên bàn phím ảo. Chi tiết xem [web-ui-direction](../../global/web-ui-direction.md#modal-trên-mobile--bàn-phím-ảo).

## 6. Các Endpoint API (chỉ Admin)

| Phương thức | Đường dẫn | Ý nghĩa |
| --- | --- | --- |
| GET | `/api/users` | Danh sách người dùng, có bổ sung tên/avatar/biệt danh từ ZCA và `linkedContactCount` (số Người liên quan đang gắn, đếm bằng một truy vấn gộp) |
| GET | `/api/users/:id/linked-contacts` | Danh sách Người liên quan (mọi danh bạ) đang liên kết với user `:id` |
| GET | `/api/users/:id` | Một người dùng |
| POST | `/api/users/sync-zca` | Đồng bộ tên, avatar, SĐT từ danh bạ ZCA |
| POST | `/api/users` | Thêm hoặc cập nhật người dùng (mặc định vai trò `user`, đã cấp quyền) |
| PATCH | `/api/users/:id` | Sửa vai trò, quyền, tên, SĐT, avatar |
| PATCH | `/api/users/:id/grant-access` | Cấp (`grantAccess: 1`) hoặc thu hồi quyền |
| GET | `/api/users/:id/merge-preview?targetUserId=` | Xem trước dữ liệu sẽ chuyển khi gộp (chỉ đọc) |
| POST | `/api/users/:id/merge` | Body `{ targetUserId }`: gộp user `:id` vào user đích rồi xoá user `:id` |
| DELETE | `/api/users/:id` | Xoá dòng người dùng (không áp dụng cho admin) |

## 7. Kiểm Thử

- Chạy `npm run test --workspace @zalobot/api`. Test gộp tài khoản ở `apps/api/src/users/user-merge.service.spec.ts`: chọn token Google, chặn tự gộp/ID không tồn tại, xem trước, chuyển dữ liệu và hợp nhất bản trùng, giữ quyền admin, **từ chối khi ID nguồn là tài khoản ZCA của chính bot** ("merge is refused when the source is the bot own ZCA account"), và rollback khi lỗi.
- `users-sync.spec.ts` kiểm tra đồng bộ ZCA (không chép tên nhóm vào user) và việc admin không lấy từ biến môi trường; `users-drive-folder.spec.ts` kiểm tra lưu thư mục Drive không tạo user mới.
- Chạy `npm run typecheck` và `npm run lint`.
