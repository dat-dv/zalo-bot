# Walkthrough: Cố định link Drive & Photos trang /zca

Thực hiện theo `implementation_plan.md` (đã duyệt).

## Thay đổi

- `apps/api/src/google/channel-storage.util.ts`: `resolveChannelDriveRoot`, `isSameDrivePath`, `resolveChannelPhotosAlbumTitle`.
- `apps/api/src/zca/thread-config.service.ts`: `getThreadDriveRoot`, `getThreadPhotosAlbumTitle`, `withoutStaleStorageLinks` (áp dụng khi load entity/cache và cuối `updateConfig`); `saveDriveFolderInfo` chỉ nhận thư mục gốc, `savePhotosAlbumInfo` chỉ nhận album của kênh.
- `apps/api/src/zca/zca-bot-feature.service.ts`: 3 luồng upload bỏ lưu thư mục con; tên album dùng `getThreadPhotosAlbumTitle`.
- `apps/api/src/google/google-resources.controller.ts`: folder-link/open, album-link/open, share dùng gốc/album chung; cache chỉ dùng khi khớp.
- `apps/api/src/zalo/text/strategies/get-storage-links-tool.strategy.ts`, `share-drive-tool.strategy.ts`: dùng thư mục gốc theo `customFolder`.
- Web `apps/web/src/modules/zca`: `getThreadDriveFolderLabel`, `getThreadPhotosAlbumLabel` dùng cho tooltip/nhãn trong `chat-table-row.tsx`, `thread-config-modal.tsx`, `sync-media-modal.tsx`. Không đổi layout.

## Kiểm tra

- `npm run typecheck`: pass.
- `npm run test --workspace @zalobot/api`: 398/398 pass (có test mới cho util, ThreadConfigService, controller, media sync).
- `npm run test --workspace @zalobot/web`: 32/32 pass.
- `npm run lint`: không phát sinh lỗi mới; còn các lỗi có sẵn từ trước (21 lỗi ở các file API đã sửa, 1 lỗi ở `zca-query.ts`).
- `node .claude/hooks/docs-drift-check.mjs`: PASS.
- Chưa kiểm thử end-to-end với Google Drive/Photos thật (DB và Google local không chạy).

## Còn lại / ngoài phạm vi

- Danh sách link theo từng loại trong `GET_STORAGE_LINKS` (`zalobot/<id>/bill|image|video`, album `ZaloBot - …`) chưa tính `customFolder`/album của nhóm; giữ nguyên theo phạm vi plan.
- Kênh cá nhân: link lưu trong bảng `users` (không phải thread config) nên bảng /zca vẫn luôn đi qua `/api/drive/open` — vẫn đúng thư mục gốc, chỉ là không cache.
