# Kế hoạch: Cấu hình số ngày nhớ cho trí nhớ ngắn hạn + giải thích trí nhớ dài hạn trên UI

Route: implement · Phase 1 (Planning) · Rủi ro: TRUNG BÌNH (thêm trường vào `ThreadChatMemoryConfig`, đổi cách đọc kho Redis, sửa UI; không có migration)

## 1. Trí nhớ ngắn hạn: cho chọn số ngày

### Hiện trạng và một lỗi nhỏ đi kèm

- Thời hạn đang cố định trong code: `SHORT_TERM_MEMORY_TTL_SECONDS = 24 * 3600`.
- Thời hạn này tính **từ tin cuối cùng** (mỗi lần ghi lại gia hạn `expire` cho cả list). Một kênh cứ chưa đầy 24 giờ lại có tin mới thì key không bao giờ hết hạn. Vì vậy cửa sổ ngữ cảnh có thể chứa tin từ cả tuần trước, trái với dòng chữ "Bot tự quên sau 24 giờ" trên card.

### Thay đổi

- Contract `ThreadChatMemoryConfig` thêm `shortTermDays: number`:
  - Giới hạn 1–7 ngày, mặc định 1.
  - `CHAT_MEMORY_LIMITS.SHORT_TERM_DAYS_MIN/MAX`.
  - `normalizeChatMemoryConfig` kẹp giá trị; cấu hình cũ chưa có trường này thì nhận 1, giữ đúng hành vi hiện tại.
- **Ý nghĩa mới:** chỉ dùng các tin **gửi trong N ngày gần đây**, tính theo giờ gửi của từng tin, không tính theo tin cuối nữa.
  - `ShortTermMemoryService.getRecent(channelId, { limit, maxAgeDays, excludeMsgId })` bỏ các tin có `sentAt` cũ hơn N ngày.
  - `record` / `recordBotReply` nhận `ttlDays` để đặt `expire` của key Redis = N ngày, và hạn của Map dự phòng cũng vậy. Kênh im lặng quá N ngày thì key tự xoá.
  - Bỏ hằng `SHORT_TERM_MEMORY_TTL_SECONDS` cố định.
- Truyền số ngày đi các chỗ cần:
  - `AgentInput.shortTermMemory` thành `{ contextWindow, days }`.
  - `toAgentMemory` (`zca-bot-feature.service.ts`) lấy từ cấu hình kênh.
  - `onMessage` và `ZcaService.recordBotReplyInMemory` truyền `shortTermDays` khi ghi.
  - `TextInputService.buildRecentContextBlock` truyền `days` khi đọc.
- Vì sao tối đa 7 ngày: đây là "ngắn hạn", để hiểu câu nối tiếp. Nhớ lâu hơn là việc của trí nhớ dài hạn. 7 ngày cũng khớp với bộ đệm Redis `zca:buffered_msgs` đang có.

### UI card "💬 Trí nhớ ngắn hạn"

- Đặt hai ô cạnh nhau (một cột trên mobile): "Số tin gần đây" (1–30) và **"Nhớ trong (ngày)"** (1–7).
- Dòng cảnh báo đổi thành: "…Bot chỉ dùng tin trong N ngày gần đây, tin cũ hơn tự bị quên."
- Ô số ngày cũng dùng `ChatMemoryDraft` (gõ tự do, chuẩn hoá khi rời ô) như hai ô hiện có.

## 2. Card "🧠 Trí nhớ dài hạn": giải thích rõ cho người dùng

Hiện card chỉ có một dòng mô tả và một dòng cảnh báo. Em thêm khối **"Cách hoạt động"** (danh sách gạch đầu dòng chữ nhỏ, giống `google-storage-how-it-works.tsx`), luôn hiện khi card bật:

- **Lưu gì:** mọi tin của kênh từ lúc bật, kể cả tin của người không gọi bot và tin bot trả lời. Ảnh/file chỉ lưu nhãn và tên, không lưu link. Không tự xoá theo thời gian.
- **Hỏi thế nào:** gọi bot rồi hỏi chuyện cũ, ví dụ "@bot hôm trước Nam nói gửi file gì?", "@bot tháng 5 nhóm hẹn ở đâu?". Bot tìm theo từ khoá (không phân biệt dấu) và mốc thời gian trong câu hỏi.
- **AI thấy gì:** chỉ các đoạn tìm được (mỗi kết quả kèm vài tin xung quanh, tối đa 80 dòng), không bao giờ gửi cả lịch sử. Câu trả lời ghi rõ ngày và người nói.
- **Phạm vi:** chỉ tra trong đúng kênh này, kênh khác không đọc được.
- **Thu hồi:** tin bị thu hồi trên Zalo bị xoá khỏi trí nhớ.
- **Hạn chế:** chỉ nhớ từ lúc bật. Câu hỏi tổng hợp kiểu "cả năm đi những đâu" có thể trả lời thiếu, vì bot tìm theo từ khoá.

Hint của ô "Số kết quả mỗi lần tra" đổi thành: "Tăng lên nếu bot hay trả lời thiếu; mỗi kết quả kèm vài tin xung quanh, tối đa 80 dòng gửi cho AI".

Chữ trên hai card giữ kiểu viết thẳng tiếng Việt như các card cấu hình kênh khác (không đưa vào i18n catalog), để không mở rộng phạm vi.

## File thay đổi

| File | Thay đổi |
| --- | --- |
| `packages/contracts/src/index.ts` | `shortTermDays`, giới hạn, normalize |
| `apps/api/src/zca/memory/short-term-memory.service.ts` (+ spec) | TTL theo số ngày, lọc theo tuổi tin khi đọc |
| `apps/api/src/types/agent-input.type.ts` | `shortTermMemory.days` |
| `apps/api/src/zca/zca-bot-feature.service.ts` (+ spec) | Truyền số ngày khi ghi và vào `AgentInput` |
| `apps/api/src/zca/zca.service.ts` | Truyền số ngày khi ghi tin bot |
| `apps/api/src/zca/text/text-input.service.ts` (+ spec) | Truyền số ngày khi đọc |
| `apps/api/src/zca/thread-config.service.spec.ts` | Test normalize trường mới và dữ liệu cũ |
| `apps/web/src/modules/zca/model/thread-config-form.ts` (+ spec) | Draft cho ô số ngày |
| `apps/web/src/modules/zca/presentation/components/thread-config/short-term-memory-section.tsx` | Ô số ngày, câu cảnh báo |
| `apps/web/src/modules/zca/presentation/components/thread-config/long-term-memory-section.tsx` | Khối "Cách hoạt động", hint mới |
| `.agents/knowledge/modules/zca/chat-memory.md`, `.agents/docs/modules/zca/chat-memory.md`, `CONTEXT.md` | Số ngày cấu hình được, cách tính tuổi tin |

## Lưu ý phối hợp

Phiên "google-storage-account-panel" đang có thay đổi **chưa commit** trong `packages/contracts/src/index.ts` và vài file `apps/web/src/modules/zca/`. Em chỉ sửa phần `ThreadChatMemoryConfig`. Lúc commit, nếu file đó vẫn còn thay đổi của phiên kia, em sẽ báo anh trước chứ không commit lẫn.

## Kiểm tra

- `npm run test`, `npm run typecheck`, `npm run lint` cho `@zalobot/contracts`, `@zalobot/api`, `@zalobot/web`.
- `npm run build --workspace @zalobot/web` (bắt được lỗi type trong spec mà `tsc -b` bỏ qua).
- `node .claude/hooks/docs-drift-check.mjs` exit 0.
- Trình duyệt: thử nếu dev server chạy được, không thì báo rõ là chưa kiểm.

## Cần anh quyết

- **Đơn vị và giới hạn:** em đề xuất 1–7 ngày, mặc định 1. Nếu anh muốn chỉnh theo giờ (ví dụ 6 giờ) thì em đổi sang giờ, giới hạn 1–168.
