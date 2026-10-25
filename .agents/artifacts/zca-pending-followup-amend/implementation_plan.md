# Kế hoạch: tin bổ sung thay thẻ chờ, và luồng sửa không làm mất dữ liệu

- Route: `implement` · Phase 1 (`inspect-and-plan`) · Rủi ro: **MEDIUM** (đổi cách định tuyến tin ở mọi chat đang có thẻ chờ, nhiều file)
- Cơ sở: [investigation.md](investigation.md) (RC1, RC2, CF1–CF4)
- Không đụng câu chữ hiển thị cho người dùng (thẻ, tóm tắt, thông báo). Phần đó do session khác làm. Chỉ đổi logic và prompt LLM.

## 1. Hành vi sau khi sửa

| Tình huống | Hiện tại | Sau khi sửa |
| --- | --- | --- |
| Diệu Hằng có [446] (CREATE_TASK, 3 giờ nhắc) trong nhóm, nhắn `@Đen tag @Văn Đạt nha` | Thẻ mới [950] chỉ còn 1 giờ, [446] treo đến hết hạn | Một thẻ mới **thay** [446] ([446] bị thu hồi và xoá), giữ đủ 3 giờ nhắc, Nhắc ai: @Văn Đạt |
| Đang có thẻ "mua sữa", nhắn `thêm việc mua bánh` | Thẻ mới | Thẻ mới, **giữ** thẻ cũ (LLM coi là yêu cầu độc lập) |
| Thành viên khác nhắn bổ sung vào thẻ của Diệu Hằng | Thẻ mới | Không đổi: người khác không thấy thẻ của Diệu Hằng, đi luồng thường. Sửa thẻ người khác vẫn cần `edit <code>` như hiện nay |
| `edit 446 tag @Văn Đạt` | Nhắc ai vẫn là @Diệu Hằng | @Văn Đạt, giữ nguyên giờ |
| `edit 446 đổi giờ 10h` (thẻ đang nhắc @A, không tag ai) | Người nhắc về lại người gửi | Giữ @A, giờ mới |
| `edit <code>` mà LLM không trả tool / trả nhầm tool / loại thẻ không hỗ trợ sửa | Thẻ cũ bị thu hồi và xoá, không có thẻ mới | Thẻ cũ **được giữ**. Riêng CREATE_TASK / SET_REMINDER thì phát lại thẻ với tham số cũ (kèm người mới được tag) |
| LLM trả `remindAt = A` và `remindTimes = [B, C]` | Mất A | Nhắc cả A, B, C |

Mặc định đã chọn (nêu lại khi review nếu muốn khác):

- Tag mới **thay** danh sách người được nhắc cũ, không cộng thêm. Muốn cả mình thì nói "nhắc cả tôi" (`remindSelf`).
- Sửa ngầm (không có `edit`) chỉ cho **chủ thẻ, trong đúng chat của thẻ**.

## 2. Các file sẽ đổi

| File | Thay đổi |
| --- | --- |
| `apps/api/src/zca/text/pending-edit-args.util.ts` (mới) | Hàm thuần: `pendingToolArgs`, `mergeEditedToolArgs` |
| `apps/api/src/zca/text/amend-pending.tool.ts` (mới) | Định nghĩa tool `AMEND_PENDING`, khối prompt liệt kê thẻ đang chờ, chọn thẻ đích |
| `apps/api/src/zca/text/text-input.service.ts` | Luồng chính nhận biết thẻ chờ. Luồng sửa dùng args dạng tool, sửa theo kiểu patch và trả `boolean` |
| `apps/api/src/zca/text/text-tool.interface.ts` | `TextToolContext.previousPayload?` |
| `apps/api/src/zca/text/reminder-target-args.util.ts` | Gộp `remindAt` với `remindTimes`; thêm `reminderUsersForRequest` |
| `apps/api/src/zca/text/strategies/create-task-tool.strategy.ts`, `set-reminder-tool.strategy.ts` | Dùng `reminderUsersForRequest` |
| `apps/api/src/zca/confirmation/transaction-confirmation.service.ts` | `onEdit` trả `Promise<boolean>`; `processEdit` chỉ thu hồi và xoá thẻ cũ khi đã phát thẻ mới; thêm `amendPending` (mỏng) |
| `apps/api/src/zca/zca-bot-feature.service.ts` | Builder `AgentInput` dùng chung cho luồng chính và callback sửa |
| Spec: `pending-edit-args.util.spec.ts` (mới), `text-input.service.spec.ts`, `reminder-target-args.util.spec.ts`, `transaction-confirmation.service.spec.ts`, `zca-bot-feature.service.spec.ts` | Xem §4 |
| Tài liệu: xem §5 | |

## 3. Các bước triển khai

### Bước 0: chuẩn bị

1. Đồng bộ nhánh với `main` (`sync_with_base_branch`) để nhận thay đổi câu chữ của session kia (nếu đã merge) trước khi sửa `transaction-confirmation.service.ts` và các tài liệu `zalo-response-layout`.
2. Worktree đang thiếu link workspace `node_modules/@zalobot/contracts`. Kiểm tra lại, thiếu thì chạy `npm install` ở gốc worktree để test và typecheck chạy được.

### Bước B5: gộp giờ nhắc (`reminder-target-args.util.ts`)

`reminderTimesFromArgs` gom `[args.remindAt, ...(remindTimes nếu là mảng)]`, rồi lọc và khử trùng như hiện tại. `requestedTimesFromArgs` vẫn khử trùng theo mili-giây, nên `remindAt` nằm sẵn trong `remindTimes` sẽ không bị nhân đôi.

### Bước B2 + B3: args dạng tool và gộp theo kiểu patch (`pending-edit-args.util.ts`)

```ts
/** Keys that change together: an edit that sends any of them replaces the whole group. */
const EDIT_ARG_GROUPS: readonly (readonly string[])[] = [
  ['remindAt', 'remindTimes', 'repeatingTimes'],
  ['nagEveryMinutes', 'nagCount'],
];

/**
 * A pending payload as the args of its tool, so an edit shows the LLM what it may send back.
 * `undefined` for action types without a mapping: those keep today's full re-issue.
 */
export function pendingToolArgs(
  actionType: string,
  payload: Record<string, unknown>,
): Record<string, unknown> | undefined;

/** Args omitted by the edit keep their old value; an explicit empty value ("", [], false) clears. */
export function mergeEditedToolArgs(
  previous: Record<string, unknown>,
  edited: Record<string, unknown>,
): Record<string, unknown>;
```

- Giờ nhắc được dựng lại bằng `revivePayloadTimes(payload.remindTimes, payload.remindAt)` (`reminders/reminder-times.ts:220`). Giờ không lặp thành `remindTimes: string[]` (ISO). Giờ lặp thành `repeatingTimes: [{ at, repeatType, repeatWeekdays }]`. Không trả `remindAt` riêng.
- CREATE_TASK lấy `title`, `due`, `notes`, nhắc lại (`nagEveryMinutes`/`nagCount`), `remindMode`, cùng các trường giờ.
- SET_REMINDER lấy `title`, `remindInGroup = Boolean(payload.chatId)`, nhắc lại, `remindMode`, cùng các trường giờ.
- `remindUsers` không đưa vào args, vì người được nhắc chỉ lấy từ tag.
- Các loại khác (RECORD_TRANSACTION, MANAGE_DEBT, CREATE_CALENDAR_EVENT, CREATE_PLACE…) trả `undefined`, giữ cách hiện tại. Lý do: payload của chúng khác args (placeId…), và không có trường danh sách nên ít mất dữ liệu.

### Bước B4: người được nhắc khi sửa

- `TextToolContext` thêm `previousPayload?: Record<string, unknown>`, chỉ có giá trị khi strategy chạy từ luồng sửa.
- `reminder-target-args.util.ts` thêm:

```ts
/**
 * People to remind for a new or edited request: an edit that tags nobody (and does not ask to
 * remind the sender) keeps the people of the card it replaces; otherwise `reminderUsersOrSender`.
 */
export function reminderUsersForRequest(
  context: TextToolContext,
  includeSender: boolean,
): IReminderTargetUser[];
```

- Người cũ được đọc bằng `parseTargetUsers(context.previousPayload?.remindUsers)` (`reminders/reminder-target.ts:48`).
- `CreateTaskToolStrategy` thay `reminderUsersOrSender` bằng `reminderUsersForRequest`.
- `SetReminderToolStrategy`: `inGroup` cũng tính đúng khi thẻ cũ có người được nhắc (`remindInGroup` đi theo args đã gộp), rồi dùng `reminderUsersForRequest`.

### Bước B1: mang đủ ngữ cảnh vào luồng sửa (`zca-bot-feature.service.ts`)

- Tách `private buildTextAgentInput(...)` từ khối `AgentInput` của luồng chính (`:1295-1312`: `allowAiChat`, `triggerPrefixes`, `messageId`, `taggedUsers`, trí nhớ).
- Callback `onEdit` ở `:952-960` dùng builder này với `text = commandText` và trả về kết quả `boolean` của `handleEditPendingAction`.

### Bước B6: `handleEditPendingAction` (`text-input.service.ts`)

- Đổi kiểu trả về thành `Promise<boolean>`: `true` khi đã chạy strategy (đã phát thẻ mới), `false` trong mọi trường hợp còn lại (loại thẻ không hỗ trợ, LLM trả nhầm tool, lỗi).
- `previousArgs = pendingToolArgs(...)`. Có giá trị thì vào **chế độ patch**:
  - Prompt hiển thị `previousArgs` thay cho `JSON.stringify(pending.payload)`, kèm dòng "Đang nhắc: @A, @B" nếu có.
  - Hướng dẫn LLM: chỉ điền trường cần đổi. Đổi giờ thì điền đủ danh sách giờ mới. Người được nhắc lấy từ tag trong tin. Luôn gọi lại tool, kể cả khi không có trường nào đổi (tham số rỗng).
  - Định nghĩa tool gửi cho LLM bỏ `required`, vì SET_REMINDER đang bắt buộc `remindAt` và sẽ ép LLM ghi đè danh sách giờ.
  - LLM không trả tool call thì coi như patch rỗng và vẫn phát lại thẻ (để áp người mới được tag). Câu trả lời dạng văn bản không được gửi.
  - `toolArgs = mergeEditedToolArgs(previousArgs, toolCall?.args ?? {})`, `previousPayload = pending.payload`.
- Không có `previousArgs` thì giữ luồng hiện tại, chỉ thêm giá trị trả về.

### Bước A3: `TransactionConfirmationService` (giữ thay đổi nhỏ nhất)

- `onEdit?: (pending, instruction) => Promise<boolean>` trong `handleCommand` và `processEdit`.
- `processEdit` ([:1129-1132](../../../apps/api/src/zca/confirmation/transaction-confirmation.service.ts)): gọi `onEdit` trước. Chỉ khi nó trả `true` mới `recallTempMessages(chatId, pending.code)` và `deletePending(pending.code, pending.userId)`. Thẻ mới mang mã mới, nằm ở khoá temp khác, nên không bị thu hồi nhầm.
- Thêm method:

```ts
/** Re-issues a pending action from a follow-up message of its owner in its chat (no `edit` prefix). */
public async amendPending(
  userId: string,
  chatId: string,
  code: string,
  instruction: string,
  onEdit: (pending: PendingAction, instruction: string) => Promise<boolean>,
): Promise<boolean> {
  return this.processEdit(userId, chatId, code, instruction, onEdit, (pending) =>
    Promise.resolve(pending.userId === userId && pending.chatId === chatId),
  );
}
```

### Bước A1, A2, A4: luồng chính nhận biết thẻ chờ (`amend-pending.tool.ts`, `text-input.service.ts`)

1. Trong `process`, trước lời gọi LLM, lấy `amendable`: các thẻ trong `getPendingListForUser(senderId)` có `chatId === chatId`, `expiresAt > now` và `isTextToolType(actionType)`.
2. Nếu `amendable` không rỗng:
   - Thêm `AMEND_PENDING_TOOL` (tham số `code: STRING`) vào danh sách tool. Hằng `AMEND_PENDING_TOOL_NAME = 'AMEND_PENDING'` nằm ngoài enum `TextToolType`, để không bị factory coi là strategy và không lọt vào `isTextToolType`.
   - Thêm vào system instruction khối "THẺ ĐANG CHỜ XÁC NHẬN CỦA NGƯỜI NHẮN". Mỗi thẻ ghi mã, loại, tiêu đề, args (`pendingToolArgs` hoặc payload) và người đang được nhắc.
   - Quy tắc trong khối: tin bổ sung hoặc sửa một thẻ trong khối (đổi giờ, thêm/bớt người, "tag @X", sửa tiêu đề, thêm ghi chú…) thì gọi `AMEND_PENDING` với mã đó và không gọi lại tool tạo mới. Yêu cầu mới, độc lập thì gọi tool như bình thường. Có kèm ví dụ cho cả hai trường hợp.
3. Trong vòng lặp tool call:
   - Gặp `AMEND_PENDING`: chọn thẻ đích (mã khớp trong `amendable`; nếu chỉ có một thẻ thì lấy thẻ đó dù mã thiếu hay sai; còn lại thì log rồi bỏ qua).
   - Gọi `confirmationService.amendPending(senderId, chatId, code, text, (p, i) => this.handleEditPendingAction(input, p, i))`. Chỉ thị sửa là **toàn bộ tin nhắn**, không dùng câu LLM diễn giải lại.
   - Mỗi mã chỉ sửa một lần.
   - Chặn trùng: các tool call khác **cùng loại** với thẻ vừa sửa trong cùng tin bị bỏ (log), để không lặp lại kiểu [950]. Tool call khác loại vẫn chạy.
4. Không có thẻ chờ thì prompt và danh sách tool giữ nguyên như hiện nay.

## 4. Kiểm thử

**`pending-edit-args.util.spec.ts` (mới)**

- Round-trip: `requestedTimesFromArgs(pendingToolArgs('CREATE_TASK', payload))` cho đúng 3 giờ của [446], giữ repeat hằng tháng cho 14/02, với cả payload có `at` kiểu `Date` (trong bộ nhớ) lẫn ISO string (đọc từ Redis).
- `mergeEditedToolArgs`:
  - Trường bị bỏ trống giữ giá trị cũ.
  - Gửi một khoá trong nhóm giờ thì thay cả nhóm.
  - `remindTimes: []` xoá giờ.
  - Cặp nhắc lại đi cùng nhau.
- Loại không hỗ trợ trả `undefined`.

**`reminder-target-args.util.spec.ts`**

- `remindAt` + `remindTimes` được gộp và khử trùng.
- `reminderUsersForRequest`:
  - Sửa không tag ai thì giữ người cũ.
  - Có tag thì thay bằng người được tag.
  - `remindSelf` thì thêm người gửi.
  - Tin mới (không có `previousPayload`) cho kết quả như `reminderUsersOrSender`.

**`text-input.service.spec.ts`**

Harness thêm `llmResponses?: LlmResponse[]` (trả lần lượt theo thứ tự) và nối `CreateTaskToolStrategy` với một TasksService giả.

- **Tái hiện sự cố:**
  - Dựng sẵn: [446] của `u1` trong `g1` có 3 giờ, nhắc `u1`.
  - Gửi: `process('tag @Văn Đạt nha', taggedUsers: [Văn Đạt])`.
  - LLM giả: lần 1 trả `AMEND_PENDING {code}`, lần 2 trả `CREATE_TASK {}`.
  - Kỳ vọng: còn đúng 1 thẻ chờ, mã khác [446]; payload có 3 giờ; `remindUsers = [Văn Đạt]`.
- Prompt của lượt chính có khối thẻ chờ và tool `AMEND_PENDING` chỉ khi người gửi có thẻ trong chat này; không có với thẻ của người khác hoặc chat khác.
- LLM trả `AMEND_PENDING` + `CREATE_TASK` trong cùng tin: chỉ sửa thẻ, không tạo thẻ thứ hai.
- LLM trả `RECORD_TRANSACTION` khi đang có thẻ task: thẻ task vẫn còn, có thêm thẻ giao dịch.
- Chế độ patch, LLM không trả tool: vẫn phát lại thẻ với giờ cũ và người mới được tag.
- Loại không hỗ trợ: trả `false`, không gọi strategy (test hiện có được giữ và bổ sung kiểm tra giá trị trả về).

**`transaction-confirmation.service.spec.ts`**

- `edit <code>` với `onEdit` trả `false`: thẻ cũ còn, không bị thu hồi.
- Trả `true`: thẻ cũ bị xoá và thu hồi.
- `amendPending` từ chối (im lặng) khi người gửi không phải chủ thẻ hoặc khác chat.

**`zca-bot-feature.service.spec.ts`**

- `@Đen edit 125 tag @X` truyền `taggedUsers` vào `handleEditPendingAction`.
- Sửa kiểu `onEdit` trong các mock hiện có.

## 5. Tài liệu (Hard Completion Gate)

- `.agents/knowledge/global/zalo-response-layout.md`:
  - Phần lệnh văn bản: thêm "tin bổ sung của chủ thẻ trong cùng chat được coi là sửa".
  - Bước vòng đời 7 "Edited": thẻ cũ chỉ bị thu hồi khi đã phát thẻ mới; sửa theo kiểu patch cho CREATE_TASK / SET_REMINDER; quy tắc người được nhắc khi sửa.
- `.agents/knowledge/global/zalo-command-intake.md`:
  - Bước 2 (lệnh chờ) và bước 5 (LLM): khối thẻ chờ, tool `AMEND_PENDING`, chặn trùng loại.
  - `depends_on` thêm `pending-edit-args.util.ts` và `amend-pending.tool.ts`.
- Bản tiếng Việt tương ứng: `.agents/docs/global/zalo-response-layout.md`, `.agents/docs/global/zalo-command-intake.md`. Giải thích lý do nghiệp vụ, không chỉ dán link.
- `CONTEXT.md`, mục "Thao tác chờ duyệt": thêm thuật ngữ **Tin bổ sung** (tin của chủ thẻ trong cùng chat, khi thẻ còn hạn, sửa thẻ đó thay vì tạo thẻ mới; trường không nhắc tới giữ nguyên).
- Không tạo trang tài liệu mới, nên `.agents/docs/README.md` không cần đổi trừ khi drift-check báo.
- Ghi `walkthrough.md` vào thư mục artifact này khi xong.

## 6. Xác minh

1. `npm run test --workspace @zalobot/api`
2. `npm run typecheck --workspace @zalobot/api`
3. `npm run lint --workspace @zalobot/api`
4. `node .claude/hooks/docs-drift-check.mjs` (phải exit 0)
5. Không thử được trên Zalo thật trong session này. Sau khi deploy, cần thử tay đúng kịch bản 12:02/12:04 ở một nhóm thử.

Commit một lần ở cuối, kèm `investigation.md` và plan này. Pre-commit hook tự nâng version, không sửa version bằng tay.

## 7. Rủi ro và cách giảm

| Rủi ro | Giảm thiểu |
| --- | --- |
| LLM coi một yêu cầu mới độc lập là sửa, làm thay mất thẻ cũ | Chỉ hiện khối khi người gửi có thẻ trong chat; prompt có ví dụ cả hai phía; thẻ mới luôn phải duyệt nên lỗi lộ ra và sửa được |
| LLM vẫn gọi lại tool tạo mới thay vì `AMEND_PENDING` | Không có lưới an toàn tất định (đã cân nhắc so khớp tiêu đề và bỏ vì dễ trượt). Theo dõi log `LLM resolved tool`; nếu hay trượt thì thêm sau |
| Ở chế độ patch, LLM gửi lại danh sách giờ thiếu dù người dùng không đổi giờ | Prompt yêu cầu chỉ điền trường thay đổi và đã bỏ `required`; thẻ mới hiển thị đủ giờ để người dùng soát trước khi duyệt |
| Sửa ngầm tốn thêm một lời gọi LLM (lượt chính + lượt sửa) | Chỉ xảy ra khi có thẻ chờ và LLM chọn sửa |
| Xung đột merge với session đang sửa câu chữ (`transaction-confirmation.service.ts`, spec của nó, `zalo-response-layout.md`) | Đồng bộ `main` ở Bước 0; trong file đó chỉ đổi logic `processEdit`, chữ ký `onEdit` và thêm `amendPending` |
| Đổi thứ tự trong `processEdit` (phát thẻ mới rồi mới thu hồi thẻ cũ) làm hai thẻ cùng hiện trong giây lát | Chấp nhận, đổi lại là không bao giờ mất thẻ khi sửa thất bại |

## 8. Ngoài phạm vi

- Kiểu lặp hằng năm (`yearly`) cho giờ nhắc, và việc hỏi lại khi thiếu ngày (ví dụ "sinh nhật Hằng"): đề xuất làm task riêng.
- Câu chữ của thẻ, tóm tắt và thông báo "Bạn còn N yêu cầu": session khác đang làm.
- Sửa dữ liệu task đã lưu từ [950] trên prod: làm tay trên dashboard.
