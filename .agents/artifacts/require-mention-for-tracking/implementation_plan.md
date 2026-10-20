# Kế hoạch: Mọi tin nhắn phải qua luồng mention/tiền tố + cho phép nhiều tiền tố

- Route: implement | Phase 1 (inspect-and-plan) | Bản 2 (cập nhật theo phản hồi 2026-10-20)
- Mức rủi ro: **MEDIUM**. Thay đổi hành vi nghiệp vụ và mở rộng contract `ThreadDirectInteractionConfig` theo kiểu tương thích ngược. Không migration (cột `directInteraction` là jsonb).

## 1. Bối cảnh & bằng chứng

- Log production 2026-10-20, nhóm `7120342145544273834`: lúc 18:13:18, tin `Chủ nhật rồi mua đồ bơi hết 300k ở lê trọng tấn` **không mention** nhưng vẫn gọi Gemini và tạo thẻ xác nhận. Nguyên nhân là luồng **L2 thụ động** (`apps/api/src/zca/zca-bot-feature.service.ts:1310-1318`).
- L2 tốn 1 request LLM cho **mỗi** tin chữ của người đã được cấp quyền trong nhóm bật thu chi/lịch. Không có bước lọc nội dung nên các tin như "ok" hay "haha" vẫn đi LLM.
- Tiền tố gọi bot hiện chỉ có **một chuỗi** (`directInteraction.triggerPrefix?: string`, `packages/contracts/src/index.ts:2278`).

## 2. Hành vi mong muốn

> Tất cả cần đi qua luồng mention. Tiền tố gọi bot cho phép đặt nhiều cái.

**Quy tắc kích hoạt duy nhất:** bot chỉ xử lý tin nhắn chữ (và ảnh, video có lệnh) khi tin đó:
1. Mention tài khoản bot (`mentions[].uid === ownId`), **hoặc** gõ `@bot`, `@<tên bot>` (regex hiện có), **hoặc**
2. Bắt đầu bằng **một trong các tiền tố** đã cấu hình cho kênh.

Không thoả điều kiện thì **bỏ qua hoàn toàn**: không gọi LLM, không kiểm tra quyền, không trả lời.

Giữ nguyên, vì đây là phản hồi trên thao tác người dùng đã chủ động khởi tạo hoặc không dùng LLM:
- `yes/cancel/edit <code>`, `yes all` và thả cảm xúc ❤️/😡 cho thao tác chờ duyệt.
- Trả lời ảnh đang chờ (`1`/`2`) khi đang có ảnh chờ của chính người đó.
- L3 sao lưu media (`mediaBackup`): chỉ upload Drive/Photos, không LLM.

## 3. Quyết định (anh đã chốt 2026-10-20)

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Hai công tắc `expenseTracking` / `calendarExtraction` | **Ẩn khỏi UI.** Còn chờ chốt cách xử lý 2 cột `expense_tracking` / `calendar_extraction` (jsonb) trong bảng `zca_thread_configs`: **(1a) đề xuất** xoá hẳn khỏi entity, contract, service, UI và thêm migration mới `DROP COLUMN`; hoặc (1b) để nguyên cột, chỉ ẩn UI (không migration nhưng để lại dữ liệu chết). |
| Q2 | Bắt buộc mention | **Luôn bắt buộc mention/tiền tố trong nhóm.** Bỏ công tắc `requireMention` trên UI; backend bỏ qua giá trị đang lưu. **Ngoại lệ, không cần mention:** (a) chat riêng 1-1 trực tiếp với tài khoản bot ZCA (`ThreadType.User`); (b) Zalo Bot chính thức qua webhook (`apps/api/src/zalo/input-processor.service.ts`), hiện vốn không chặn theo mention nên giữ nguyên. |
| Q3 | Ảnh không kèm chữ | **Chỉ lưu ảnh**: đi theo L3 sao lưu media (`mediaBackup`), không OCR, không LLM, không hiện menu `1`/`2`. Áp dụng cả nhóm lẫn chat 1-1, tức bỏ nhánh `ImageBatchHandler` cho ảnh 1-1 không caption (`zca-bot-feature.service.ts:1180-1206`) và bỏ ngoại lệ "ảnh 1-1 = gọi bot" (dòng 1094-1097). **Muốn xử lý ảnh**: reply/quote ảnh và mention bot (hoặc dùng tiền tố) → OCR ảnh được quote, ghép với nội dung tin để làm nhiệm vụ (luồng quote ảnh hiện có, bước 5 dòng ~1120-1178, giữ nguyên). Ảnh gửi kèm caption có mention/tiền tố vẫn được OCR như cũ (bước 6b). |
| Q4 | So khớp tiền tố | **Không phân biệt hoa thường** và **tiền tố không được chứa dấu cách**. So khớp ở đầu tin sau khi trim, ưu tiên tiền tố dài nhất. |
| Q5 | Giới hạn (giữ đề xuất) | Tối đa **10** tiền tố mỗi kênh, mỗi cái 1–20 ký tự, tự bỏ trùng (không phân biệt hoa thường). |

Ghi chú Q3: ảnh chỉ được lưu khi kênh bật `mediaBackup` + `uploadImages`. Nếu tắt thì ảnh không caption bị bỏ qua hoàn toàn; kế hoạch không thêm đường upload mới. `ImageBatchHandler` và `PendingImageActionDispatcher` vẫn giữ nguyên trong code; ZCA chỉ thôi gọi chúng cho ảnh không caption. Nếu sau khi rà thấy không còn nơi nào tạo ảnh chờ thì ghi nhận trong docs, không xoá trong task này.

## 4. Thay đổi dự kiến

### 4.1 Contract — `packages/contracts/src/index.ts`
- `ThreadDirectInteractionConfig`: thêm `triggerPrefixes?: string[]`. Giữ `triggerPrefix?: string` và đánh dấu `@deprecated` để đọc dữ liệu cũ, không xoá.
- Thêm hằng `TRIGGER_PREFIX_LIMITS = { maxCount: 10, maxLength: 20 } as const` và hàm thuần `normalizeTriggerPrefixes(input: { triggerPrefix?: string; triggerPrefixes?: readonly string[] }): string[]`. Hàm trim, bỏ rỗng, bỏ trùng (không phân biệt hoa thường), áp giới hạn, sắp theo độ dài giảm dần. API và web dùng chung hàm này.

### 4.2 API — cấu hình kênh `apps/api/src/zca/thread-config.service.ts`
- Khi đọc entity (dòng ~103-112) và khi tự bật kênh (dòng ~573-584): trả `triggerPrefixes = normalizeTriggerPrefixes(directInteraction)`, đặt `requireMention: true`.
- Khi `updateConfig` nhận `directInteraction.triggerPrefixes`: lưu mảng đã chuẩn hoá và xoá `triggerPrefix` cũ khỏi jsonb, để dữ liệu dần chuyển hết sang dạng mới. Bỏ qua mọi giá trị `requireMention` gửi lên.
- Mặc định kênh mới (dòng ~57-63): `triggerPrefixes: []`.

### 4.3 API — định tuyến tin nhắn `apps/api/src/zca/zca-bot-feature.service.ts`
- Bước 4 (dòng ~1075-1097): `hasPrefix` đổi thành "tin bắt đầu bằng một trong các `triggerPrefixes`" (không phân biệt hoa thường). Quy tắc mới: `isDirectTriggered = !isGroup ? text.trim() !== '' : (hasMention || hasPrefix)`. Chat 1-1 thì tin có chữ là gọi bot (Q2a); nhóm thì phải mention hoặc tiền tố. Bỏ nhánh `requireMention === false` và ngoại lệ ảnh 1-1 không caption (Q3: ảnh không chữ chỉ lưu, kể cả 1-1).
- Bước 8 (dòng ~1308): `if (!isDirectTriggered) return;`. Xoá nhánh L2 (`resolvePassiveAllowedTools`, `checkPassiveGuards`). `AgentInput` không còn `passiveOnly` / `allowedTools`.
- Thay mọi `cleanBotMention(..., directConfig.triggerPrefix)` và `triggerPrefix: directConfig.triggerPrefix` (dòng 182, 890, 1132, 1172, 1222, 1259, 1341) bằng danh sách `triggerPrefixes`.
- Xoá dead code: `resolvePassiveAllowedTools`, `checkPassiveGuards`, import `PASSIVE_*`. Cập nhật JSDoc luồng ở `onMessage` (dòng 831-839).
- Bước 6 (ảnh): xoá nhánh `!isGroup && !text.trim()` → `imageBatchHandler.handle` (Q3). Ảnh không gọi bot thì chỉ còn L3 backup rồi `return`.
- Rà các điểm khác: gợi ý fast-path `1`/`2` (dòng 1100), quote ảnh (1120), ảnh có caption (1210), video (1270). Tất cả đã chặn bằng `isDirectTriggered` nên tự đúng theo quy tắc mới.

### 4.4 API — xử lý văn bản `apps/api/src/zalo/text/*` và kiểu `AgentInput`
- `bot-mention.util.ts`: `cleanBotMention(text, botName, triggerPrefixes?: readonly string[])` bóc **một** tiền tố khớp đầu tiên (dài nhất trước, không phân biệt hoa thường), ở cả hai vị trí hiện có (dòng 19 và 62).
- `text-input.service.ts`: đổi sang `input.triggerPrefixes`. Xoá `passiveAllowed`, `buildPassiveSystemInstruction` và các nhánh `input.passiveOnly`. Giữ nhánh `allowAiChat === false`.
- `text-tool.definitions.ts`: xoá `PASSIVE_EXPENSE_TOOLS`, `PASSIVE_CALENDAR_TOOLS` và `selectToolDefinitions` nếu không còn nơi dùng.
- `apps/api/src/zalo/types/agent-input.type.ts`, `apps/api/src/types/agent-input.type.ts`: `triggerPrefix?: string` đổi thành `triggerPrefixes?: readonly string[]`; xoá `passiveOnly`, `allowedTools`.
- Webhook Zalo Bot chính thức: không truyền tiền tố nên không bị ảnh hưởng (sẽ xác minh khi thực thi).

### 4.5 Web — `apps/web/src/modules/zca/*`
- `view/thread-config-modal.tsx`:
  - Ô "Tiền tố gọi bot nhanh" đổi thành **ô nhập dạng chip**: gõ rồi Enter hoặc dấu phẩy để thêm, nút × để xoá, hiện lỗi inline khi quá giới hạn, trùng hoặc có khoảng trắng. Có trạng thái rỗng kèm gợi ý `VD: !  /  bot:`. Dùng primitive sẵn có của dự án nếu có, theo `enterprise-ui` / `frontend-orchestration`. Form dùng `normalizeTriggerPrefixes` từ contract.
  - Bỏ công tắc `requireMention` (Q2). Sửa câu mô tả nhóm "Tương tác trực tiếp": "Bot chỉ phản hồi khi được @mention hoặc tin bắt đầu bằng một tiền tố bên dưới."
  - Bỏ hai khối thu chi và lịch (Q1). Payload lưu truyền lại nguyên giá trị cũ của `expenseTracking` / `calendarExtraction` để không ghi đè.
  - Mô tả Chit-chat: "AI trả lời tự nhiên các câu hỏi tổng quát khi được @mention hoặc gọi bằng tiền tố."
  - Gửi `directInteraction.triggerPrefixes` khi lưu, không gửi `triggerPrefix`.
- `presentation/components/chat-table-row.tsx`: bỏ 2 badge thu chi/lịch. Hiện danh sách tiền tố nếu bảng đang có cột hiển thị phù hợp; không có thì giữ nguyên.

### 4.6 Test
- `bot-mention.util` (spec hiện có hoặc spec mới): bóc nhiều tiền tố, ưu tiên tiền tố dài, không phân biệt hoa thường, dạng `@bot !ăn trưa`.
- `normalizeTriggerPrefixes`: chuỗi cũ, mảng, trộn cả hai, trùng, rỗng, quá giới hạn.
- `zca-bot-feature.service.spec.ts`:
  - Test dòng 518 đổi thành: nhóm bật `expenseTracking`, tin không mention → `process` **không** được gọi. Regression đúng câu `Chủ nhật rồi mua đồ bơi hết 300k ở lê trọng tấn`.
  - Nhóm lưu `requireMention: false` → tin không mention vẫn bị bỏ qua.
  - Chat 1-1 với bot ZCA, tin chữ không mention → được xử lý (Q2a).
  - Chat 1-1 và nhóm, ảnh không caption → không OCR/LLM, không gọi `imageBatchHandler`; vẫn backup nếu bật `mediaBackup.uploadImages`.
  - Reply/quote ảnh + mention bot (và + tiền tố) → OCR ảnh được quote và gọi `textInputService.process` với prompt ghép OCR + nội dung tin.
  - Reply/quote ảnh nhưng không mention/tiền tố → bỏ qua.
  - `normalizeTriggerPrefixes` loại tiền tố có dấu cách; `bot:` khớp `BOT: mua 50k`.
  - Tin bắt đầu bằng tiền tố thứ 2 trong danh sách → `passiveOnly` không còn tồn tại và tin được xử lý (sửa test dòng 571).
  - Xoá hoặc đổi các test `createPassiveGroupScenario` (dòng 1769-1860).
- `thread-config.service.spec.ts`: đọc dữ liệu cũ `triggerPrefix: '!'` ra `triggerPrefixes: ['!']`; update ghi mảng và xoá trường cũ; `requireMention` luôn `true`.
- `text-input.service.spec.ts`: xoá test allowlist thụ động, đổi sang `triggerPrefixes`.

### 4.7 Docs (Hard Completion Gate)
- `.agents/knowledge/modules/zca/README.md` (EN): quy tắc kích hoạt duy nhất; bỏ L2 và `requireMention`; `triggerPrefixes` cùng giới hạn; hai cờ thu chi/lịch là reserved.
- `.agents/docs/modules/zca/README.md` (VI): giải thích lý do nghiệp vụ ("bot chỉ làm khi người dùng chủ động gọi", tiết kiệm request LLM, tránh ghi nhầm), cách đặt nhiều tiền tố trên dashboard, và cách xử lý ảnh mới (ảnh không chữ chỉ lưu; muốn ghi bill thì reply ảnh + mention bot).
- `.agents/knowledge/global/zalo-command-intake.md`: bỏ passive mode.
- Rà `.agents/knowledge|docs/modules/reminders/README.md`, `.agents/knowledge/modules/users/README.md`, `.agents/knowledge/global/llm-providers.md` (có nhắc "passive").
- `.agents/docs/README.md` nếu cần. Chạy `node .claude/hooks/docs-drift-check.mjs` đến khi exit 0.

## 5. Ngoài phạm vi
- Không migration, không xoá cột DB hoặc trường contract cũ.
- Không sửa lỗi log `Failed to send chat action "typing" … chat_id is invaild` (task riêng).
- Không đổi lệnh slash `/dashboard`… Lưu ý: nếu admin đặt tiền tố `/`, `cleanBotMention` sẽ bóc mất dấu `/` của lệnh slash. Hành vi này đã có từ trước; sẽ ghi trong docs và hiện cảnh báo nhẹ ở UI khi nhập `/`.

## 6. Kiểm chứng
1. `npm run typecheck --workspace @zalobot/contracts`, `--workspace @zalobot/api`, `--workspace @zalobot/web`
2. `npm run lint` cho 3 workspace trên
3. `npm run test --workspace @zalobot/api` (và `@zalobot/contracts` nếu thêm test cho hàm chuẩn hoá)
4. `npm run build --workspace @zalobot/web`
5. `node .claude/hooks/docs-drift-check.mjs`
6. Thử tay sau deploy, trên nhóm có tiền tố `!` và `bot:`:
   - `mua đồ 50k` → bot im, log không có `Dispatching prompt to LLM`.
   - `!mua đồ 50k` và `Bot: mua đồ 50k` → hiện thẻ xác nhận.
   - `@den mua đồ 50k` → hiện thẻ xác nhận.

## 7. Rủi ro
- Nhóm đang quen ghi thu chi không cần tag, kênh đang đặt `requireMention=false` và người dùng 1-1 hay gửi ảnh bill không kèm chữ sẽ thấy bot "im". Đây là thay đổi có chủ đích, cần báo người dùng.
- Payload modal phải giữ nguyên `expenseTracking` / `calendarExtraction`. Backend đang merge `Partial` (`thread-config.service.ts:513`), sẽ xác minh bằng test.
- Kiểu `AgentInput` đổi tên field nên mọi nơi gọi phải cập nhật; typecheck sẽ bắt lỗi.
