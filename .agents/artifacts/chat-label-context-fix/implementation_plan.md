---
RequestFeedback: true
Route: implement
Authority: inspect-and-plan
Risk: medium
---

# Kế hoạch sửa ngữ cảnh và định dạng phản hồi zalo

## Mục tiêu

Loại bỏ các nhãn thao tác mơ hồ trong chat, bảo đảm `/week` không điều hướng sang `/today`, và làm sạch các thực thể HTML/escape thừa xuất hiện trong phản hồi do AI tạo, như `&#x20;` và `\&`.

## Phạm vi thay đổi

1. `apps/api/src/zalo/services/zalo-ui.service.ts`
   - Đổi nhãn nút báo cáo hôm nay thành `🔄 Cập nhật lịch hôm nay`.
   - Thêm bộ nút riêng cho báo cáo 7 ngày: `🔄 Cập nhật lịch 7 ngày`, `📝 Việc cần làm`, `❌ Đóng`.
   - Chuẩn hóa văn bản AI ngay trước khi gửi zalo: giải mã HTML entity số/phổ biến trong phần văn bản (bao gồm `&#x20;`) và bỏ escape thừa trước dấu `&` trong URL Markdown. Không chuyển toàn bộ định dạng sang HTML và không thay đổi callback/JSON xác nhận.

2. `apps/api/src/zalo/zalo.update.ts`
   - Gắn bộ nút 7 ngày cho `/week`.
   - Thêm callback làm mới 7 ngày, gọi lại `onWeek()`; giữ nguyên callback làm mới hôm nay cho `/today`.

3. `apps/api/src/zalo/zalo-menu.catalog.ts`
   - Đổi nhãn menu `💳 Công nợ` thành `💳 Công nợ đang mở`, khớp với dữ liệu mà `/debts` thực sự trả về (cần thu/cần trả chưa tất toán).

4. `apps/api/src/zalo/services/zalo-ui.service.spec.ts` và kiểm thử handler zalo phù hợp
   - Khóa hành vi: `/today` nhận callback hôm nay, `/week` nhận callback tuần.
   - Xác nhận nút tuần có nhãn rõ phạm vi và callback làm mới tuần.
   - Xác nhận `sendSafeReply` gửi `&#x20;` thành khoảng trắng và URL có `\&` thành `&`, nhưng vẫn giữ Markdown thông thường.
   - Xác nhận menu hiển thị nhãn công nợ mới.

5. Tài liệu đồng bộ
   - Cập nhật `.agents/knowledge/global/zalo-response-layout.md` bằng tiếng Anh: nhãn hành động phải nêu rõ phạm vi thời gian/dữ liệu và phản hồi AI cần được chuẩn hóa trước khi gửi Markdown.
   - Cập nhật `.agents/docs/global/zalo-response-layout.md` bằng tiếng Việt, kèm bước kiểm tra `/today`, `/week`, công nợ và entity HTML.
   - Cập nhật `docs/zalo-bot.md` để mô tả chính xác cơ chế chuẩn hóa đầu ra AI, thay cho mô tả chỉ fallback khi Markdown lỗi.

## Không thay đổi

- Không đổi dữ liệu Google Calendar, Google Tasks, công nợ, lịch sử hoặc schema/database.
- Không đổi quyền zalo, OAuth hay callback xác nhận thao tác ghi dữ liệu.
- Không đổi cấu trúc menu hay quyền admin; chỉ làm rõ nhãn công nợ.

## Xác minh sau khi thực hiện

1. Chạy kiểm thử mới cho UI và handler zalo; kiểm thử hiện tại của `/week` phải chuyển từ lỗi `got: today` sang nhận đúng hành động tuần.
2. Chạy `npm run typecheck`, `npm run lint`, và các kiểm thử API liên quan.
3. Kiểm tra thủ công trên zalo: `/today`, `/week`, `/start`, `/help`, `/debts`; xác nhận không còn `&#x20;`, “Cập nhật” nói rõ phạm vi và nhấn làm mới không chuyển sai báo cáo.

## Rủi ro và hoàn tác

Rủi ro ở mức trung bình vì thay đổi đồng thời luồng callback và bộ lọc văn bản AI. Chuẩn hóa chỉ nhắm vào entity/escape hiển thị sai trước khi gửi, có kiểm thử giới hạn để tránh làm hỏng Markdown hợp lệ. Có thể hoàn tác an toàn theo từng nhóm: bỏ chuẩn hóa đầu ra, khôi phục nhãn, hoặc bỏ callback tuần mà không ảnh hưởng dữ liệu người dùng.

## Kết quả thực hiện

- Hoàn thành các thay đổi trong phạm vi kế hoạch.
- Đã chạy thành công 12 kiểm thử zalo, `npm run typecheck` và `npm run lint`.
- Đã rà soát diff; không có lỗi whitespace. Các thay đổi sẵn có ngoài phạm vi ở `apps/api/src/zalo/zalo.module.ts` và `.agents/artifacts/fix-zalo-reports-token-di/` được giữ nguyên.
