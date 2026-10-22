# Kế hoạch: API + nút "Xoá" cấu hình kênh trong menu ⋯ (trang `/zca`)

- Route: `implement` — Phase 1 (Planning) | Authority: `inspect-and-plan`
- Rủi ro: **MEDIUM**. Thêm một endpoint xoá dữ liệu (admin), sửa api/web/contracts. Không thêm migration, không đổi schema.
- Bối cảnh: trên prod có 2 dòng `Cuộc trò chuyện 5854445174804412080` và `Cuộc trò chuyện 3362355961559654182`. Đây là kênh vẫn bật lắng nghe nhưng Zalo không còn trả về trong danh bạ, nên `ZcaService.toAvailableThreads` tự chèn dòng giữ chỗ. Hiện không có cách nào xoá bản ghi `zca_thread_configs` của chúng.

## 1. Quyết định thiết kế (đề xuất, cần anh duyệt)

1. **Chỉ xoá cấu hình kênh.** Gồm dòng `zca_thread_configs`, cache Redis `zca:thread_config:<id>`, mục trong set `zca:listened_threads` và danh sách lắng nghe trong RAM của `ZcaService`.
   - **Giữ lại**: trí nhớ hội thoại (`zca_messages`), lịch sử link Drive/Photos (`channel_storage_links`), file trên Google. Đây là lịch sử, và link hoá đơn cũ vẫn cần để xem lại.
2. **Nút chỉ hiện ở dòng mà Zalo không trả về** (dòng giữ chỗ). Với nhóm còn trong danh bạ Zalo, xoá cấu hình xong dòng vẫn hiện lại, cấu hình về mặc định, dễ gây hiểu nhầm là xoá không được. Muốn ngừng xử lý nhóm đang hoạt động thì dùng "Bỏ qua" (tắt lắng nghe) như hiện nay.
   - Server kiểm tra lại cùng quy tắc: id có trong bản lưu danh bạ thì trả **409**, kèm thông báo "Kênh vẫn còn trong danh bạ Zalo, hãy tắt lắng nghe thay vì xoá". Bản lưu danh bạ có thể cũ tới 7 ngày; nếu bị chặn nhầm thì bấm **Làm mới** trước.
3. **Xoá bằng `repository.remove(entity)`**, không dùng `delete()`, để `AuditLogSubscriber.afterRemove` ghi nhật ký kiểm toán kèm dữ liệu trước khi xoá.
4. **Luôn hỏi xác nhận** (`window.confirm`, giống nút xoá người dùng). Thao tác không hoàn tác được, chỉ có nhật ký kiểm toán.

## 2. Hành vi sau khi xoá (đã kiểm tra trong code)

- Dòng biến mất khỏi `/zca`, vì kênh không còn lắng nghe và không có trong danh bạ.
- Nếu kênh đó lại có tin nhắn, `onMessage` gọi `getConfig()`, hàm này tạo lại cấu hình mặc định (`isListened: false`). Bot vẫn bỏ qua tin và dòng không hiện lại. Đây là hành vi sẵn có, không đổi.
- Rủi ro biên: `ThreadConfigService.loadConfigs()` chỉ đọc file cũ `.zca-thread-configs.json` khi bảng DB **rỗng**. Nếu xoá hết mọi cấu hình mà file cũ vẫn còn, lần khởi động sau sẽ nạp lại từ file. Prod còn nhiều cấu hình nên không gặp; em chỉ ghi lại để biết, không xử lý.

## 3. Thay đổi theo file

### API

| File | Thay đổi |
| --- | --- |
| `apps/api/src/zca/thread-config.service.ts` | `deleteConfig(threadId): Promise<boolean>`: tìm trong RAM/DB; không có thì trả `false`. Có thì `remove(entity)`, xoá khỏi `configsMap`, `redis.del('zca:thread_config:<id>')`, `syncListenedThreadsToRedis()`. |
| `apps/api/src/zca/zca.service.ts` | `isInDirectory(threadId): boolean` (tra trong bản lưu danh bạ). `forgetThread(threadId)`: bỏ khỏi `listenedThreadIds` và `knownThreadTypes`, **không** gọi `setListened` vì hàm đó sẽ tạo lại cấu hình. `toAvailableThreads` gắn `missingFromZalo: true` cho dòng giữ chỗ. |
| `apps/api/src/zca/zca-directory-cache.ts` / `AvailableThread` | Thêm trường tuỳ chọn `missingFromZalo?: boolean` vào `AvailableThread`. Không lưu trường này vào Redis. |
| `apps/api/src/zca/zca.controller.ts` | `@Delete('thread-configs/:threadId')`, chỉ admin (`this.admin(req)`). Id có trong danh bạ → 409 `ConflictException`. Không có cấu hình → 404. Thành công → `forgetThread`, trả `{ data: { deleted: true } }`. |

### Contracts

- Dùng lại `API_ROUTES.zcaThreadConfig(threadId)` cho method DELETE, không thêm route mới.
- i18n (vi/en): `zca.threadConfig.delete` ("🗑️ Xoá cấu hình kênh"), `zca.threadConfig.deleteConfirm` (có `{name}`), `zca.threadConfig.deleteSuccess`, `zca.threadConfig.deleteError`, `zca.threadConfig.deleteInDirectory` (thông báo khi bị 409).

### Web

| File | Thay đổi |
| --- | --- |
| `apps/web/src/modules/zca/api/zca-api.ts` | `ZcaThread.missingFromZalo?: boolean`; `deleteZcaThreadConfig(threadId)`. |
| `apps/web/src/modules/zca/api/zca-query.ts` | `useDeleteZcaThreadConfigMutation()`, khi thành công invalidate `threads`, `configs`, `listened`, `status`. |
| `apps/web/src/modules/zca/presentation/components/chat-table-row.tsx` | Prop `onDeleteThread`; thêm mục `tone: 'danger'` vào `threadMenuItems` khi `thread.missingFromZalo`. |
| `apps/web/src/modules/zca/view/zca-screen.tsx` | `handleDeleteThread(row)`: confirm, gọi mutation, hiện thông báo thành công/lỗi (409 → `deleteInDirectory`). |

## 4. Kiểm thử

- `thread-config.service.spec.ts`: `deleteConfig` xoá khỏi RAM, Redis và set lắng nghe, gọi `remove(entity)`; id không tồn tại → `false`.
- `zca.controller.spec.ts`: không phải admin → 403; id còn trong danh bạ → 409; không có cấu hình → 404; thành công → gọi `forgetThread`.
- `zca-directory-cache.spec.ts`: dòng giữ chỗ có `missingFromZalo: true`, dòng từ Zalo thì không.
- Chạy `npm run typecheck`, `npm run lint`, `npm run test`, `node .claude/hooks/docs-drift-check.mjs`.
- Sau khi deploy: xoá 2 dòng giữ chỗ trên prod, kiểm tra chúng biến mất và có bản ghi trong nhật ký kiểm toán.

## 5. Tài liệu (Completion Gate)

- `.agents/knowledge/modules/zca/README.md` (bảng API, menu ⋯) + `directory-cache.md` (trường `missingFromZalo`).
- `.agents/docs/modules/zca/README.md` (VI): khi nào dùng Xoá và khi nào dùng Bỏ qua, những gì bị xoá và những gì được giữ.

## 6. Lưu ý phối hợp

- Repo đang có thay đổi chưa commit của task khác (`zca-thread-config-page`: chuyển modal cấu hình sang trang `/zca/thread`, URL state của bảng; `contact-profile-page`). Task đó đụng `zca-screen.tsx`, `chat-table-row.tsx` và `packages/contracts/src/index.ts`, trùng với kế hoạch này.
- Đề xuất **làm sau khi task kia đã commit**, hoặc anh xác nhận em được sửa chung các file đó. Em sẽ không đụng vào các file mới của task kia (`model/chat-table-url-state.ts`, `model/thread-config-form.ts`).

## 7. Cần anh duyệt

1. Chỉ xoá cấu hình, giữ trí nhớ hội thoại và lịch sử link Drive/Photos?
2. Chỉ hiện nút ở dòng Zalo không trả về (server chặn 409 với kênh còn trong danh bạ)?
3. Làm sau khi task `zca-thread-config-page` đã commit?
