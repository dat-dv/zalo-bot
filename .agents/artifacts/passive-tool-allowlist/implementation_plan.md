# Kế hoạch triển khai: Chuẩn hoá 3 luồng xử lý tin nhắn ZCA (mention / passive text / passive media), chặn leo thang quyền qua `edit <code>` & sửa group ID lọt vào trang Users

> **Trạng thái:** v2 — đã chốt A1–A3 với anh (2026-10-19). Chờ duyệt để sang Phase 2.

## 0. Quyết định đã chốt

| Mã | Quyết định |
|---|---|
| **A1** | L3 backup media của **mọi thành viên** theo config `mediaBackup` của thread, không kiểm tra quyền user. |
| **A2** | Allowlist L2 giữ như đề xuất: `expenseTracking` → `RECORD_TRANSACTION`, `MANAGE_DEBT`; `calendarExtraction` → `CREATE_CALENDAR_EVENT`, `SET_REMINDER`. |
| **A3** | Viết **script dọn dữ liệu có dry-run** (mặc định chỉ in danh sách; cờ `--apply` mới xoá). |
| **E1** | **Chặn `edit <code>`**: chỉ user `granted` hoặc chủ pending được sửa; LLM khi sửa chỉ nhận tool cùng loại với `pending.actionType`. |
| **E2** | **Giữ cooldown im lặng ở L2** (anh không chọn bỏ). Rủi ro đã biết: xem §3. |

## 1. Bối cảnh & nguyên nhân gốc (đã xác minh trên code)

### Bug A — bot tự xử lý khi không có `@bot`
- `zca-bot-feature.service.ts` mục 8: khi `!isDirectTriggered` và thread bật `expenseTracking`/`calendarExtraction` → gọi `TextInputService.process({ passiveOnly: true })` **không qua guard nào** (guard chỉ chạy khi `isDirectTriggered`, dòng ~1118).
- `text-input.service.ts`: nhánh LLM luôn truyền `ZALO_TOOL_DEFINITIONS` (đủ tool). `passiveOnly` chỉ chặn trò chuyện tự do / fallback CONVERSATION, không chặn tool. Ví dụ log: `@drive` → `GET_STORAGE_LINKS` được thực thi.

### Bug A' — leo thang qua `edit <code>` (phát hiện thêm khi review)
- `onMessage` mục 1 gọi `confirmationService.handleCommand` **trước mọi guard**. Callback `onEdit` gọi `textInputService.handleEditPendingAction` với `ZALO_TOOL_DEFINITIONS` đầy đủ, không có `passiveOnly`.
- `transaction-confirmation.service.ts` `processEdit`: điều kiện từ chối là `pending.userId !== userId && pending.chatId !== chatId` → mọi thành viên cùng group đều sửa được.
- Hệ quả: thành viên chưa cấp quyền gõ `edit 123 cho link drive` → có thể gọi `GET_STORAGE_LINKS` → lặp lại Bug B.

### Bug B — group ID xuất hiện ở trang Users ("Chờ phê duyệt")
- `get-storage-links-tool.strategy.ts:125`, `share-drive-tool.strategy.ts:73`: nhận biết group bằng `startsWith('g-') || startsWith('group_')`. Group ZCA là số thuần → bị coi là user → `usersService.saveDriveFolderInfo(chatId)`.
- `users.service.ts` `saveDriveFolderInfo` **tự tạo user** `{ role: USER, grantAccess: DENIED }` nếu chưa có.
- `google-resources.controller.ts`: dòng 78 dùng `startsWith('g-') || length > 10`; dòng 88 và 169 gọi `usersService.saveDriveFolderInfo` **vô điều kiện**, kể cả khi là group.
- `syncUsersWithZca` không lọc `type` → điền tên group vào `firstName` của user giả.
- Cùng heuristic `startsWith('g-')` còn ở: `thread-config.service.ts:34` (`createDefaultThreadConfig`, hàm **đồng bộ** được export), `:586`, `:624` (`saveDriveFolderInfo`, `savePhotosAlbumInfo`), `zca.service.ts:543` (`resolveThreadType`, đã ưu tiên config — mức nhẹ).

### Redis
`ThreadConfigService` và whitelist `whitelist:user:<id>` đã sync đúng. Không đổi cơ chế sync, không đổi key.

## 2. Thiết kế mục tiêu: 3 luồng

Hai cổng chung giữ nguyên: (G1) `isSelf` theo `allowSelf` / `isBotSentMessage`; (G2) thread `isListened`.

| Luồng | Điều kiện | Quyền user | Hành vi |
|---|---|---|---|
| **L1. Mention / direct** | `@bot` / mention / prefix, hoặc `directInteraction.enabled && !requireMention` | `GrantAccessGuard` (gửi tin từ chối + `registerPendingUser`) + cooldown có thông báo | **Giữ nguyên**: full tool, AI chat theo `allowAiChat` |
| **L2. Passive text** | không mention, thread bật `expenseTracking` và/hoặc `calendarExtraction` | Chỉ user `granted` hoặc owner — kiểm tra **im lặng**, không gửi tin, không `registerPendingUser`; cooldown im lặng | LLM chỉ nhận allowlist (A2); allowlist rỗng → không gọi LLM; không bao giờ chat tự do |
| **L3. Passive media** | thread bật `mediaBackup` + loại media tương ứng | Không kiểm tra quyền user (A1) | Auto backup Drive/Photos như hiện tại |
| **Edit pending** | `edit <code> …` | Chủ pending **hoặc** user `granted`/owner; không đạt → im lặng (đã xử lý, không gọi LLM) | LLM chỉ nhận tool `pending.actionType` |

### Thứ tự trong `onMessage` sau sửa
1. G1, G2 (như cũ).
2. Fast-path `yes/cancel/edit <code>` (như cũ) — riêng `edit` bị chặn theo hàng "Edit pending" ở bảng trên.
3. Fast-path pending image (như cũ).
4. **L3** auto media backup (như cũ, vị trí đã đứng trước guard).
5. Tính `isDirectTriggered` (như cũ).
6. Direct → `checkDirectGuardsAndCooldown` → L1 (như cũ).
7. Không direct + text → **L2**: `checkPassiveGuards` → `resolvePassiveAllowedTools(config)` → rỗng thì return → `process({ passiveOnly: true, allowedTools })`.

## 3. Mức rủi ro: MEDIUM

- Không đổi schema DB, không đổi Redis key, không đổi DTO trong `@zalobot/contracts`.
- Đổi hành vi nghiệp vụ: L2 siết quyền + tool; `edit` siết quyền + tool; `saveDriveFolderInfo` của users không còn tạo user.
- **Rủi ro đã biết (E2):** `checkCooldown` 2 giây, in-memory, ghi thời điểm mỗi lần cho qua. Ở L2:
  - Hai dòng chi tiêu gửi trong < 2s → dòng sau bị bỏ im lặng.
  - Tin passive ngay trước `@bot …` → L1 trả "⏳ quá nhanh".
  - Anh có thể đổi ý sau khi review; thay đổi chỉ là bỏ một lời gọi trong `checkPassiveGuards`.
- **Rủi ro E1:** khi sửa, user không còn "đổi ý sang hành động khác" được (prompt hiện tại cho phép). Muốn đổi loại hành động thì `cancel <code>` rồi nhắn lại.

---

## 4. Proposed Changes

### Component 1: `apps/api/src/zalo/text/`

#### [MODIFY] `text-tool.definitions.ts`
- Export `PASSIVE_EXPENSE_TOOLS = [RECORD_TRANSACTION, MANAGE_DEBT] as const`, `PASSIVE_CALENDAR_TOOLS = [CREATE_CALENDAR_EVENT, SET_REMINDER] as const`.
- Export `selectToolDefinitions(allowed: readonly TextToolType[])` → subset của `ZALO_TOOL_DEFINITIONS` (giữ thứ tự gốc).

#### [MODIFY] `text-input.service.ts`
- `process()` khi `input.passiveOnly`:
  - `allowed = input.allowedTools ?? []`; rỗng → `logger.debug('Passive mode with no allowed tools, skipping LLM')`, return.
  - Dùng **system instruction riêng cho passive** (`buildPassiveSystemInstruction(allowed, dtContext)`): chỉ mô tả các tool trong allowlist, giữ quy tắc tách hành động / kế thừa ngữ cảnh / tham số phẳng; nêu rõ "không rõ ràng là giao dịch/lịch hẹn → KHÔNG gọi tool, KHÔNG trả lời". Không nối thêm vào prompt đầy đủ (prompt đó liệt kê mọi tool và có câu "trả lời tự nhiên" — mâu thuẫn).
  - `llmService.generate(text, selectToolDefinitions(allowed), passiveInstruction)`.
  - Khi duyệt `toolCalls`: tool không thuộc `allowed` → `logger.warn('... outside passive allowlist')`, `continue` (không fallback CONVERSATION).
- `handleEditPendingAction(input, pending, instruction)`:
  - `editTools = resolveEditTools(pending.actionType)`: nếu `actionType` là giá trị hợp lệ của `TextToolType` → `[actionType]`; ngược lại (`'create'`, `'delete'`, …) → không gọi LLM, gửi "Yêu cầu này không hỗ trợ chỉnh sửa, vui lòng `cancel <code>` và tạo lại." rồi return.
  - Gọi `generate(prompt, selectToolDefinitions(editTools), systemInstruction)`; tool trả về không thuộc `editTools` → `logger.warn` và bỏ qua.
  - Bỏ câu "Nếu người dùng đổi ý sang hành động khác…" khỏi prompt edit.
- Nhánh direct của `process()` giữ nguyên.

#### [MODIFY] `text-input.service.spec.ts`

- passive + `allowedTools=[]` → `generate` không được gọi.
- passive + `[RECORD_TRANSACTION]` → `generate` nhận đúng 1 definition.
- passive, LLM trả `GET_STORAGE_LINKS` → strategy không execute, không `sendMessage`.
- direct → full definitions (hồi quy).
  - edit với pending `RECORD_TRANSACTION`, LLM trả `GET_STORAGE_LINKS` → không execute.
- edit với pending `actionType: 'create'` → không gọi `generate`.

#### [MODIFY] `strategies/get-storage-links-tool.strategy.ts`, `strategies/share-drive-tool.strategy.ts` (+ spec tương ứng)
- Thay heuristic bằng `await this.threadConfigService.isGroupThread(chatId)`. Group → chỉ `threadConfigService.saveDriveFolderInfo`; user → chỉ `usersService.saveDriveFolderInfo`.
- Spec: chatId số thuần có config `threadType='group'` → `usersService.saveDriveFolderInfo` không được gọi.

### Component 2: `AgentInput`
- `apps/api/src/types/agent-input.type.ts` **và** `apps/api/src/zalo/types/agent-input.type.ts` (hai file giống hệt nhau, sửa cả hai): thêm `allowedTools?: readonly TextToolType[]` kèm JSDoc "chỉ dùng khi `passiveOnly`". Import `TextToolType` bằng `import type`.

### Component 3: `apps/api/src/zca/`

#### [MODIFY] `thread-config.service.ts`
- Thêm `public isGroupThreadSync(threadId): boolean | undefined` — tra `configsMap`; không biết thì `undefined`.
- Thêm `public async isGroupThread(threadId): Promise<boolean>` — `configsMap` → Redis → DB `threadType === 'group'`; fallback cuối `startsWith('g-') || startsWith('group_')` (tương thích Bot API cũ).
- `createDefaultThreadConfig` (hàm sync, export): giữ chữ ký; nơi gọi trong service truyền `threadType` khi đã biết. Heuristic nội bộ đổi thành `startsWith('g-') || startsWith('group_')` cho nhất quán.
- `saveDriveFolderInfo` / `savePhotosAlbumInfo`: khi tạo entity mới, `threadType` lấy từ `await this.isGroupThread(threadId)`.

#### [MODIFY] `zca.service.ts`
- `resolveThreadType` (dòng ~543): fallback đổi sang `startsWith('g-') || startsWith('group_')` cho thống nhất (không đổi thứ tự ưu tiên hiện có).

#### [MODIFY] `zca-bot-feature.service.ts`
- `private resolvePassiveAllowedTools(config): TextToolType[]` — gộp `PASSIVE_EXPENSE_TOOLS` / `PASSIVE_CALENDAR_TOOLS` theo cờ bật.
- `private async checkPassiveGuards(senderId, isSelf, ownId): Promise<boolean>` — owner bypass; không gọi `adminBootstrapGuard`, không `registerPendingUser`; `usersService.isGrantAccess` false → debug log, false; `checkCooldown` không cho → debug log, false. Không `sendMessage`.
- Mục 1 (fast-path confirmation), callback `onEdit`: trước khi gọi `handleEditPendingAction`, kiểm tra `senderId === pending.userId || isOwner || await usersService.isGrantAccess(senderId)`; không đạt → `logger.debug` và return (callback kết thúc, command vẫn tính là đã xử lý → không rơi xuống LLM).
  - Lưu ý: `processEdit` đã `deletePending` trước/sau callback ở một số nhánh — Phase 2 sẽ đọc kỹ thứ tự để chặn **trước** khi pending bị xoá (nếu cần sẽ chuyển kiểm tra quyền vào `processEdit` qua tham số `canEdit?: (pending) => Promise<boolean>`). Ghi nhận trong walkthrough.
- Mục 8: gộp hai `if` thoát sớm; nhánh `!isDirectTriggered` → `checkPassiveGuards` → `allowedTools` → rỗng return → truyền `allowedTools` vào `agentInput`.
- Comment đầu `onMessage` mô tả L1/L2/L3/Edit.

#### [MODIFY] `zca-bot-feature.service.spec.ts`
- Cập nhật test hiện có (dòng ~400 `passiveOnly=true`) để mock `isGrantAccess = true` và kiểm `allowedTools`.
- user chưa granted, text không mention, thread bật expense → `process` và `api.sendMessage` không được gọi; `registerPendingUser` không được gọi.
- user granted → `process` nhận `allowedTools = [RECORD_TRANSACTION, MANAGE_DEBT]`.
- chỉ bật `calendarExtraction` → `[CREATE_CALENDAR_EVENT, SET_REMINDER]`.
- ảnh không mention, user chưa granted, `uploadImages` bật → vẫn backup (A1).
- `edit 123 …` từ user chưa granted, không phải chủ pending → `handleEditPendingAction` không được gọi.

#### [MODIFY] `confirmation/transaction-confirmation.service.ts` (chỉ nếu cần theo ghi chú ở trên)
- Thêm tham số tuỳ chọn `canEdit` cho `handleCommand`/`processEdit`; không đổi hành vi `yes`/`cancel`.

### Component 4: `apps/api/src/users/` & `apps/api/src/google/`

#### [MODIFY] `users/users.service.ts` (+ `users-drive-folder.spec.ts`, `users-sync.spec.ts`)
- `saveDriveFolderInfo`: user chưa tồn tại → `logger.warn` và return, **không tạo**.
- `syncUsersWithZca`: chỉ đưa vào `threadMap` các thread `type === 'user'`.
- Spec: id chưa tồn tại → `save` không được gọi; thread group trùng id → không cập nhật `firstName`.

#### [MODIFY] `google/google-resources.controller.ts` (+ spec)
- Dòng 78–93 và 161–173: `const isGroup = await this.threadConfigService?.isGroupThread(channelId) ?? false`; group → chỉ thread config; user → chỉ users. Bỏ heuristic `length > 10`.

### Component 5: Script dọn dữ liệu (A3)

#### [NEW] `apps/api/scripts/cleanup-group-users.ts` + script npm `users:cleanup-groups` trong `apps/api/package.json`
- Khởi tạo `AppDataSource` từ `src/database/data-source.ts` (cùng cách nạp env như các script hiện có).
- Ứng viên: `users.id IN (SELECT thread_id FROM zca_thread_configs WHERE thread_type = 'group')` **và** `role <> 'admin'`.
- Loại trừ ứng viên có dữ liệu liên kết theo `user_id` ở: `finance_transactions`, `finance_places`, `user_tokens`, `debt_contacts`, `debts`, `debt_payments`, `debt_payment_allocations`, `reminders`, `user_categories`, `dashboard_exchange_tokens` (in ra để anh xem tay, không xoá).
- Mặc định **dry-run**: in bảng `id | firstName | grantAccess | createdAt | bị loại vì…`.
- `--apply`: xoá trong một transaction, xoá luôn Redis `whitelist:user:<id>`, log số dòng.
- Không phải migration (dữ liệu khác nhau giữa môi trường; cần người xem trước).

### Component 6: Tài liệu (Hard Completion Gate)
- `.agents/knowledge/modules/zca/README.md` (EN): mục "Message flows: L1 mention / L2 passive text / L3 passive media / pending edit", bảng quyền + allowlist; "Users = WHO may interact; thread config = HOW"; quy tắc nhận biết group qua `isGroupThread`.
- `.agents/docs/modules/zca/README.md` (VI): giải thích 3 luồng, vì sao passive im lặng với user chưa cấp quyền, vì sao `edit` bị giới hạn tool, cách bật/tắt trên dashboard, rủi ro cooldown L2.
- `.agents/knowledge/modules/users/README.md` + `.agents/docs/modules/users/README.md`: Users chỉ ghi nhận quyền; `saveDriveFolderInfo` không tạo user; group ID không bao giờ là user; cách chạy `users:cleanup-groups` (dry-run → `--apply`).
- `CHANGELOG.md`: 3 dòng fix (Bug A, A', B) + 1 dòng script.
- `.agents/docs/README.md`: cập nhật nếu thêm file mới.

---

## 5. Ngoài phạm vi
- `isSelf`/`isBotSentMessage` in-memory → Redis (`zca:bot_uid`) cho nhiều replica.
- UI dashboard tuỳ chỉnh allowlist passive theo thread.
- Siết quyền `yes <code>` / `cancel <code>` / reaction theo user (hiện là xác nhận tập thể trong group — giữ nguyên theo "Xác nhận đa chiều").
- Bỏ/tách cooldown L2 (E2 — anh chưa chọn).
- Gộp hai file `agent-input.type.ts` trùng lặp.

## 6. Kiểm chứng
- `npm run typecheck --workspace @zalobot/api`; `npm run test --workspace @zalobot/api`; `npm run lint:check --workspace @zalobot/api`.
- `npm run users:cleanup-groups --workspace @zalobot/api` (dry-run) trên DB local → phải liệt kê `7120342145544273834`.
- Thử tay trong group test:
  - user chưa granted: `ăn trưa 45k` → im lặng; `@drive` → im lặng; gửi ảnh → vẫn backup; `edit <code> cho link drive` → im lặng.
  - user granted: `ăn trưa 45k` → thẻ xác nhận giao dịch; `@drive` → im lặng (log `outside passive allowlist` hoặc không tool); `@bot /drive` → trả link, **không** có user mới ở trang Users.
- `node .claude/hooks/docs-drift-check.mjs` exit 0.
- Lưu ý: `apps/api/src/zca/thread-config.service.spec.ts` đang có thay đổi chưa commit của anh — Phase 2 sẽ giữ nguyên và chỉ thêm test mới, không ghi đè.
