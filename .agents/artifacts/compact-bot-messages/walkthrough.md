# Walkthrough: Rút gọn tin nhắn bot gửi trên Zalo

- Task slug: `compact-bot-messages`
- Plan: [implementation_plan.md](implementation_plan.md), anh duyệt ngày 25/10/2026
- Trạng thái: đã làm xong, chưa commit

## Đã làm

### Luồng xác nhận
File: `apps/api/src/zca/confirmation/`.

- Bỏ thông báo "Bạn còn N yêu cầu chờ xác nhận", cả sau khi duyệt lẫn sau khi huỷ không kèm mã.
- Thẻ chờ:
  - tiêu đề mới kèm mã, dạng `Lưu khoản chi [629]?`;
  - bỏ các dòng `(trống)` và các dòng đang để mặc định;
  - hướng dẫn duyệt gộp từ 4 dòng còn 2.
- Tên thao tác giờ tính từ loại thao tác (`pendingActionLabel`) chứ không đọc tiêu đề đã lưu, nên thẻ cũ còn trong Redis lúc deploy vẫn hiện đúng.
- Tin huỷ, tin hết hạn, tin đếm tim, `yes all`/`cancel all` và các tin lỗi đều còn một dòng. Tiêu đề dài quá 60 ký tự thì cắt và thêm `…`.
- Tin tóm tắt sau khi duyệt chỉ còn một icon ở đầu tin; dòng 2 là chữ thường.

### Lời nhắc và nhắc việc
- Tin cũ dài 5–8 dòng, có dòng gạch. Tin mới là `⏰ Nhắc: <tiêu đề>` + giờ, và `⏰ Việc: <tiêu đề>` + hạn, ghi chú, cách đánh dấu xong.
- Sửa các khoá i18n `reminder.header.*`, `task.reminder.*`, `reminderRule.nagMessage`, cả bản vi lẫn en.

### Tin trả lời của khoảng 40 tool, guard và tin media
- Mỗi tin tối đa một icon ở đầu.
- Không còn dòng gạch, tiêu đề viết hoa hay câu mẹo ở cuối.

### Câu dặn LLM
- `ZALO_PLAIN_TEXT_INSTRUCTION` bỏ câu "muốn nhấn mạnh thì dùng emoji hoặc viết hoa".
- Thay bằng: viết như người thật nhắn, câu ngắn, tối đa 1 emoji.

### Tài liệu
- `global/zalo-response-layout` (knowledge EN và docs VI): thêm quy tắc văn phong, thẻ mẫu mới, bảng tin trong luồng duyệt, lý do bỏ thông báo "Bạn còn…".
- Mô tả định dạng tin trong `modules/tasks`, `modules/reminders` và `global/i18n`.

## Khác với plan

1. **"duyệt" thay cho "lưu"** trong dòng hướng dẫn của thẻ (`❤️ hoặc yes 629: duyệt`) và trong kết quả `yes all` (`✅ Đã duyệt 3/3 yêu cầu`). Lý do: thẻ xoá giao dịch hay khoá tài khoản mà ghi "lưu" thì sai nghĩa.
2. **Bỏ tin đếm tim gửi trùng.** `ZcaBotFeatureService.onReaction` gửi thêm một tin đếm tim, ngoài tin của service xác nhận. Tin thêm này không bao giờ bị thu hồi. Nay chỉ còn một tin, và tin đó được thu hồi cùng thẻ.
3. **`/help` có thêm mục "Duyệt yêu cầu"**, gồm `yes/cancel/edit <mã>` và `yes all`/`cancel all`. Plan ghi rằng `/help` đã có hai lệnh này, nhưng thực tế không có. Đã bỏ thông báo "Bạn còn…" (tin duy nhất từng nhắc tới chúng), nên phải đưa chúng vào `/help`.
4. **Danh sách `/reminders`** in kiểu lặp bằng tiếng Việt (`hàng ngày`) thay cho chữ thô `daily`, dùng hàm có sẵn `repeatLabel`.
5. **Bỏ chữ "Tasks"** trong `/help` và các tin `/login`, vì bot không xin quyền Google Tasks; việc cần làm chỉ lưu trong zalobot.
6. **Vài nhánh nhỏ chỉ đổi chữ:**
   - `/finance` khi chưa có giao dịch chỉ gửi `Hôm nay chưa có giao dịch nào.`
   - Tin báo lưu ảnh khi cả Drive lẫn Photos đều lỗi ghi `⚠️ Chưa lưu được ảnh lên Google:` thay cho "Đã lưu".

## Kiểm tra đã chạy

| Lệnh | Kết quả |
| --- | --- |
| `npm run build --workspace @zalobot/contracts` | OK |
| `npm run typecheck` (mọi workspace) | OK |
| `npm run lint --workspace @zalobot/api`, `--workspace @zalobot/contracts` | OK |
| `npm run test --workspace @zalobot/api` | 744/744 pass |
| `npm run test --workspace @zalobot/web` | 141/141 pass |
| `node .claude/hooks/docs-drift-check.mjs` | PASS |

Test mới:
- thẻ không có dòng `(trống)` và không có dòng mặc định;
- lời nhắc chỉ hiện các cài đặt khác mặc định;
- huỷ không kèm mã thì không gửi "Bạn còn…";
- `describePendingAction` cắt tiêu đề dài và đọc đúng thẻ kiểu cũ.

## Chưa kiểm tra

- Chưa thử trên Zalo thật, vì việc đó cần ZCA đang đăng nhập. Sau khi deploy nên thử: ghi 2 khoản chi trong một tin rồi thả tim cả hai thẻ, đặt một lời nhắc, gõ `/dashboard` và `/help`.
- Hai lỗi logic thấy trong log (tin sửa tạo thẻ mới và làm mất giờ nhắc; dịp hằng năm bị lưu thành hằng tháng) chưa sửa. Hai việc này đã được đề xuất thành 2 session riêng.
