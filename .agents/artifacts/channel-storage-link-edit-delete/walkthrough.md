# Walkthrough: Sửa / xoá từng link trong hộp thoại Drive/Photos

Plan đã duyệt: [implementation_plan.md](implementation_plan.md).

## Đã làm

- **Sửa layout (mục 0 của plan)**: `ThreadStorageLinksDialog` render qua `createPortal(…, document.body)`. Docs ghi thành quy tắc: hộp thoại mở từ một dòng của bảng phải dùng portal.
- **DB**: migration mới `1724840000000-AddDisplayNameToChannelStorageLinks` (cột `display_name`) và field `displayName` trong entity.
- **Contracts**:
  - `ChannelStorageLink.id`, `ChannelStorageLink.displayName`.
  - `UpdateChannelStorageLinkDto`, `validateChannelStorageLinkUpdate`, `CHANNEL_STORAGE_LINK_LIMITS`, `CHANNEL_STORAGE_LINK_HOSTS`.
  - `API_ROUTES.zcaThreadStorageLink` và i18n `zca.storageLinks.*` (vi/en).
- **API**:
  - `ChannelStorageLinkService.findLinkGroup / updateLinkGroup / removeLinkGroup`, ghi qua entity save/remove để có audit log.
  - Mapper: thêm `id`, `displayName`, và hàm `isCurrentStorageRow` dùng chung cho badge và cho quy tắc chặn.
  - `ZcaController`: thêm `PATCH` và `DELETE /api/zca/threads/:threadId/storage-links/:linkId`, gom phần dùng chung vào helper `resolveCurrentStorage` / `storageLinksResponse`.
- **Web**:
  - `updateThreadStorageLink`, `deleteThreadStorageLink` và 2 mutation; `onSuccess` gọi `setQueryData` bằng danh sách server trả về.
  - Mỗi dòng có tiêu đề là link, kèm nút ✏️ Sửa (form ngay tại dòng, validate ở client) và 🗑️ Xoá (`confirm`). Dòng đang dùng: URL bị khoá và nút xoá bị tắt kèm tooltip.
- **Tài liệu**: `channel-storage.md` (EN/VI) và README zca (EN).

## Điểm khác so với plan

- Plan ghi "xác định đang dùng mà không gọi Google". Thực tế endpoint dùng chung `syncCurrentStorage` với endpoint GET, vì response trả về vẫn phải có cờ `isCurrent`. Nhờ vậy quy tắc chặn luôn khớp với badge "Đang dùng" người dùng nhìn thấy, và cache Drive/Photos đã nóng sẵn từ lúc mở hộp thoại.
- Lỗi validate ở server trả về 400 kèm chuỗi tóm tắt (`field: code`). Thông báo theo từng field chỉ hiện ở web, vì web chạy cùng hàm validate trước khi gửi.
- Test cho hàm validate của contracts nằm trong `apps/api/src/zca/storage/channel-storage-link-update.spec.ts`, vì package contracts không có test runner.
- Trong lúc làm, commit `c517b91` (bảng Zalo & Users gọn lại mỗi ô một dòng, Drive/Photos chuyển vào menu "⋯") đã vào `main`. Commit này không đụng tới các file của task này; hộp thoại vẫn mở từ bên trong dòng của bảng nên portal vẫn cần.

## Kiểm chứng

- `npm run build --workspace @zalobot/contracts` và lint contracts: OK
- `npm run typecheck` / `lint` cho `api` và `web`: OK
- `npm run test --workspace @zalobot/api`: 475/475 pass (thêm `channel-storage-link-update.spec.ts`, 3 test controller, test `isCurrentStorageRow`, cập nhật test mapper)
- `npm run test --workspace @zalobot/web`: 36/36 pass
- `npm run build --workspace @zalobot/web`: OK
- `node .claude/hooks/docs-drift-check.mjs --all`: PASS

## Chưa kiểm chứng

- Giao diện hộp thoại (cả bản sửa layout lẫn form sửa/xoá) chưa xem trên trình duyệt.
- Migration `1724840000000` chưa chạy trên Postgres thật.
