# Kế hoạch: Cache danh bạ ZCA (nhóm, bạn bè, biệt danh) vào Redis 7 ngày

- Route: `implement` — Phase 1 (Planning) | Authority: `inspect-and-plan`
- Rủi ro: **MEDIUM** (đổi hành vi cache + contract API `/api/zca/threads`, nhiều file api/web/contracts, không đổi DB schema)

## 1. Hiện trạng (đã kiểm chứng trong code)

Trong toàn bộ `apps/api/src`, các lời gọi ZCA **đọc thông tin** chỉ tập trung ở một chỗ: `ZcaService.getAvailableThreads()` ([zca.service.ts:1111](../../../apps/api/src/zca/zca.service.ts)). Mỗi lần chạy nó gọi:

| Lời gọi ZCA | Số lần / lượt |
| --- | --- |
| `getAllGroups()` | 1 |
| `getGroupInfo(batch)` | ⌈số nhóm / 50⌉ |
| `getAliasList()` | 1 |
| `getAllFriends()` | 1 |

Cache hiện tại: **chỉ in-memory, TTL 3 phút** (`cachedAvailableThreads`, `cachedThreadsExpiresAt`), mất khi restart/deploy.

Ai đang kích hoạt `getAvailableThreads`:

| Nơi gọi | `forceRefresh` | Ghi chú |
| --- | --- | --- |
| `GET /api/zca/threads` (trang `/zca`, `useZcaThreadsQuery`) | `false` | Mỗi lần mở trang sau 3 phút → gọi ZCA |
| `GET /api/zca/threads?refresh=true` (nút **Làm mới** trên `/zca`) | `true` | Đúng ý: gọi thật |
| `UsersService.getUsers()` — dùng bởi `/api/users`, `reports.controller`, tool LLM `users-list`, đồng bộ danh bạ công nợ | `false` | **Điểm nóng**: bot/LLM hỏi danh sách user cũng có thể kéo ZCA |
| `UsersService.syncUsersWithZca()` (nút **Đồng bộ người dùng Zalo**) | `true` | Đúng ý: gọi thật |

Các lời gọi ZCA còn lại đều là **hành động** (`sendMessage`, `undo`, `addReaction`, `deleteMessage`, `sendTypingEvent`...) hoặc theo yêu cầu (`getGroupChatHistory` khi sao lưu lịch sử) → **không cache được / không nên cache**. Phiên đăng nhập (`zca:session`) và `cliMsgId` (`zca:msg:cli:*`) đã nằm trong Redis sẵn.

➡️ Kết luận: "đẩy mọi thứ vào Redis" thực chất là **đưa danh bạ ZCA (nhóm + bạn bè + biệt danh) vào Redis**. Đây là toàn bộ phần đọc thông tin user Zalo có thể cache.

## 2. Đánh giá ý tưởng

Đồng ý với hướng này, kèm 4 điều chỉnh để không phát sinh lỗi mới:

1. **Stale-while-revalidate thay vì xoá cứng sau 7 ngày.** Lưu `fetchedAt`; quá 7 ngày vẫn trả dữ liệu cũ, đồng thời làm mới nền một lần (single-flight). Redis key giữ hard TTL 30 ngày để tự dọn. Nếu dùng TTL cứng 7 ngày, đúng ngày hết hạn mà ZCA lỗi/429 thì danh sách rỗng.
2. **Cache trống (lần đầu đăng nhập / Redis mới) vẫn phải gọi ZCA một lần**, nếu không trang `/zca` và tên user sẽ trống. Lần gọi này chỉ xảy ra khi chưa có snapshot nào.
3. **Không ghi đè bằng kết quả thiếu.** Hiện mỗi phần (nhóm / biệt danh / bạn bè) có `try/catch` riêng; nếu `getAllFriends` lỗi mà nhóm thành công thì cache bị thay bằng danh sách thiếu bạn bè. Với TTL 7 ngày lỗi này sẽ kéo dài cả tuần → phần nào lỗi thì giữ phần đó từ snapshot cũ.
4. **Snapshot gắn theo tài khoản ZCA** (`ownId`) để đăng nhập tài khoản khác không đọc nhầm danh bạ cũ.

## 3. Thiết kế

### 3.1 Redis

- Key: `zca:directory:<ownId>` — JSON:
  ```ts
  interface ZcaDirectorySnapshot {
    fetchedAt: string;              // ISO
    groups: AvailableThread[];      // không lưu isListened
    friends: AvailableThread[];     // đã gộp alias
  }
  ```
- Hằng số trong `zca.constants.ts`: `ZCA_DIRECTORY_SOFT_TTL_SECONDS = 7 * 24 * 3600`, `ZCA_DIRECTORY_HARD_TTL_SECONDS = 30 * 24 * 3600`, `ZCA_DIRECTORY_REFRESH_COOLDOWN_MS = 30_000`.
- Parse bằng type guard (zero-any), snapshot hỏng → coi như cache miss.

### 3.2 Luồng `getAvailableThreads(forceRefresh)`

```
forceRefresh = false:
  memory snapshot có?        → trả (gắn isListened)
  Redis snapshot có?         → nạp vào memory + knownThreadTypes → trả
       └ fetchedAt > 7 ngày? → kích hoạt refresh nền (single-flight), vẫn trả dữ liệu cũ
  không có gì                → fetch ZCA (single-flight), ghi Redis, trả

forceRefresh = true (chỉ từ 2 nút Làm mới / Đồng bộ):
  lần force gần nhất < 30s   → dùng lại kết quả vừa fetch (chống bấm liên tục gây 429)
  ngược lại                  → fetch ZCA, merge theo phần, ghi Redis, trả
```

- Bỏ TTL in-memory 3 phút; memory chỉ là bản sao của snapshot Redis (Redis down → vẫn chạy như cache memory, như hiện tại `RedisService` trả `null`).
- Tách phần fetch hiện tại thành các hàm nhỏ: `fetchGroups()`, `fetchFriendsWithAliases()` trả `{ ok: boolean; threads }` để merge theo phần.
- Mục D (whitelist fallback) và `isListened` vẫn tính lúc đọc, không lưu vào Redis.
- Khi khởi động/đăng nhập lại: nạp snapshot Redis để `resolveThreadType()` có `knownThreadTypes` ngay, không cần gọi ZCA.
- `logout()`: xoá memory + `zca:directory:<ownId>` (giữ đúng ngữ nghĩa "logout dọn cache" hiện tại).

### 3.3 Contract & Web

- `GET /api/zca/threads` trả thêm `fetchedAt: string | null` → `{ data: { threads, fetchedAt } }` (bổ sung, không phá client cũ). Kiểu dùng chung đặt ở `@zalobot/contracts`.
- Trang `/zca`: cạnh nút **Làm mới** hiện "Cập nhật lúc …" (i18n key mới trong catalog vi/en) để người dùng biết dữ liệu có thể cũ tới 7 ngày.
- `useZcaThreadsQuery`: tăng `staleTime` (vd. 10 phút) vì server đã cache; `useRefreshZcaThreadsMutation` giữ nguyên, sau khi **Đồng bộ người dùng Zalo** thành công thì invalidate `zcaQueryKeys.threads()` và danh sách user.

## 4. Các file dự kiến sửa

| File | Thay đổi |
| --- | --- |
| `apps/api/src/zca/zca.constants.ts` | Hằng số TTL / cooldown / key builder |
| `apps/api/src/zca/zca-directory-cache.ts` (mới) | Đọc/ghi/parse snapshot Redis (thuần + type guard), merge theo phần |
| `apps/api/src/zca/zca.service.ts` | Viết lại luồng `getAvailableThreads`, tách fetch, hydrate khi login, xoá khi logout, trả `fetchedAt` |
| `apps/api/src/zca/zca.controller.ts` | Trả `fetchedAt` |
| `packages/contracts/src/index.ts` | Kiểu response threads + i18n key "Cập nhật lúc" (vi/en) |
| `apps/web/src/modules/zca/api/zca-api.ts`, `zca-query.ts` | Đọc `fetchedAt`, chỉnh `staleTime`, invalidate sau sync |
| `apps/web/src/modules/zca/view/zca-screen.tsx` | Hiển thị thời điểm cập nhật cạnh nút Làm mới |
| `apps/api/src/zca/*.spec.ts` | Test (mục 5) |
| `.agents/knowledge/modules/zca/directory-cache.md` + `.agents/docs/modules/zca/directory-cache.md` (mới), cập nhật 2 `README.md` của module + `.agents/docs/README.md` | Tài liệu (Completion Gate) |

`UsersService` **không cần sửa**: nó vẫn gọi `getAvailableThreads(false/true)`, chỉ là giờ `false` đọc Redis.

## 5. Kiểm thử

- Unit test `zca-directory-cache`: parse snapshot hợp lệ/hỏng, merge khi một phần lỗi giữ phần cũ.
- Unit test `ZcaService.getAvailableThreads` (mock `api`, `RedisService`):
  - Redis có snapshot mới → **0** lời gọi ZCA.
  - Snapshot > 7 ngày → trả dữ liệu cũ ngay, đúng 1 lượt refresh nền.
  - Không có snapshot → 1 lượt fetch, ghi Redis.
  - `forceRefresh` → fetch thật; 2 lần trong 30s → chỉ 1 lượt fetch.
  - `getAllFriends` lỗi → bạn bè giữ từ snapshot cũ.
- Chạy: `npm run typecheck`, `npm run lint`, `npm run test` (scope `@zalobot/api`, `@zalobot/web`, `@zalobot/contracts`), `node .claude/hooks/docs-drift-check.mjs`.
- Không kiểm thử được tự động với Zalo thật — cần kiểm tay trên `/zca` sau deploy (mở trang nhiều lần không thấy log gọi ZCA; bấm Làm mới thì có).

## 6. Ngoài phạm vi

- Tự cập nhật snapshot từ sự kiện listener (đổi tên nhóm, thêm bạn) — có thể làm sau.
- Cache `getGroupChatHistory` / các hành động gửi tin.
- Cấu hình TTL qua biến môi trường (để hằng số; thêm env sau nếu cần).

## 7. Câu hỏi cần duyệt

1. Đồng ý **stale-while-revalidate** (quá 7 ngày vẫn trả cũ + làm mới nền) thay cho "hết 7 ngày mới gọi"?
2. Đồng ý cache trống thì **tự gọi ZCA một lần**?
3. Có cần dòng "Cập nhật lúc …" trên trang `/zca` không?
