---
metadata:
  agent-artifact:
    id: docs-global-zalo-response-layout
    type: documentation
    depends_on:
      - .agents/knowledge/global/zalo-response-layout.md
---

# Bố cục phản hồi zalo

Hướng dẫn này ánh xạ trực tiếp với tri thức canonical [`zalo-response-layout.md`](../../knowledge/global/zalo-response-layout.md).

Response zalo cần ưu tiên nội dung người dùng cần quyết định hoặc đọc ngay: một tiêu đề ngắn, số liệu chính cùng dòng và từng mục tối đa hai dòng. Không thêm đường phân cách hoặc hướng dẫn lặp lại khi nút bên dưới đã thể hiện hành động kế tiếp.

Các nút ngắn, liên quan trực tiếp có thể cùng một hàng. Nút dài phải để hàng riêng để không bị tràn trên điện thoại. Khi có cùng một hành động ở nhiều phạm vi, nhãn phải nói rõ phạm vi: làm mới lịch hôm nay và làm mới lịch 7 ngày dùng hai callback riêng. Không đổi callback data và không đổi JSON fallback của hộp xác nhận, trừ callback mới cần thiết cho một phạm vi mới.

Trước khi gửi Markdown do AI tạo, bot giải mã HTML entity và bỏ escape thừa trước dấu `&` trong URL. Vì vậy chuỗi như ` ` hoặc `\&ctz` không được xuất hiện nguyên văn trong chat.

Các tin nhắn danh sách/thông tin có nút thao tác dài hạn — tổng kết hôm nay, danh sách việc, trạng thái tài khoản, danh sách người dùng, chi tiết công nợ và liên kết Dashboard/Báo cáo — phải có nút `❌ Đóng`. Khi bấm, bot ưu tiên xóa tin nhắn; nếu zalo không cho phép xóa thì gỡ toàn bộ bàn phím inline để không còn thao tác cũ. Hộp xác nhận vẫn dùng `Hủy`; biên nhận Reminder và Calendar giữ `Ẩn nút` để không làm mất lịch sử thao tác.

## 1. Cấu Trúc Hộp Xác Nhận (Confirmation Cards) & Giải Thích Tác Động 2 Chiều

Mọi hộp xác nhận (`formatConfirmationBox`) đều chia làm 4 khối trực quan rõ ràng:

1. **Thông tin nghiệp vụ chính**: Thẻ tóm tắt chi tiết (loại thu/chi, số tiền format VND, nơi chốn, danh mục, thời gian phát sinh, đối tác công nợ, hạn chót).
2. **Khối giải thích tác động hệ thống (`🎯 Tác động hệ thống:`)**: Nêu rõ ràng hành vi 2 chiều cho người dùng:
   - `• ✅ Nếu Xác nhận`: Thao tác cụ thể sẽ diễn ra (ghi sổ, tạo nơi chốn mới, trừ nợ, đồng bộ Google Tasks/Calendar,...).
   - `• ❌ Nếu Hủy bỏ`: Cam kết an toàn (không có dữ liệu nào bị thay đổi, số dư/danh bạ giữ nguyên).
3. **Khối minh bạch kỹ thuật (`🔍 Chi tiết kỹ thuật (Payload JSON...):`)**: Khối `<pre><code class="language-json">...</code></pre>` chứa chính xác JSON payload gọi API (tuân thủ quy định `ai-tool-transparency-and-resolution.md`).
4. **Mã yêu cầu & Nút bấm**: Mã định danh (ví dụ `🔖 Mã: REQ-XXXXXX`) kèm cặp nút `[✅ Xác nhận]` và `[❌ Hủy bỏ]`.

## 2. Trạng Thái Callout Sau Khi Phê Duyệt / Hủy Bỏ (Context Preservation)

Sau khi người dùng tương tác hoặc khi tin nhắn bị hủy tự động:

- **Xác nhận thành công (`formatConfirmedBox`)**: Cập nhật tin nhắn thành thẻ Callout xanh:
  - Header: `✅ ĐÃ XÁC NHẬN & THỰC HIỆN THÀNH CÔNG`
  - Mã tham chiếu `🔖 Mã: REQ-XXXXXX`
  - Kết quả mới ghi nhận (`✨ Kết quả đã ghi nhận:`)
  - Nội dung yêu cầu gốc đã duyệt (`📋 Nội dung yêu cầu đã duyệt:`) -> Người dùng dễ dàng đối chiếu, không bị mất ngữ cảnh giao dịch.
- **Hủy bỏ thao tác (`formatCancelledBox`)**: Cập nhật tin nhắn thành thẻ Callout đỏ:
  - Header: `❌ ĐÃ HỦY YÊU CẦU THAO TÁC`
  - Lời bảo đảm an toàn dữ liệu (`🛡️ Yêu cầu đã được hủy an toàn. Không có bất kỳ dữ liệu nào bị thay đổi...`)
  - Nội dung yêu cầu đã hủy (`📋 Nội dung yêu cầu đã hủy:`)
- **Tự động hủy khi có tin nhắn mới**: Nếu người dùng đang có hộp xác nhận nhưng gửi tin nhắn mới (text/voice/ảnh), tin nhắn cũ tự động chuyển sang Callout đã hủy và gỡ bỏ inline buttons.

## 3. Danh Mục Kiểm Tra (Verification Checklist)

1. Mọi hộp xác nhận (18 công cụ) đều hiển thị đầy đủ 4 khối: Nghiệp vụ + Tác động hệ thống + Chi tiết kỹ thuật JSON + Nút bấm.
2. Khối JSON payload render đúng cú pháp `language-json`, HTML entity được escape an toàn.
3. Khi bấm Xác nhận, tin nhắn chuyển sang Callout thành công, giữ nguyên tóm tắt yêu cầu gốc và hiển thị kết quả mới.
4. Khi bấm Hủy hoặc khi gửi tin nhắn mới làm hủy tự động, tin nhắn chuyển sang Callout hủy an toàn kèm tóm tắt yêu cầu đã hủy.
5. Chạy `npm run test --workspace @zalobot/api`, `npm run typecheck`, `npm run lint` và `npm run agent-system:validate` đều pass 100%.
