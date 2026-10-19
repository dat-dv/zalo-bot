# Walkthrough: passive-tool-allowlist (Phase 2)

Ngày: 2026-10-19 · Plan: [`implementation_plan.md`](implementation_plan.md) (v2, đã duyệt)

## Đã thay đổi

### Text / LLM (`apps/api/src/zalo/text/`)
- `text-tool.definitions.ts`: thêm `PASSIVE_EXPENSE_TOOLS`, `PASSIVE_CALENDAR_TOOLS`, `selectToolDefinitions()`, `isTextToolType()`.
- `text-input.service.ts`:
  - Ở chế độ passive: `allowedTools` rỗng → không gọi LLM. Có tool → chỉ gửi các definition được phép, kèm system prompt riêng (`buildPassiveSystemInstruction`). Tool ngoài allowlist bị bỏ qua.
  - Passive **không** hiện typing indicator (`withChatAction`). Đây là chi tiết nhỏ thêm vào ngoài plan, theo tinh thần "im lặng".
  - `handleEditPendingAction`: chỉ gửi tool `pending.actionType`; tool khác bị bỏ qua. `actionType` không phải tool (`create`/`delete`/`BAN_USER`) thì không gọi LLM mà hướng dẫn `cancel`. Bỏ câu "đổi ý sang hành động khác" khỏi prompt.
- `strategies/get-storage-links-tool.strategy.ts`, `share-drive-tool.strategy.ts`: dùng `isGroupThread`; group → chỉ thread config, user → chỉ users.

### AgentInput
- `apps/api/src/types/agent-input.type.ts` và `apps/api/src/zalo/types/agent-input.type.ts`: thêm `allowedTools?: readonly TextToolType[]`.

### ZCA (`apps/api/src/zca/`)
- `thread-config.service.ts`:
  - thêm `hasLegacyGroupPrefix()` (export) và `isGroupThread()` (memory → Redis → DB, không tạo config);
  - `createDefaultThreadConfig` dùng `hasLegacyGroupPrefix`;
  - `saveDriveFolderInfo`/`savePhotosAlbumInfo` dùng `isGroupThread` khi tạo entity mới.
- `zca.service.ts`: `resolveThreadType` dùng `hasLegacyGroupPrefix`.
- `zca-bot-feature.service.ts`:
  - thêm `resolvePassiveAllowedTools`, `checkPassiveGuards` (im lặng), `isOwnerSender`, `canEditPending`, và comment mô tả các luồng;
  - mục 8: L2 tính allowlist trước, rồi mới kiểm tra quyền;
  - fast-path truyền `canEdit` vào `handleCommand`.
- `confirmation/transaction-confirmation.service.ts`: `handleCommand`/`processEdit` nhận thêm `canEdit` tuỳ chọn. Hàm này được kiểm tra **trước** khi hết hạn/thu hồi/xoá, nên người không có quyền không phá được thẻ chờ.
  - Lý do: `processEdit` gọi `recallTempMessages` trước `onEdit` rồi `deletePending` sau, nên chặn bên trong callback là chưa đủ (plan đã dự phòng điểm này).

### Users / Google
- `users/users.service.ts`: `saveDriveFolderInfo` không tạo user; `syncUsersWithZca` chỉ map thread `type === 'user'`.
- `google/google-resources.controller.ts`: thêm `isGroupChannel()`, bỏ heuristic `length > 10`, và không còn gọi users vô điều kiện.

### Script
- `apps/api/scripts/cleanup-group-users.ts` + npm script `users:cleanup-groups`. Dùng repository TypeORM (không SQL thô), mặc định dry-run, `--apply` thì xoá trong transaction và xoá cache Redis whitelist.

### Tài liệu
- `.agents/knowledge/modules/zca/README.md`: thêm mục "Message Flows" và "Group vs User Channel Detection".
- `.agents/knowledge/modules/users/README.md`: thêm mục "User record lifecycle" và mô tả script dọn dữ liệu.
- `.agents/docs/modules/zca/README.md` (mục 1a, 1b, mục Kiểm thử) và `.agents/docs/modules/users/README.md` (mục 1a).
- `CHANGELOG.md`: thêm mục `[Unreleased]`.

## Kiểm chứng đã chạy
- `npm run typecheck --workspace @zalobot/api`: pass.
- `npm run test --workspace @zalobot/api`: **314/314 pass**.
  - Test mới: passive allowlist, edit giới hạn tool, `isGroupThread`, group ID số thuần không vào users (strategy + controller), `saveDriveFolderInfo` không tạo user, sync bỏ group, L2 im lặng với user chưa cấp quyền, L2 chỉ bật calendar, L3 backup cho user chưa cấp quyền, `canEdit` ở cả feature và confirmation.
- `npm run lint:check --workspace @zalobot/api`: còn 119 lỗi, **toàn bộ có sẵn từ trước**. Đã so số lỗi eslint của từng file đã sửa với `HEAD`: không file nào tăng (`thread-config.service.spec.ts` giảm 1). Script mới sạch lint/prettier.
- Prettier: các file `confirmation/transaction-confirmation.service.ts`, `thread-config.service.ts`, `zca-bot-feature.service(.spec).ts`, `zca.service.ts` đã lệch format từ trước (đã kiểm trên `HEAD`). Không chạy `--write` để tránh thay đổi ngoài phạm vi.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Chưa kiểm chứng
- `npm run users:cleanup-groups` (dry-run): **chưa chạy được** vì Postgres local không chạy (`ECONNREFUSED 127.0.0.1:5432`).
- Thử tay trong group Zalo thật (các kịch bản ở §6 của plan): chưa thực hiện.

## Ghi chú
- Thay đổi chưa commit có sẵn của anh trong `thread-config.service.spec.ts` được giữ nguyên; em chỉ nối thêm test vào cuối file.
- Rủi ro E2 (cooldown L2) vẫn còn theo đúng quyết định; đã ghi vào docs ZCA.
