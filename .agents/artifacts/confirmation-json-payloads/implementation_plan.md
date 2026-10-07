---
RequestFeedback: true
---

# Kế hoạch: JSON cho mọi thẻ xác nhận zalo

## Mục tiêu

Mọi thẻ xác nhận trước khi bot thực thi hành động phải hiển thị payload JSON đã được chuẩn hóa, để người dùng kiểm tra chính xác dữ liệu sẽ được gửi đi.

## Phát hiện hiện trạng

- Mọi thẻ xác nhận đều được dựng tại `zaloUiService.formatConfirmationBox`.
- JSON hiện mới được hiển thị cho `create_finance_transaction`, `create_debt` và mẫu dự phòng không có giao diện riêng.
- Các thẻ còn lại (cập nhật/ghi thu–chi hàng loạt, việc, công nợ, lịch, lời nhắc, quản trị và xóa công nợ) không hiển thị JSON.
- Luồng xóa công nợ đi qua cùng hàm với payload `{ debtId }`, nên cũng được bao phủ.

## Thay đổi dự kiến

1. Tạo helper dùng chung tại `zaloUiService` để render `Payload JSON` trong khối `<pre><code class="language-json">…</code></pre>`, luôn escape nội dung trước khi hiển thị.
2. Gắn helper này vào tất cả nhánh xác nhận riêng trong `formatConfirmationBox`, giữ nguyên phần tóm tắt thân thiện và nút xác nhận/hủy hiện tại.
3. Dùng payload cuối cùng đã được xếp hàng xác nhận; không tự thêm dữ liệu ngoài payload và không hiển thị thông tin nội bộ như mã thao tác hoặc dữ liệu cảnh báo chỉ phục vụ giao diện.
4. Mở rộng kiểm thử `zalo-ui.service.spec.ts` để khẳng định từng loại thao tác bắt buộc xác nhận — cùng xóa công nợ — có nhãn `Payload JSON` và JSON được escape an toàn.
5. Cập nhật tài liệu canonical `knowledge/global/zalo-response-layout.md`, tài liệu vận hành `docs/global/zalo-response-layout.md`, và chỉ mục `docs/README.md` nếu cần, để ghi nhận quy ước hiển thị mới.

## Danh sách thao tác được bao phủ

`create_calendar_event`, `delete_calendar_event`, `create_task`, `create_tasks`, `complete_task`, `create_invite_link`, `ban_user`, `create_reminder`, `delete_reminder`, `create_finance_transaction`, `create_finance_transactions`, `update_finance_transaction`, `create_debt`, `record_debt_payment`, `update_debt_contact`, `update_reminder`, và `delete_debt`.

## Kiểm chứng sau triển khai

- Chạy kiểm thử API, bao gồm bộ kiểm thử thẻ xác nhận.
- Chạy `npm run typecheck`, `npm run lint` và kiểm tra định dạng thay đổi.
- Kiểm tra thủ công các JSON có ký tự HTML để xác nhận payload không thể phá vỡ định dạng zalo.
