# Implementation plan — Quyền tương tác theo kênh (nhóm ZCA)

- Route: `implement` · Phase 1 (Planning) · Authority: `inspect-and-plan`
- Rủi ro: **HIGH** (thêm cột DB, đổi logic phân quyền bot, thêm endpoint admin)
- Trạng thái: chờ anh duyệt

## 1. Mục tiêu

Admin cấu hình được **ai trong một nhóm Zalo được gọi bot** (qua @mention hoặc tiền tố) ngay trên trang cấu hình kênh `/zca/thread?id=<groupId>`.

Quyền theo kênh **cộng thêm** vào quyền toàn cục, không thay thế:

```
được tương tác = là admin
              || là tài khoản bot (owner / self)
              || policy của kênh cho phép (strategy theo loại kênh)
              || grantAccess = GRANTED (toàn cục, như hiện tại)
```

Chat riêng (1-1) và đường webhook Zalo Bot chính thức giữ nguyên hành vi: chỉ dựa vào quyền toàn cục.

## 2. Hiện trạng (đã khảo sát)

- Tin ZCA vào qua callback `zca-js` → `ZcaBotFeatureService.onMessage` (`apps/api/src/zca/zca-bot-feature.service.ts:801`). Không đi qua pipeline request của NestJS nên **không dùng được** `@UseGuards` / Pipe / Interceptor; code tự gọi các lớp "guard".
- Kiểm tra quyền nằm ở `checkDirectGuardsAndCooldown` (dòng 597), bị gọi lặp ở **4 nhánh** (quoted image 1058, image 1122, video 1183, text 1225), đều sau bước xác định `isDirectTriggered` (dòng 1034).
- `GrantAccessGuard.canActivate` (`apps/api/src/zca/guards/grant-access.guard.ts`): admin → `registerPendingUser` → `isGrantAccess` → nếu không có quyền thì gửi tin từ chối kèm User ID.
- Cấu hình kênh: `ThreadBotConfig` trong `packages/contracts/src/index.ts`, cột jsonb trong `zca_thread_configs`; mẫu gần nhất để bắt chước là `chatMemory` (normalize trong contracts, migration `1724820000000`).
- `zca-js` có `getGroupInfo(groupId)` (trả `memVerList`, dạng `<uid>_<ver>`) và `getGroupMembersInfo(memberIds)` (trả `profiles` có `displayName`, `zaloName`, `avatar`).
- Trang cấu hình kênh: `apps/web/src/modules/zca/presentation/components/thread-config/*`, lưu cả form qua `PUT /api/zca/thread-configs/:threadId`.

## 3. Thiết kế

### 3.1 Contracts (`packages/contracts/src/index.ts`)

```ts
export type ThreadMemberAccessMode = 'granted-users' | 'all-members' | 'selected-members';

export interface ThreadMemberAccessConfig {
  /** granted-users: chỉ người có quyền toàn cục (hành vi hiện tại). */
  mode: ThreadMemberAccessMode;
  /** UID ZCA được cấp quyền trong riêng kênh này; chỉ dùng khi mode = selected-members. */
  memberIds: string[];
}

export const MEMBER_ACCESS_DEFAULTS: ThreadMemberAccessConfig = { mode: 'granted-users', memberIds: [] };
export const MEMBER_ACCESS_LIMITS = { MAX_MEMBERS: 1000 } as const;
export function normalizeMemberAccessConfig(value: unknown): ThreadMemberAccessConfig; // mode lạ → default, id: string, trim, bỏ trùng, cắt MAX
```

- Thêm `memberAccess: ThreadMemberAccessConfig` vào `ThreadBotConfig` và `memberAccess: Partial<ThreadMemberAccessConfig>` vào `UpdateThreadBotConfigDto`.
- DTO thành viên nhóm:
  ```ts
  export interface IZcaGroupMember { id: string; displayName: string; zaloName?: string; avatar?: string; }
  export interface IZcaGroupMembersResponse { members: IZcaGroupMember[]; totalMembers: number; fetchedAt: number; }
  ```
- Route: `API_ROUTES.zcaThreadMembers(threadId)` → `/api/zca/threads/${threadId}/members`.
- i18n `zca.memberAccess.*` (vi + en) cho toàn bộ chữ của phần UI mới (quy tắc zero hardcoded literal).

### 3.2 Database

- Migration mới `apps/api/src/database/migrations/1724890000000-AddMemberAccessToZcaThreadConfigs.ts`:
  `ADD COLUMN IF NOT EXISTS "member_access" jsonb NOT NULL DEFAULT '{"mode": "granted-users", "memberIds": []}'`; `down` drop cột.
- Đăng ký migration trong `database.module.ts` và `data-source.ts` (2 file đang có thay đổi chưa commit của việc khác — chỉ **thêm 1 dòng import + 1 phần tử mảng**, không đụng phần còn lại).
- `ZcaThreadConfigEntity`: thêm cột `memberAccess` (jsonb, default như trên).
- Mặc định `granted-users` ⇒ mọi nhóm hiện có **giữ nguyên hành vi**.

### 3.3 Backend — strategy quyền theo kênh (`apps/api/src/zca/access/`)

| File | Vai trò |
| --- | --- |
| `thread-access-policy.ts` | Interface `ThreadAccessPolicy { allows(senderId: string, config: ThreadBotConfig): boolean }` — chỉ trả lời "kênh này có cấp thêm quyền cho người gửi không". |
| `group-member-access.policy.ts` | `all-members` → true; `selected-members` → `memberIds.includes(senderId)`; `granted-users` → false. |
| `personal-access.policy.ts` | Luôn false (chat riêng chỉ dựa vào quyền toàn cục). |
| `thread-access.service.ts` | Chọn policy theo loại kênh (`Record<ThreadKind, ThreadAccessPolicy>`, loại lấy từ `message.type` của zca-js, không tin `config.threadType` cũ), rồi gọi `GrantAccessGuard.canActivate(input, { threadGrant })`. |
| `*.spec.ts` | Test cho 2 policy và service. |

- `GrantAccessGuard.canActivate(input, options?: { threadGrant?: boolean })`: thứ tự **admin → `registerPendingUser` → `threadGrant` → `isGrantAccess` → từ chối**. Vẫn đăng ký user khi được kênh cấp quyền, để tên người tạo giao dịch/lời nhắc hiển thị đúng. Webhook (`InputProcessorService`) gọi như cũ, không truyền `threadGrant`.
- Đăng ký các provider trong module ZCA (nơi đang cung cấp `GrantAccessGuard`).
- `ThreadConfigService`: normalize `memberAccess` ở mọi chỗ đang normalize `chatMemory` (đọc từ DB, Redis, file JSON cũ, default config, `updateConfig`, ghi entity).

### 3.4 Backend — gom kiểm tra quyền về 1 chỗ trong `onMessage`

- Ngay sau bước 4 (tính `isDirectTriggered`):
  ```ts
  if (!isDirectTriggered) return;            // nhánh nào phía sau cũng đã yêu cầu điều này
  const allowed = await this.checkDirectGuardsAndCooldown(..., config, isGroup);
  if (!allowed) return;
  ```
- Bỏ 4 lời gọi lặp và điều kiện `isDirectTriggered` thừa trong các nhánh 5–8.
- `checkDirectGuardsAndCooldown` nhận thêm `config` + loại kênh, gọi `ThreadAccessService` thay vì gọi thẳng `GrantAccessGuard`. Bootstrap admin và cooldown giữ nguyên thứ tự.
- Không đổi: lưu media, trí nhớ hội thoại, fast-path `yes/cancel/edit <code>`, pending image, reaction (vẫn chạy trước/không qua kiểm tra quyền như hiện tại).
- **Thay đổi hành vi nhỏ có chủ đích** (do gom về 1 chỗ):
  - Gợi ý "Hiện không có hình ảnh…" khi gõ `1`/`2` giờ cũng cần quyền.
  - Người chưa có quyền mention bot kèm ảnh không lấy được URL (hoặc audio) giờ nhận tin từ chối thay vì bị bỏ qua im lặng.

### 3.5 Backend — danh sách thành viên nhóm

- `ZcaService.getGroupMembers(groupId, forceRefresh)`:
  1. `getGroupInfo([groupId])` → `memVerList`, cắt hậu tố `_<ver>` lấy UID.
  2. `getGroupMembersInfo` theo lô 50 → map `IZcaGroupMember` (lấy `profile.id`, bỏ hậu tố nếu có).
  3. Cache Redis `zca:group_members:<groupId>` TTL 10 phút; `forceRefresh` bỏ qua cache.
  - Lỗi theo cách các API ZCA hiện có xử lý (chưa đăng nhập ZCA, id không phải nhóm).
- `GET /api/zca/threads/:threadId/members?refresh=true` trong `ZcaController` (admin-only qua `this.admin(req)`).
- Test parse `memVerList` / `profiles` trong `zca.service.spec.ts`.

### 3.6 Web — phần "Ai được gọi bot" trên trang cấu hình kênh

- `MemberAccessSection` (mới, `presentation/components/thread-config/member-access-section.tsx`): chỉ hiện khi `threadType === 'group'`, đặt ở cột trái dưới `DirectInteractionSection`.
  - Chọn 1 trong 3 chế độ (radio): *Chỉ người đã được cấp quyền toàn cục* / *Mọi thành viên nhóm* / *Thành viên được chọn*.
  - Dòng ghi chú: admin và người có quyền toàn cục luôn được dùng.
- `GroupMemberPicker` (mới) — khi chế độ là *Thành viên được chọn*:
  - Tải bằng `useZcaThreadMembersQuery(threadId)`; nối với `useUsersQuery` để hiện nhãn *Admin* / *Quyền toàn cục* (dùng lại `getUserAccess` trong `model/chat-rows.ts`); với người đó, công tắc hiện "đã có quyền" và bị khoá.
  - Ô tìm (tên, tên Zalo, UID, bỏ dấu bằng `normalizeVietnamese`), bộ lọc *Tất cả / Đã chọn*, đếm "Đã chọn N/M", nút *Làm mới danh sách*.
  - Đủ 4 trạng thái UI: loading, lỗi (kèm thử lại), rỗng, có dữ liệu. UID đã chọn nhưng không còn trong nhóm vẫn hiện (nhãn "Không còn trong nhóm") để admin bỏ chọn.
  - Phone-first: hàng chạm ≥ 40px, theo các pattern `TAP_CONTROL` hiện có; giữ bo góc nhỏ (`rounded-[3px]`/`rounded`).
- Lưu cùng nút *Lưu* hiện có của form (đi trong `UpdateThreadBotConfigDto.memberAccess`), không thêm mutation riêng.
- `model/thread-config-form.ts`: `configToForm` điền `memberAccess` bằng `normalizeMemberAccessConfig`; logic lọc/tìm thành viên tách thành hàm thuần trong `model/group-members.ts` + spec.
- `api/zca-api.ts` + `api/zca-query.ts`: `getThreadMembers`, `useZcaThreadMembersQuery` (key trong factory hiện có, `staleTime` 5 phút, `refetch` với `refresh=true`, hỗ trợ `AbortSignal`).

### 3.7 Tài liệu (Hard Completion Gate)

| Knowledge (EN) | Docs (VI) |
| --- | --- |
| `knowledge/modules/zca/member-access.md` (mới) | `docs/modules/zca/member-access.md` (mới) |
| `knowledge/modules/zca/README.md` — bảng config, cột kiểm tra quyền ở "Message Flows", endpoint mới, Web UI | `docs/modules/zca/README.md` |
| `knowledge/global/zalo-command-intake.md` — luồng ZCA dùng `ThreadAccessService` | `docs/global/zalo-command-intake.md` |
| `knowledge/modules/users/README.md` — `registerPendingUser` cũng được gọi khi kênh cấp quyền | `docs/modules/users/README.md` |

- Cập nhật mục lục `.agents/docs/README.md`, thêm thuật ngữ **Quyền theo kênh** vào `CONTEXT.md`.
- Chạy `node .claude/hooks/docs-drift-check.mjs` đến khi exit 0.

## 4. Kiểm thử & xác minh

1. `npm run typecheck`, `npm run lint`, `npm run test` cho `@zalobot/contracts`, `@zalobot/api`, `@zalobot/web`.
2. Test mới/cập nhật:
   - Policy nhóm: 3 chế độ.
   - `ThreadAccessService`: nhóm vs cá nhân.
   - `GrantAccessGuard` với `threadGrant` (`whitelist-guards.spec.ts`).
   - `onMessage`:
     - Thành viên được chọn nhưng chưa có quyền toàn cục → được xử lý.
     - Người không trong danh sách → bị từ chối.
     - Tin nhóm không mention → không kiểm tra quyền, không gửi từ chối.
   - `normalizeMemberAccessConfig`, `configToForm`, lọc thành viên.
3. `npm run build --workspace @zalobot/web`.
4. Mở trang cấu hình một nhóm trong browser pane (dev server): chọn chế độ, chọn thành viên, lưu, tải lại trang thấy giữ nguyên; kiểm tra cả khổ điện thoại.
5. Thử thật trên Zalo (mention bot bằng tài khoản thành viên) **không tự làm được** — sẽ ghi rõ là chưa xác minh.

## 5. Giả định cần anh xác nhận

1. Nhóm hiện có mặc định `granted-users`, tức giữ nguyên hành vi hiện tại cho đến khi anh đổi.
2. Duyệt bằng `yes <code>` / thả tim vẫn là việc chung của cả nhóm (không đi qua quyền mới). Riêng `edit <code>`: chỉ người tạo thao tác chờ duyệt, tài khoản bot hoặc người có quyền toàn cục được sửa; quy tắc này giữ nguyên.
3. Chat riêng không có cấu hình thành viên (chỉ quyền toàn cục).
4. Người được kênh cấp quyền vẫn được lưu vào bảng `users` ở trạng thái *Chờ duyệt* (hiện ở tab "Chờ duyệt" trên `/zca`), nhưng không tự có quyền toàn cục.

## 6. Ngoài phạm vi

- Cấp quyền theo kênh cho chat riêng hoặc webhook chính thức.
- Tự dọn `memberIds` khi thành viên rời nhóm (chỉ hiện nhãn "Không còn trong nhóm").
- Cooldown/rate-limit theo kênh.

## 7. Ghi chú thực thi

- `packages/contracts/src/index.ts`, `database.module.ts`, `data-source.ts`, `zalo.module.ts` đang có thay đổi chưa commit của việc khác (tasks/calendar). Chỉ thêm phần mới, không chạm/không revert phần đó, và không commit nếu anh chưa yêu cầu.
