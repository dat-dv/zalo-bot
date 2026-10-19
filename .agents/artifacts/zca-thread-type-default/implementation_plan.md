# Kế hoạch: Lưu đúng `threadType` cho nhóm ZCA có ID là chuỗi số

- Route: `implement` · Pha 1 (lập kế hoạch) · Mức rủi ro: TRUNG BÌNH (sửa dữ liệu đã lưu trong DB/Redis)
- Nhánh đề xuất: `fix/zca-thread-type-default`, cắt từ `fix/passive-tool-allowlist` (7e7ac7f)

## 1. Bối cảnh & nguyên nhân gốc

`ThreadConfigService.isGroupThread` (từ 7e7ac7f) tin vào `threadType` đã lưu. Nhưng config mặc định được tạo
**không kèm meta** ở nhiều chỗ, nên `createDefaultThreadConfig` phải đoán bằng tiền tố `g-`/`group_`. Group ZCA là
chuỗi số thuần, nên bị lưu `thread_type='user'` vào DB và Redis.

Các chỗ gọi `getConfig` mà không có `threadType` (đã quét toàn bộ `apps/api/src`):

| Vị trí | Có biết loại kênh không? | Ghi chú |
| --- | --- | --- |
| `zca-bot-feature.service.ts:662` `onMessage` | Có, `message.type` | Nêu trong task |
| `zca-bot-feature.service.ts:1206` `onReaction` | Có, `reaction.isGroup` | Hiện đang tính `isGroup` *sau* khi gọi getConfig |
| `zca-bot-feature.service.ts:1259` `syncThreadMediaHistory` | Không | Chỉ đọc. Nếu nhóm bị lưu sai thì hàm này **từ chối** nhóm (`threadType !== 'group'`). Đây là thêm một hậu quả của lỗi |
| `thread-config.service.ts:521/543` `setListened` / `toggleListened` | Không | **Đây là nơi config thường được tạo đầu tiên**: thread phải bật lắng nghe trên dashboard trước khi `onMessage` xử lý. Được gọi từ `ZcaService.setListenedThreadIds` / `toggleListenedThread` |
| `zca.controller.ts:215` GET thread-config | Không | Chỉ đọc |
| `google-resources.controller.ts:127/205` | Chỉ có `threadName` | Chỉ là fallback khi chưa có config, không cần sửa |

=> Chỉ sửa `onMessage` là không đủ: phải sửa cả đường bật lắng nghe từ dashboard.

## 2. Thay đổi đề xuất

### 2.1 `ThreadConfigService.getConfig`: sửa loại kênh sai khi meta cho biết
- Tách logic cập nhật `threadType` ra khỏi điều kiện "đổi `threadName`":
  - `nameChanged = meta.threadName && meta.threadName !== config.threadName`
  - `typeChanged = meta.threadType && meta.threadType !== config.threadType`
  - Nếu có thay đổi: gán giá trị mới, cập nhật `updatedAt`, rồi `saveConfigToDb` + `cacheConfigToRedis` (một lần ghi).
- Quy tắc: khi caller truyền `meta.threadType`, giá trị đó **là nguồn đúng** (lấy từ zca-js `message.type`/`reaction.isGroup`
  hoặc danh sách thread của ZCA). Như vậy sửa được cả hai chiều. Thực tế chỉ có chiều `user → group`, vì ID của bạn bè và nhóm
  không bao giờ trùng nhau.
- Không đổi `confirmationRules.requiredHearts` đã lưu (đó là thiết lập của người dùng). Chỉ sửa `threadType`.
- Thêm `setListened(threadId, isListened, meta?)` và truyền `meta` xuống `getConfig`. `updateConfig` đã nhận `meta`.

### 2.2 `ThreadConfigService.reconcileThreadTypes(threads)` (mới)
- Đầu vào: `ReadonlyArray<{ id: string; type: 'user' | 'group' }>`.
- Với mỗi thread **đã có config** (memory → Redis → DB, giống `isGroupThread`, **không tạo mới**) mà `threadType` khác:
  sửa lại, ghi DB + Redis. Trả về số dòng đã sửa và ghi log.
- Thread chưa có config thì bỏ qua (không tạo dòng rác cho mọi bạn bè/nhóm).

### 2.3 `ZcaBotFeatureService`
- `onMessage`: `getConfig(threadId, { threadType: message.type === ThreadType.Group ? 'group' : 'user' })`.
- `onReaction`: đưa phần tính `isGroup` lên trước và truyền `{ threadType: reaction.isGroup ? 'group' : 'user' }`.
- `syncThreadMediaHistory`: giữ nguyên. Nó sẽ hoạt động đúng khi dữ liệu đã được sửa (mục 2.4).

### 2.4 `ZcaService`
- Thêm helper private `knownThreadKind(id): 'user' | 'group' | undefined`. Helper chỉ đọc `knownThreadTypes` và
  `cachedAvailableThreads`, **không** fallback về thread config, để tránh vòng lặp với dữ liệu sai.
- `setListenedThreadIds` / `toggleListenedThread`: truyền `{ threadType }` (nếu biết) vào `threadConfigService.setListened`.
  Dashboard luôn lấy danh sách từ `getAvailableThreads` trước khi bật lắng nghe, nên cache gần như luôn có dữ liệu.
- `getAvailableThreads`: sau khi fetch mới thành công (bước 3, khi có `this.api` và kết quả khác rỗng), gọi
  `threadConfigService.reconcileThreadTypes(result)` ở chế độ fire-and-forget có `catch` + log, để không làm chậm API danh sách thread.
  Đây là cách tự sửa dữ liệu cũ: lần đầu mở trang ZCA/Users hoặc `syncUsersWithZca` sau khi deploy sẽ sửa các dòng sai.

### 2.5 Sửa dữ liệu đã lưu sai: chọn sửa lúc runtime, KHÔNG dùng migration hoặc script
- **Không dùng migration TypeORM**: trong DB, ID nhóm ZCA và UID người dùng đều là chuỗi số, nên SQL không phân biệt được.
  Chỉ danh sách từ ZCA (`getAllGroups`) mới biết ID nào là nhóm.
- **Không mở rộng `scripts/cleanup-group-users.ts` để gọi `getAvailableThreads`**: script chạy độc lập, không có phiên ZCA
  đang đăng nhập. Nếu đăng nhập lại bằng cookie trong script thì sẽ mở thêm một WebSocket song song với API đang chạy,
  dễ đá phiên ZCA của server.
- **Chọn**: `reconcileThreadTypes` chạy trong process API (mục 2.4), dùng phiên ZCA sẵn có. Script `users:cleanup-groups` giữ nguyên
  (nó đã lọc theo `thread_type='group'`). Chỉ cập nhật comment đầu file và docs: *chạy script sau khi mở trang ZCA hoặc bấm đồng bộ
  Users ít nhất một lần sau khi deploy*, để các dòng `thread_type` đã được sửa trước.

## 3. Test (`tsx --test`, không dùng `any`)

`thread-config.service.spec.ts`:
1. `getConfig('123456789', { threadType: 'group' })` với config chưa có → lưu `'group'` và `requiredHearts` = 5; repo mock nhận `threadType: 'group'`; Redis mock nhận JSON có `'group'`.
2. Config sẵn có `threadType: 'user'` (dữ liệu sai), gọi `getConfig(id, { threadType: 'group' })` mà **không** đổi tên → kết quả `'group'`, đã ghi DB + Redis, và `isGroupThread(id)` trả `true`.
3. `setListened(id, true, { threadType: 'group' })` tạo config `'group'`.
4. `reconcileThreadTypes`: sửa config sai, bỏ qua config đúng, không tạo config cho thread chưa có.

`zca-bot-feature.service.spec.ts`:
5. `onMessage` với `message.type = ThreadType.Group`, `threadId` số thuần, chưa có config → `configService.getConfigSync(id).threadType === 'group'`.
6. Config đã lưu `'user'` cho ID nhóm, `onMessage` với tin nhắn group → config được sửa thành `'group'`.
7. `onReaction` với `isGroup: true` → config `'group'`.

`zca.service.spec.ts` (nếu dựng mock được dễ dàng): `toggleListenedThread` truyền `threadType` lấy từ `cachedAvailableThreads`.

## 4. Tài liệu
- `.agents/knowledge/modules/zca/README.md` (EN), mục "Group vs User Channel Detection": ghi rằng caller nào biết loại kênh thì phải truyền `threadType`; `getConfig` sửa loại kênh sai khi có meta; `reconcileThreadTypes` chạy sau khi `getAvailableThreads` fetch; listen toggle truyền loại kênh.
- `.agents/docs/modules/zca/README.md` (VI), cùng mục: giải thích lỗi, cơ chế tự sửa, thứ tự vận hành sau deploy (mở trang ZCA hoặc đồng bộ Users → chạy `users:cleanup-groups`).
- Bổ sung `depends_on` nếu cần, và cập nhật `.agents/docs/README.md` nếu mục lục thay đổi.

## 5. Kiểm tra
- `npm run typecheck`
- `npm run test --workspace @zalobot/api`
- `npm run lint --workspace @zalobot/api`
- `node .claude/hooks/docs-drift-check.mjs` (phải exit 0)

## 6. Ngoài phạm vi
- `google-resources.controller` chỉ truyền `threadName`. Không sửa vì đó là fallback đọc config.
- Không đổi `ZcaService.resolveThreadType`.
- Không commit hay push khi chưa được yêu cầu.
