# Kế hoạch: Tách UI "Ngữ cảnh gần đây" và "Tra lại chuyện cũ" trong card Trí nhớ hội thoại

Route: implement · Phase 1 (Planning) · Rủi ro: THẤP–TRUNG BÌNH (chỉ sửa UI web, không đổi API/schema)

## Vấn đề

Card "🧠 Trí nhớ hội thoại" (`chat-memory-section.tsx`) đặt hai ô số cạnh nhau trong cùng một lưới:

- **Số tin ngữ cảnh gần đây** (`contextWindow`): chạy ở **mọi tin nhắn**, giúp bot hiểu câu nối tiếp.
- **Số kết quả mỗi lần tra** (`searchLimit`): chỉ chạy khi bot gọi tool `SEARCH_CHAT_HISTORY` để tra chuyện cũ.

Hai cài đặt này điều khiển hai cơ chế khác nhau nhưng nhìn như cùng một tính năng, nên dễ hiểu nhầm là trùng nhau.
Muốn tắt ngữ cảnh gần đây thì phải gõ `0`, không có công tắc nào rõ ràng.

## Đề xuất (chỉ đổi UI, giữ nguyên dữ liệu)

Giữ một card với một công tắc chính (công tắc này vẫn bật/tắt việc **lưu tin**, vì cả hai cơ chế đều đọc từ tin đã lưu).
Bên trong card chia thành hai khối riêng, mỗi khối có tiêu đề và mô tả riêng:

```
🧠 Trí nhớ hội thoại                                   [công tắc chính]
   Lưu tin nhắn của kênh để bot dùng lại
   ⚠ Bot lưu mọi tin nhắn của kênh, kể cả của người không dùng bot...
 ───────────────────────────────────────────────
 💬 Hiểu câu nối tiếp                                  [công tắc phụ]
    Gắn vài tin gần nhất vào mỗi lượt để bot hiểu "còn cái kia?", "ghi giúp cái đó"
    [Số tin gần đây: 10]           ← chỉ hiện khi công tắc phụ bật
 ───────────────────────────────────────────────
 🔎 Tra lại chuyện cũ
    Khi hỏi "@bot hôm trước Nam nói gửi file gì?", bot tìm trong tin đã lưu
    [Số kết quả mỗi lần tra: 15]
```

- Công tắc phụ "Hiểu câu nối tiếp" = `contextWindow > 0`.
  - Tắt → `contextWindow = 0`, ẩn ô số.
  - Bật → khôi phục giá trị cũ trước khi tắt (nếu có), không thì dùng `CHAT_MEMORY_DEFAULTS.contextWindow` (10).
  - Ô số giữ `min = 1` khi bật. Gõ `0` rồi rời ô thì công tắc tự chuyển sang tắt (theo `normalizeChatMemoryConfig`).
- Không đổi `ThreadChatMemoryConfig`, API, backend, migration. Dữ liệu cũ hiển thị đúng: `contextWindow = 0` → công tắc phụ tắt.
- Theo [keep-small-radius]: giữ `rounded-[3px]`/`rounded`, chỉ dùng lại `ConfigToggleRow`, `ConfigField`, đường kẻ `border-t border-slate-100`.

## Thay đổi file

| File | Thay đổi |
| --- | --- |
| `apps/web/src/modules/zca/presentation/components/thread-config/chat-memory-section.tsx` | Chia hai khối như sơ đồ; thêm `ConfigToggleRow` cho ngữ cảnh gần đây; đổi mô tả card thành mô tả việc lưu tin. |
| `apps/web/src/modules/zca/model/thread-config-form.ts` | Thêm hàm thuần `toggleContextWindow(draft, enabled, lastValue)` (hoặc tương đương) để tính draft khi bật/tắt, tách khỏi component. |
| `apps/web/src/modules/zca/model/thread-config-form.spec.ts` | Test: tắt → `'0'`; bật lại → khôi phục giá trị cũ; bật khi chưa có giá trị cũ → `10`. |
| `.agents/knowledge/modules/zca/chat-memory.md` | Cập nhật dòng mô tả card trên dashboard (hai khối, công tắc phụ). |
| `.agents/docs/modules/zca/chat-memory.md` | Cập nhật phần hướng dẫn cấu hình trên dashboard (tiếng Việt). |

Chuỗi hiển thị trong card hiện viết thẳng tiếng Việt (không qua i18n catalog), em giữ đúng kiểu đó để không mở rộng phạm vi.

## Phương án khác (không chọn)

Tách thành **card riêng** "💬 Hiểu câu nối tiếp" với công tắc độc lập với việc lưu tin. Phương án này cần sửa backend:
ngữ cảnh gần đây đang đọc từ bảng `zca_messages`, mà bảng chỉ có dữ liệu khi trí nhớ bật. Muốn tách thật thì phải
lưu tin cả khi trí nhớ tắt, hoặc đọc từ bộ đệm Redis. Như vậy là đổi hành vi và quyền riêng tư nên em không làm ở bước này.

## Kiểm tra

1. `npm run test --workspace @zalobot/web` (spec của `thread-config-form`).
2. `npm run typecheck --workspace @zalobot/web`, `npm run lint --workspace @zalobot/web`.
3. Mở `/zca/thread?id=…` trên dev server: bật/tắt công tắc phụ, lưu, F5 xem giá trị giữ đúng; xem mobile (375px) và dark mode.
4. `node .claude/hooks/docs-drift-check.mjs` phải exit 0.
