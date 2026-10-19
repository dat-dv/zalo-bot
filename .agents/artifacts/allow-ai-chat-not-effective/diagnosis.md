# Chẩn đoán: bật "Cho phép AI trò chuyện tự do (Chit-chat)" nhưng bot vẫn từ chối câu hỏi ngoài lề

## Hiện tượng
- Thread `7120342145544273834` (group) đã bật `directInteraction.allowAiChat = true`.
- Hỏi về phim chiếu rạp → bot trả lời: "hiện tại em là trợ lý tài chính, lịch hẹn và công việc cá nhân nên em chưa cập nhật được thông tin về các bộ phim…".

## Kết luận
Cờ `allowAiChat` hoạt động đúng, nhưng nó chỉ là **công tắc bật/tắt việc gửi câu trả lời**, không thay đổi cách LLM trả lời.

1. `allowAiChat` chỉ được đọc ở `apps/api/src/zalo/text/text-input.service.ts` (dòng 242, 270, 288): `false` → im lặng; `true` → gửi nguyên `response.text` qua `ConversationToolStrategy`. Log cho thấy bot đã gửi tin → nhánh `true` đã chạy.
2. System prompt (`text-input.service.ts` ~dòng 179–199) không phụ thuộc vào `allowAiChat`. Prompt gồm ~15 dòng mô tả tool tài chính/lịch/việc, và chỉ một dòng cho phép trò chuyện: "Nếu người dùng chỉ **chào hỏi hoặc trò chuyện**…". Gặp câu hỏi kiến thức chung, LLM tự xếp nó vào loại "ngoài phạm vi" rồi từ chối lịch sự.
3. `ConversationToolStrategy` chỉ gửi đi `aiReplyText`, không gọi LLM lần hai với một prompt chit-chat riêng.

## Yếu tố góp phần
- Câu hỏi về "phim đang chiếu" cần **dữ liệu thời gian thực**. Hệ thống không có web search hay grounding, nên kể cả khi sửa prompt, LLM chỉ trả lời được bằng kiến thức có sẵn (có thể đã cũ) và phải báo trước là thông tin có thể không mới.

## Đề xuất sửa (cần duyệt plan trước khi sửa code)
1. Truyền `allowAiChat` vào nơi dựng system prompt: khi `true`, thêm một đoạn cho phép trả lời tự nhiên mọi câu hỏi tổng quát (kiến thức, tư vấn, giải trí…), không được từ chối với lý do "chỉ là trợ lý tài chính", và nói rõ khi thông tin có thể đã cũ. Khi `false`, giữ nguyên hành vi hiện tại.
2. (Tuỳ chọn) Nếu LLM không gọi tool nào và `allowAiChat=true`, gọi LLM thêm một lần không kèm tool, với prompt chit-chat riêng, để câu trả lời không bị ảnh hưởng bởi danh sách tool.
3. (Tuỳ chọn, phạm vi lớn hơn) Bật Google Search grounding cho Gemini để trả lời câu hỏi cần dữ liệu thời gian thực.
4. Test hồi quy: kiểm tra system prompt có/không có đoạn chit-chat theo `allowAiChat`.
