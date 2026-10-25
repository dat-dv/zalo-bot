# Walkthrough: tin bổ sung thay thẻ chờ, sửa thẻ không mất dữ liệu

- Plan: [implementation_plan.md](implementation_plan.md) (đã duyệt) · Điều tra: [investigation.md](investigation.md)
- Nhánh: `claude/relaxed-shannon-91cdf4`

## Đã làm

**Bước 0**
- `main` không có commit mới nên không cần đồng bộ.
- Build `@zalobot/contracts` (`dist/` đã gitignore) để test chạy được trong worktree.
- Baseline: 741/741 test pass.

**Bước A: tin bổ sung sửa thẻ**
- `apps/api/src/zca/text/amend-pending.tool.ts` (mới): tool `AMEND_PENDING { code }`, khối prompt liệt kê thẻ đang chờ (`amendablePendingBlock`), và `pickAmendTarget` (lấy theo mã, hoặc thẻ duy nhất khi mã thiếu hay sai).
- `TextInputService.process`:
  - Lấy các thẻ còn hạn của người gửi trong chat này. Lỗi tra cứu thì coi như không có thẻ.
  - Thêm khối thẻ vào prompt và thêm tool `AMEND_PENDING` vào danh sách.
  - Chạy `amendFromToolCalls` trước các tool khác và bỏ tool call cùng loại với thẻ vừa sửa.
- `TransactionConfirmationService.amendPending`: bọc `processEdit`, chỉ cho chủ thẻ trong đúng chat. Bị từ chối thì im lặng.

**Bước B: luồng sửa không mất dữ liệu**
- `pending-edit-args.util.ts` (mới):
  - `pendingToolArgs` cho CREATE_TASK và SET_REMINDER: giờ một lần vào `remindTimes`, giờ lặp vào `repeatingTimes`, không đưa người được nhắc.
  - `mergeEditedToolArgs`: trường bỏ trống hoặc null giữ giá trị cũ; gửi một khoá giờ thì thay cả nhóm giờ; cặp nhắc lại thay cùng nhau.
- `handleEditPendingAction`:
  - Trả `boolean`.
  - Chế độ patch: prompt hiển thị args dạng tool kèm người đang được nhắc, bỏ `required` của tool. LLM không trả tool thì vẫn phát lại thẻ.
  - Truyền `previousPayload` vào strategy.
- `processEdit`: gọi `onEdit` trước, chỉ thu hồi và xoá thẻ cũ khi kết quả là `true`. Thêm kiểu `PendingEditHandler`.
- `reminder-target-args.util.ts`:
  - `reminderTimesFromArgs` gộp `remindAt` với `remindTimes`.
  - `reminderUsersForRequest`: sửa không tag ai thì giữ người cũ.
  - Dùng hàm này trong `CreateTaskToolStrategy` và `SetReminderToolStrategy`.
- `ZcaBotFeatureService.buildTextAgentInput`: dùng chung cho luồng AI và callback sửa, nên tin sửa mang theo `taggedUsers`, `messageId`, trí nhớ và cấu hình.

**Tài liệu**
- `.agents/knowledge/global/zalo-response-layout.md` và `zalo-command-intake.md`, cùng bản tiếng Việt trong `.agents/docs/global/`.
- `CONTEXT.md`: thêm thuật ngữ **Tin bổ sung**.

## Test mới

- `text-input.service.spec.ts`:
  - Tái hiện sự cố [446]: "tag @Văn Đạt nha" ra một thẻ mới, đủ 3 giờ (14/02 vẫn hằng tháng), nhắc @Văn Đạt.
  - Bỏ thẻ thứ hai cùng loại trong cùng tin.
  - Chỉ mở tool sửa cho thẻ của chính người gửi trong chat này.
  - Yêu cầu độc lập giữ thẻ cũ.
  - Chế độ patch không có tool call vẫn phát lại thẻ.
  - Sửa không tag ai giữ người đang được nhắc.
  - Hai test cũ bổ sung kiểm tra giá trị trả về `false`.
- `pending-edit-args.util.spec.ts` (mới): round-trip giờ nhắc với cả `Date` lẫn ISO, args của task và lời nhắc, loại không hỗ trợ, các quy tắc gộp.
- `reminder-target-args.util.spec.ts`: gộp `remindAt`, các trường hợp của `reminderUsersForRequest`.
- `transaction-confirmation.service.spec.ts`: sửa thất bại thì giữ thẻ (không thu hồi); `amendPending` chỉ cho chủ thẻ trong đúng chat. 4 mock `onEdit` cũ đổi sang trả `true`.
- `zca-bot-feature.service.spec.ts`: `@Đen edit 125 tag @Nam` truyền `taggedUsers` và `messageId` vào luồng sửa.

## Kiểm tra đã chạy

- `npm run test --workspace @zalobot/api`: 761/761 pass.
- `npm run typecheck --workspace @zalobot/api`: sạch.
- `npm run lint --workspace @zalobot/api`: sạch.
- `node .claude/hooks/docs-drift-check.mjs`: PASS.

## Chưa kiểm được

- Chưa thử với LLM thật hay trên Zalo thật. Việc LLM chọn `AMEND_PENDING` hay tạo mới phụ thuộc prompt, test chỉ dùng phản hồi giả. Sau khi deploy cần thử tay kịch bản 12:02/12:04 trong một nhóm thử, và theo dõi log `Follow-up message amends pending` / `LLM resolved tool`.
- Kiểu lặp hằng năm vẫn ngoài phạm vi: "14/2 mỗi năm" vẫn bị LLM biến thành hằng tháng như trước.
