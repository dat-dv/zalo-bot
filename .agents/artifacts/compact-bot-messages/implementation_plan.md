# Kế hoạch: Rút gọn tin nhắn bot gửi trên Zalo

- Task slug: `compact-bot-messages`
- Route: `implement`, Phase 1 (đang chờ duyệt)
- Rủi ro: **TRUNG BÌNH**. Đụng khoảng 45 file nhưng chỉ đổi câu chữ: không đổi DB, API hay luồng nghiệp vụ. Nhiều test đang so khớp đúng từng chữ nên phải sửa theo.

## 1. Mục tiêu

Tin bot gửi trên Zalo ngắn hơn, ít icon hơn, đọc như người nhắn chứ không như AI. Bỏ hẳn thông báo "💡 Bạn còn N yêu cầu chờ xác nhận…".

## 2. Phạm vi và giả định

- Áp dụng cho mọi tin bot gửi người dùng trong `apps/api`: trả lời của tool/lệnh, thẻ chờ duyệt, tóm tắt sau khi duyệt, lời nhắc, nhắc việc, tin lỗi, và câu dặn LLM về cách viết. Anh nói "tối ưu tin nhắn lại", nên em hiểu là toàn bộ, không chỉ 4 mẫu đã dán.
- Không đụng tới: log server, trang HTML sau khi đăng nhập Google, giao diện dashboard, logic nghiệp vụ, các lệnh gõ (`yes`, `cancel`, `edit`, `yes all`…), cách thả tim/phẫn nộ.
- Giữ ❤️ và 😡 trong hướng dẫn duyệt, vì chúng chỉ người dùng phải thả cảm xúc nào.
- Hai lỗi logic thấy trong log (tin sửa tạo thẻ mới và làm mất giờ nhắc; dịp hằng năm bị lưu thành nhắc hằng tháng) **không** nằm trong plan này, đã đề xuất thành 2 session riêng.

## 3. Quy tắc viết tin mới (sẽ ghi vào knowledge)

1. Mỗi tin có tối đa 1 icon, đặt ở đầu dòng đầu tiên. Ngoại lệ duy nhất là ❤️/😡 trong hướng dẫn duyệt. Không đặt icon đầu từng dòng.
2. Không có dòng gạch `━━━`, không viết hoa cả câu, không dùng `*…*`.
3. Không có câu chào, chúc hay mẹo ở cuối tin ("💡 Bạn có thể…", "rồi nhé! 🚀", "Tuyệt vời!"). Không mở đầu câu bằng "Vui lòng".
4. Bỏ các dòng không có giá trị ("(trống)") và các dòng đang ở giá trị mặc định ("Nhắc lại: Không", "Cách nhắc: Tag trong nhóm").
5. Tin lỗi chỉ 1 dòng: `⚠️ <chuyện gì xảy ra>`, kèm cách xử lý nếu có.
6. Ở tin hết hạn và tin huỷ, tiêu đề trong ngoặc kép dài quá 60 ký tự thì cắt và thêm "…".

## 4. Thay đổi chi tiết

### A. Luồng xác nhận

File: `apps/api/src/zca/confirmation/transaction-confirmation.service.ts`, `dto-descriptor.util.ts`, `compact-summary.util.ts`, cùng các strategy truyền `title` vào `createPendingAction` (record-transaction, delete-transaction, manage-debt, set-reminder, create-task, complete-task, create/delete-calendar-event, create-place, ban).

**A1. Bỏ thông báo "Bạn còn N yêu cầu chờ xác nhận"**, cả sau khi duyệt (`processConfirm`, khoảng dòng 1484) lẫn sau khi huỷ không kèm mã (khoảng dòng 1574).

Lý do:
- Thẻ còn lại vẫn đang hiện trong chat, nên thông báo này thừa.
- Nó còn hay báo sai. Theo log lúc 22:56 và 13:59, hai thẻ bị thu hồi trong cùng một giây, tức là hai lần duyệt chạy song song. Lần duyệt xong trước vẫn đếm thẻ kia là "còn chờ". Lần duyệt sau đã thu hồi tin tạm ngay từ lúc bắt đầu, nên tin "còn 1" không bao giờ bị gỡ.

`yes all` và `cancel all` vẫn dùng như cũ và vẫn có trong `/help`.

**A2. Thẻ chờ duyệt**

Trước (log 12:02, 25/10):
```text
⏳ Xác nhận thêm việc cần làm?

• Việc cần làm: Đạt mua hoa tươi tặng Hằng nhân các dịp lễ 14/2, 8/3, 20/10 và sinh nhật
• Hạn chót: (trống)
• Nhắc lúc: 09:00 14/02/2027 (Hàng tháng); 09:00 08/03/2027; 09:00 20/10/2027
• Nhắc lại: Không
• Nhắc ai: @Diệu Hằng
• Cách nhắc: 👥 Tag trong nhóm
• Ghi chú: (trống)

👉 Thả tim (❤️) hoặc soạn: yes 446 (để xác nhận)
👉 Thả phẫn nộ (😡) hoặc soạn: cancel 446 (để hủy bỏ)
👉 Soạn: edit 446 <nội dung sửa> (để điều chỉnh)
⏱️ Tự động hết hạn sau 5 phút.
```

Sau:
```text
Thêm việc [446]?
• Việc: Đạt mua hoa tươi tặng Hằng nhân các dịp lễ 14/2, 8/3, 20/10 và sinh nhật
• Nhắc lúc: 09:00 14/02/2027 (hàng tháng); 09:00 08/03/2027; 09:00 20/10/2027
• Nhắc ai: @Diệu Hằng
❤️ hoặc yes 446: lưu · 😡 hoặc cancel 446: huỷ
edit 446 <nội dung>: sửa · tự huỷ sau 5 phút
```

Cách làm:
- Tiêu đề: bỏ icon, đưa mã lên tiêu đề, bỏ dòng trống phía sau. Ví dụ `⏳ Xác nhận lưu 🔴 khoản chi?` thành `Lưu khoản chi [629]?`.
- `renderDtoConfirmationCard`: bỏ mọi dòng có giá trị `(trống)`. Chỉ sửa một chỗ này là áp dụng được cho mọi loại thẻ.
- Dòng `Nhắc lại` không hiện khi không có nhắc lại. Dòng `Cách nhắc` chỉ hiện khi chọn nhắn riêng (`Nhắn riêng từng người`), và bỏ icon 👥/✉️.
- Thẻ thu chi: bỏ dòng `Phân loại` vì tiêu đề đã nói khoản thu hay khoản chi; bỏ 🟢/🔴.
- Thẻ công nợ: `👉 Họ nợ bạn (Phải thu)` thành `Họ nợ bạn (phải thu)`, `👈 Bạn nợ họ (Phải trả)` thành `Bạn nợ họ (phải trả)`.
- Nhóm cần nhiều tim: `❤️ x5 hoặc yes 446: lưu`.
- Hướng dẫn duyệt rút từ 4 dòng xuống còn 2.

**A3. Tin tạm và tin kết quả của luồng duyệt**

| Tin | Trước | Sau |
| --- | --- | --- |
| Đếm tim | `❤️ Đã nhận 2/5 lượt thả tim để duyệt yêu cầu [446]!` | `❤️ 2/5 [446]` |
| Hết hạn | `⏰ thêm việc cần làm "…" (mã: 446) đã hết hạn 5 phút và chưa được xác nhận.` | `[446] Hết hạn, chưa lưu: thêm việc "…"` |
| Huỷ | `❌ Đã hủy thêm việc cần làm "…" (mã: 877). Yêu cầu chưa được lưu.` | `[877] Đã huỷ: thêm việc "…"` |
| `yes all` | `🎉 Đã xác nhận thành công tất cả (3/3) yêu cầu!` | `✅ Đã lưu 3/3 yêu cầu` |
| `cancel all` | `🚫 Đã hủy tất cả (3) yêu cầu chờ xác nhận của bạn.` | `Đã huỷ 3 yêu cầu` |
| Không có gì đang chờ | `ℹ️ Không có yêu cầu nào đang chờ xác nhận.` | `Không có yêu cầu nào đang chờ.` |
| Không thấy mã | `⚠️ Không tìm thấy yêu cầu chờ xác nhận với mã "446". Vui lòng kiểm tra lại.` | `⚠️ Không có yêu cầu [446] đang chờ.` |
| Không có quyền | `⚠️ Bạn không có quyền xác nhận yêu cầu mã "446".` | `⚠️ Bạn không duyệt được yêu cầu [446].` |

Các tin còn lại trong file (sửa, lỗi khi thực hiện) viết lại theo quy tắc ở mục 3.

**A4. Tóm tắt sau khi duyệt** (`compact-summary.util.ts`)

Giữ icon ở đầu dòng 1 (✅ 🗑️ ⏰ 📅 ☑️ ⛔ 📍) để lướt chat dễ phân biệt loại tin. Bỏ icon ở các phần phụ.

```text
✅ [834] Chi 15.000đ · Ăn uống · Chuyển tiền qua MoMo tới AGB Hộ kinh doanh Mai Nha Cafe
Mai Nha Cafe · 22:52 24/10 · MoMo
```
```text
✅ [950] Thêm việc: Đạt mua hoa… · nhắc 09:00 14/02/2027 (hàng tháng) · @Văn Đạt
```

- `📍 / 🕗 / 💳` bỏ hẳn. `⏳ hạn` thành `hạn`. `⏰ nhắc` thành `nhắc`. `🔁 …` và `👤 …` chỉ còn phần chữ. `📞 gọi điện` thành `gọi điện`.
- Link hoá đơn: `🧾 <url>` thành `Hoá đơn: <url>`.
- Ghi chú của việc: `📝 <notes>` thành `Ghi chú: <notes>`.

### B. Lời nhắc và nhắc việc

File: `apps/api/src/reminders/reminder-scheduler.service.ts`, `apps/api/src/tasks/task.mapper.ts`, `packages/contracts/src/index.ts`. Sửa cả bản `vi` và `en` của các khoá `reminder.header.text`, `reminder.header.call`, `task.reminder.header`, `task.reminder.completeHint`, `reminderRule.nagMessage`.

Lời nhắc. Trước:
```text
⏰ *TING TING! LỜI NHẮC CỦA BẠN ĐÃ ĐẾN GIỜ!*
━━━━━━━━━━━━━━━━━━━━
📌 Nội dung: Hello đi ngủ
⏰ Thời điểm: 23:33 Thứ 6, 23/10/2026
━━━━━━━━━━━━━━━━━━━━
```
Sau. Nếu có tag người thì dòng tag nằm giữa header và giờ, giống hiện nay:
```text
⏰ Nhắc: Hello đi ngủ
23:33 Thứ 6, 23/10/2026
```
- Khoá `reminder.header.text` nhận thêm tham số `{title}` (`⏰ Nhắc: {title}` / `⏰ Reminder: {title}`). Phần thân chỉ còn thời gian.
- Dòng nhắc lại: `🔁 Nhắc lại 1/3` thành `Nhắc lại lần 1/3`.
- Vị trí tag (`mentions`) được tính từ độ dài header lúc chạy (`reminder-target.ts`), nên đổi chữ ở header không làm lệch tag.

Nhắc việc. Trước: header `⏰ Nhắc việc cần làm`, dòng gạch, `📌 tiêu đề`, `⏳ Hạn`, `📝 ghi chú`, dòng gạch, câu hướng dẫn. Sau:
```text
⏰ Việc: Đạt mua hoa tươi tặng Hằng…
@Văn Đạt
Hạn: 14/02
<ghi chú, tối đa 200 ký tự>
Xong thì nhắn "xong <tiêu đề>".
```

### C. Tin trả lời của lệnh và tool

Áp quy tắc ở mục 3 cho các file dưới đây. File nào không có trong danh sách thì giữ nguyên.

Các mẫu chính:

| Tin | Sau |
| --- | --- |
| `/dashboard` (`dashboard-tool.strategy.ts`) | `Dashboard: <link>` / `Mã đăng nhập app: 9860-1877` / `Link và mã chỉ dùng 1 lần, hết hạn sau 20 phút. Đừng chia sẻ.` |
| Báo cáo (`get-report-tool.strategy.ts`) | `📊 Thu 0đ · Chi 2.288.620đ · Số dư -2.288.620đ` |
| Kết nối Google xong (`google-auth.controller.ts`) | `✅ Đã kết nối Google (Calendar, Drive, Photos).` |
| Ping | `Pong, bot vẫn chạy.` |
| Nhắn quá nhanh (`users.service.ts`) | `Bạn nhắn nhanh quá, chờ 5 giây rồi gửi tiếp.` |
| Hôm nay trống (`today-tool`) | `Hôm nay không có lịch hẹn.` / `Không còn việc nào cần làm.` |
| Nhận ảnh (`image-batch-handler.service.ts`) | `Đã nhận 2 ảnh. Làm gì với ảnh?`, kèm 2 lựa chọn `1` / `2`, bỏ 👉 |

Danh sách file:
- `apps/api/src/zca/text/strategies/`: `help`, `welcome`, `status`, `today`, `week`, `finance-quick`, `debts-quick`, `tasks-quick`, `reminders-quick`, `list-tasks`, `list-calendar-events`, `users-list`, `get-storage-links`, `share-drive`, `login`, `login-google`, `zalo-login`, `zalo-logout`, `ban`, `ping`, `reset`, `dashboard`, `get-report`, `search-chat-history`. Các tool chỉ có tin lỗi: `record-transaction`, `delete-transaction`, `manage-debt`, `set-reminder`, `create-task`, `complete-task`, `create-calendar-event`, `delete-calendar-event`, `create-place`.
  - Riêng `/help`: giữ nguyên danh sách lệnh và nhóm lệnh, chỉ bỏ icon từng mục, bỏ tiêu đề in hoa và bỏ "(TOOLCALLS HỮU ÍCH)".
- `apps/api/src/zca/guards/grant-access.guard.ts`, `initial-admin-bootstrap.guard.ts`.
- `apps/api/src/zca/text/text-input.service.ts` (3 tin), `apps/api/src/zca/zca-bot-feature.service.ts` (tin tải media).
- `apps/api/src/zca/pending-image/`: `image-batch-handler.service.ts`, `strategies/create-bill-pending-image.strategy.ts`, `storage-upload-pending-image.strategy.ts`, `cancel-pending-image.strategy.ts`.
- `apps/api/src/receipt-storage/media-storage.service.ts` (tin báo đã lưu lên Drive/Photos).
- `apps/api/src/users/users.service.ts` (tin nhắn quá nhanh), `apps/api/src/google/google-auth.controller.ts`.

### D. Câu dặn LLM

`apps/api/src/zca/text/zalo-plain-text.util.ts`, hằng `ZALO_PLAIN_TEXT_INSTRUCTION`. Câu này được nối vào mọi prompt có thể trả lời vào chat. Thay dòng *"muốn nhấn mạnh thì dùng emoji hoặc viết hoa"* bằng:
```text
- Viết như người thật nhắn tin: câu ngắn, vào thẳng ý, không mở đầu hay kết thúc bằng câu xã giao, không nhắc lại yêu cầu của người dùng.
- Tối đa 1 emoji mỗi tin, không viết hoa cả câu. Gạch đầu dòng dùng "•" hoặc "-".
```
Giữ nguyên dòng cấm markdown. Bộ lọc `toZaloPlainText` không đổi.

## 5. Test

- Sửa kết quả mong đợi trong: `transaction-confirmation.service.spec.ts`, `compact-summary.util.spec.ts`, `dto-descriptor.util.spec.ts`, `zalo-plain-text.util.spec.ts`, `task.mapper.spec.ts`, `task-reminder-scheduler.service.spec.ts`, `reminder-scheduler.service.spec.ts`, `reminder-target.spec.ts`, `help-tool.strategy.spec.ts`, `text-input.service.spec.ts`, `pending-image.spec.ts`, `get-storage-links-tool.strategy.spec.ts`, `zca-bot-feature.service.spec.ts`, và các spec khác nếu bị đỏ vì đổi chữ.
- Thêm test:
  - Thẻ chờ không có dòng `(trống)`, không có dòng `Nhắc lại: Không`, không có dòng `Cách nhắc` khi tag trong nhóm.
  - Duyệt một thẻ khi còn thẻ khác thì không gửi tin "Bạn còn…". Huỷ không kèm mã cũng vậy.
  - Lời nhắc có tag: vị trí `mentions` vẫn khớp đúng tên với header mới.

## 6. Tài liệu (bắt buộc trước khi xong)

- `.agents/knowledge/global/zalo-response-layout.md` và `.agents/docs/global/zalo-response-layout.md`:
  - thay quy tắc "heading line (emoji prefix)" bằng quy tắc ở mục 3;
  - cập nhật thẻ mẫu, bảng tóm tắt và bảng tin tạm;
  - bỏ "remaining notice" khỏi vòng đời thu hồi tin (bước 1 và 4) và khỏi dòng "Unchanged".
- `.agents/knowledge/modules/tasks/README.md` và `.agents/docs/modules/tasks/README.md`: định dạng tin nhắc việc.
- `.agents/knowledge/modules/reminders/README.md`, cùng tài liệu tương ứng trong `.agents/docs/modules/reminders/` nếu có: header mới có `{title}`, dòng nhắc lại.
- `.agents/knowledge/global/i18n.md`: khoá `reminder.header.text` có tham số `{title}`.
- `.agents/docs/README.md` nếu bảng mapping thay đổi.
- `node .claude/hooks/docs-drift-check.mjs` phải trả về 0.

## 7. Kiểm tra

- `npm run build --workspace @zalobot/contracts` (api dùng bản `dist`)
- `npm run typecheck --workspace @zalobot/api`
- `npm run lint --workspace @zalobot/api`
- `npm run test --workspace @zalobot/api`
- `node .claude/hooks/docs-drift-check.mjs`
- Không thử được trên Zalo thật trong phiên này, vì cần ZCA đang đăng nhập. Sẽ ghi rõ là chưa kiểm tra bước này.

## 8. Thứ tự làm

1. Câu dặn LLM (mục D).
2. Luồng xác nhận (mục A) và test của nó.
3. Lời nhắc, nhắc việc, contracts (mục B) và test.
4. Tin trả lời của lệnh và tool (mục C) và test.
5. Tài liệu (mục 6) và chạy kiểm tra (mục 7).

Không tự commit. Khi anh bảo commit, hook pre-commit sẽ tự tăng version và ghi CHANGELOG.

## 9. Hoàn tác

Chỉ đổi chuỗi ký tự, không có migration hay đổi dữ liệu. Revert commit là xong.

## 10. Mặc định em đã chọn (anh sửa nếu không đồng ý)

- Vẫn gửi tin báo hết hạn, chỉ rút gọn, để người dùng biết yêu cầu chưa được lưu.
- Giữ 1 icon ở đầu tin kết quả (✅ 🗑️ ⏰ …) để dễ lướt chat.
- Mọi tin vẫn bằng tiếng Việt như hiện nay. Chỉ các khoá i18n đang có bản tiếng Anh mới được sửa cả hai ngôn ngữ.
