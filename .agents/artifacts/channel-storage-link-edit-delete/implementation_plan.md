# Kế hoạch: Sửa / xoá từng link trong hộp thoại Drive/Photos

- Route: `implement`, Phase 1 (Planning), Authority: `inspect-and-plan`
- Rủi ro: **MEDIUM** (thêm 1 cột DB qua migration mới, 2 endpoint mới, contracts, UI)
- Skills dùng ở Phase 2: `backend`, `backend-bridge-frontend`, `frontend-orchestration`, `tanstack-query`, `enterprise-ui`

## 0. Đã sửa trong lượt này (rủi ro LOW, plan ghi ngay trong câu trả lời)

- **Lỗi**: hộp thoại bị vỡ layout, mô tả không xuống dòng.
- **Nguyên nhân**: `ThreadStorageLinksDialog` được render bên trong ô `<td class="whitespace-nowrap … text-right">` của bảng `/zca`. `<dialog>` dù nằm ở top layer vẫn kế thừa `white-space` và `text-align` từ ô đó.
- **Cách sửa**: render hộp thoại qua `createPortal(…, document.body)` (giống `column-filter-popover.tsx`). Chỉ sửa file `thread-storage-links-dialog.tsx`.
- **Kiểm chứng**: typecheck và lint web đều qua. **Chưa xem trên trình duyệt.**

## 1. Mục tiêu

Trong hộp thoại 📁 Drive / 📸 Photos của một kênh, admin có thể:
1. **Sửa** một link: đặt **tên hiển thị** riêng, sửa **URL**, điền **email tài khoản** (hữu ích cho dòng "Tài khoản cũ").
2. **Xoá** một link khỏi danh sách.

**Xoá chỉ gỡ dòng khỏi lịch sử của dashboard**, không xoá thư mục Drive hay album Photos thật. App chỉ có quyền `drive.file` / `photoslibrary.appendonly`, nên không thể và cũng không nên xoá dữ liệu Google.

## 2. Quy tắc nghiệp vụ (em đề xuất, anh duyệt)

| Quy tắc | Lý do |
| --- | --- |
| **Không xoá được dòng "Đang dùng"** (nút xoá bị tắt, có tooltip giải thích) | Dòng này là nơi media mới đang vào; mở lại hộp thoại là hệ thống ghi lại ngay, xoá cũng vô ích |
| **Dòng "Đang dùng" không sửa được URL**; vẫn sửa được tên hiển thị và email | URL hiện tại do hệ thống quản lý; mỗi lần upload sẽ ghi đè URL đúng |
| Tên hiển thị lưu ở **cột mới `display_name`**, upload/sync **không bao giờ ghi đè** | `label` (đường dẫn thư mục / tên album) là dữ liệu hệ thống, mỗi lần upload sẽ ghi lại |
| URL phải là `https`. Drive: host `drive.google.com`. Photos: `photos.google.com` hoặc `photos.app.goo.gl` | Tránh lưu link rác hay link độc hại; khớp với loại link |
| Tên hiển thị tối đa 120 ký tự, để trống thì quay về `label`. Email phải đúng định dạng, để trống thì về "Tài khoản cũ" | Dữ liệu sạch |
| Một mục trong hộp thoại có thể gộp nhiều dòng DB cùng URL (dòng backfill + dòng có id thật): **sửa/xoá áp dụng cho tất cả các dòng cùng `thread_id + kind + url`** | Người dùng thấy một mục thì thao tác trên đúng một mục đó |
| Xác nhận trước khi xoá bằng `window.confirm` (đúng pattern đang dùng ở `zca-screen.tsx`) | Nhất quán; tránh bấm nhầm |
| Sửa/xoá đi qua `repository.save` / `repository.remove` để `AuditLogSubscriber` ghi **Nhật ký kiểm toán** (trước/sau) | Đúng quy tắc audit của dự án |
| Chỉ admin (như mọi route `ZcaController`) | Giữ nguyên phân quyền |

## 3. Thay đổi chi tiết

### 3.1 Database
- Migration **mới** `1724840000000-AddDisplayNameToChannelStorageLinks`: `ALTER TABLE channel_storage_links ADD COLUMN display_name varchar NULL`. Không sửa migration `1724830000000` vì đã push lên `main`.
- `ChannelStorageLinkEntity`: thêm `displayName?: string | null`.

### 3.2 Contracts (`@zalobot/contracts`)
- `ChannelStorageLink`: thêm `id` (id của dòng đại diện) và `displayName: string | null`.
- `UpdateChannelStorageLinkDto { displayName?: string | null; url?: string; googleEmail?: string | null }`.
- `validateChannelStorageLinkUpdate(kind, dto)` → danh sách lỗi theo field. API và form web dùng chung.
- `API_ROUTES.zcaThreadStorageLink(threadId, linkId)`.
- i18n `zca.storageLinks.*` (vi/en): sửa, xoá, lưu, huỷ, nhãn field, lỗi validate, câu xác nhận xoá, tooltip "không xoá được link đang dùng".

### 3.3 API (`apps/api/src/zca`)
- `ChannelStorageLinkService`:
  - `update(threadId, linkId, dto, guard)`: tìm dòng theo `id` và `thread_id` (không thấy thì 404), lấy các dòng cùng `kind + url`, áp dụng thay đổi rồi `save`.
  - `remove(threadId, linkId, guard)`: tương tự, rồi `remove`.
  - `record()` giữ nguyên, không đụng `display_name`.
- Xác định "đang dùng" mà không gọi Google: dòng có `google_email` = email tài khoản dùng chung hiện tại (`getAccountEmail`, đã cache) **và** `label` = `driveRoot` / `photosAlbumTitle` của kênh. Dòng đang dùng: xoá → 400, sửa URL → 400.
- `ZcaController`:
  - `PATCH /api/zca/threads/:threadId/storage-links/:linkId`
  - `DELETE /api/zca/threads/:threadId/storage-links/:linkId`
  - Cả hai trả về `ChannelStorageLinksResponse` mới nhất, để web cập nhật cache ngay.
- Mapper: điền `id` và `displayName` (ưu tiên giá trị khác rỗng khi gộp).

### 3.4 Web (`apps/web/src/modules/zca`)
- `zca-api.ts`: `updateThreadStorageLink`, `deleteThreadStorageLink`.
- `zca-query.ts`: `useUpdateThreadStorageLinkMutation`, `useDeleteThreadStorageLinkMutation`. `onSuccess` gọi `setQueryData(zcaQueryKeys.storageLinks(threadId), response)`.
- `ThreadStorageLinksDialog` / `StorageLinkRow`:
  - Mỗi dòng: tiêu đề (tên hiển thị, hoặc `label`) là link mở tab mới, kèm hai nút ✏️ Sửa và 🗑️ Xoá. Cả dòng không còn là một thẻ `<a>`, để nút bấm không mở link.
  - Bấm ✏️: dòng chuyển sang form ngay tại chỗ, gồm Tên hiển thị, URL (tắt ở dòng đang dùng) và Email. Có nút Lưu / Huỷ, lỗi hiện ngay dưới field, các nút bị tắt khi đang lưu.
  - Bấm 🗑️: hiện `confirm`; trong lúc xoá, dòng mờ đi; nếu lỗi thì báo lỗi ngay tại dòng.
  - Responsive: trên mobile các field xếp dọc, nút bấm đủ lớn để chạm (≥ 32px). Giữ bo góc nhỏ (`rounded`).

## 4. Kiểm thử

- Contracts: `validateChannelStorageLinkUpdate` (host đúng/sai theo loại, `http`, tên quá dài, email sai, chuỗi rỗng → null).
- API:
  - `ChannelStorageLinkService.update/remove`: áp dụng cho mọi dòng cùng URL, 404 khi sai thread, không đụng `display_name` khi `record()`.
  - `ZcaController`: chỉ admin; chặn xoá dòng đang dùng; chặn sửa URL dòng đang dùng; trả về danh sách mới.
  - Mapper: `id` và `displayName` khi gộp.
- Lệnh: `npm run build --workspace @zalobot/contracts`, `typecheck` / `lint` / `test` cho `api`, `web` và `contracts`, `npm run build --workspace @zalobot/web`, `node .claude/hooks/docs-drift-check.mjs`.
- **Không kiểm chứng tự động được**: thao tác trên trình duyệt thật và migration trên Postgres thật.

## 5. Tài liệu

- `.agents/knowledge/modules/zca/channel-storage.md` (EN) và `.agents/docs/modules/zca/channel-storage.md` (VI): thêm mục sửa/xoá, quy tắc dòng đang dùng, `display_name`, 2 endpoint mới.
- `.agents/knowledge/modules/zca/README.md`: thêm 2 dòng vào bảng API và `API_ROUTES`.

## 6. Ngoài phạm vi

- Thêm link thủ công (tạo mục mới bằng tay).
- Xoá thư mục Drive / album Photos thật trên Google.
- Khôi phục mục đã xoá. Nhật ký kiểm toán vẫn còn dữ liệu cũ nếu cần tra lại.
