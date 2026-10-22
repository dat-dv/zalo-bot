# Walkthrough — Quyền tương tác theo kênh (nhóm ZCA)

Phase 2 thực hiện theo `implementation_plan.md` đã duyệt.

## Đã làm

- **Contracts** (`packages/contracts/src/index.ts`): `ThreadMemberAccessMode`, `THREAD_MEMBER_ACCESS_MODES`, `ThreadMemberAccessConfig`, `MEMBER_ACCESS_DEFAULTS`, `MEMBER_ACCESS_LIMITS`, `normalizeMemberAccessConfig`, `IZcaGroupMember`, `IZcaGroupMembersResponse`; thêm `memberAccess` vào `ThreadBotConfig` / `UpdateThreadBotConfigDto`; route `API_ROUTES.zcaThreadMembers`; i18n `zca.memberAccess.*` (vi + en).
- **DB**: migration `1724900000000-AddMemberAccessToZcaThreadConfigs` (cột jsonb `member_access`, mặc định `granted-users`), cột trong `ZcaThreadConfigEntity`, đăng ký ở `database.module.ts` và `data-source.ts`.
- **Strategy** (`apps/api/src/zca/access/`): `ThreadAccessPolicy`, `GroupMemberAccessPolicy`, `PersonalAccessPolicy`, `ThreadAccessService` (đăng ký trong `ZcaModule`).
- **Guard**: `GrantAccessGuard.canActivate(input, { threadGrant })`: admin → `registerPendingUser` → `threadGrant` → quyền toàn cục → từ chối.
- **`ThreadConfigService`**: normalize `memberAccess` ở mọi đường đọc/ghi.
- **`onMessage`**: tin không gọi bot dừng sau phần backup/trí nhớ; kiểm tra quyền **một lần** (`checkDirectGuardsAndCooldown` nhận object có `config` + `accessKind`), bỏ 4 lời gọi lặp.
- **Thành viên nhóm**: `zca-group-members.ts` (parse thuần), `ZcaService.getGroupMembers` (cache Redis 10 phút), `GET /api/zca/threads/:threadId/members?refresh=true`.
- **Web**: `getZcaThreadMembers`, `useZcaThreadMembersQuery`, `useRefreshZcaThreadMembersMutation`; `model/group-members.ts`; `MemberAccessSection` + `GroupMemberPicker` (chỉ nhóm); `configToForm` / `formToPayload` mang `memberAccess`.
- **Docs**: cặp mới `modules/zca/member-access.md` (knowledge EN + docs VI); cập nhật README zca (EN/VI), `global/zalo-command-intake.md` (EN/VI), `modules/users/README.md` (EN/VI), mục lục `.agents/docs/README.md`, thuật ngữ trong `CONTEXT.md`.

## Khác với plan

- `ThreadAccessService` **chỉ chọn policy và trả `threadGrant`**; việc gọi `GrantAccessGuard` vẫn nằm trong `checkDirectGuardsAndCooldown`. Lý do: `ZcaBotFeatureService` đang lấy guard kiểu lazy (setter + `ModuleRef`), để service gọi guard sẽ tạo phụ thuộc vòng. Policy là logic thuần nên service không có dependency, bot feature tự tạo `new ThreadAccessService()` khi không được inject.
- Migration dùng timestamp `1724900000000` thay vì `1724890000000`, vì việc tasks đang dở đã có `1724890000000-DropTaskGoogleCopy`.
- Sửa thêm một dòng tài liệu cũ sai: knowledge/docs `zalo-command-intake` ghi ZCA "không áp dụng cooldown", nhưng code luôn gọi `checkCooldown`.

## Kiểm tra đã chạy

- `npm run typecheck` contracts / api / web: sạch.
- `npm run lint` contracts / api / web: sạch.
- `npm run test` api: 534/534 pass; web: 86/86 pass. Test mới:
  - `access/thread-access.service.spec.ts`
  - `zca-group-members.spec.ts`
  - Guard với `threadGrant` (`whitelist-guards.spec.ts`)
  - 3 kịch bản chế độ trong `zca-bot-feature.service.spec.ts`
  - normalize `memberAccess` (`thread-config.service.spec.ts`)
  - `model/group-members.spec.ts`
  - `memberAccess` trong `thread-config-form.spec.ts`
- `npm run build` web (static export) và api: thành công.
- `node .claude/hooks/docs-drift-check.mjs --all`: PASS.

## Chưa xác minh

- Chưa mở trang `/zca/thread?id=` trong trình duyệt: máy không có API local đang chạy (cổng 3001 là một Next server khác), nên trang không có dữ liệu để thử.
- Chưa thử thật trên Zalo (mention bot bằng tài khoản thành viên) và chưa gọi thật `getGroupInfo` / `getGroupMembersInfo`. Phần parse dựa trên kiểu dữ liệu `zca-js` và đã có test.
- Migration chưa chạy trên DB thật; API chạy `migrationsRun: true` nên sẽ tự áp dụng khi khởi động.
- Chưa commit.
