# Điều tra tạo nhiều mục và Dashboard

## Hiện tượng

1. Khi người dùng yêu cầu tạo nhiều mục, ví dụ “cà phê và cam”, bot chỉ tạo một Google Task.
2. Khi người dùng nhắn “Dashboard” hoặc “Cho anh xem dashboard”, bot trả lời rằng Dashboard chưa có dù ứng dụng đã có dashboard và link truy cập.

## Nguyên nhân

### 1. Chỉ tạo một mục

- Công cụ `create_task` có payload đơn (`title`, `notes`, `due`), không hỗ trợ mảng công việc.
- `GeminiService.chat()` chỉ lấy `functionCalls[0]`.
- Với `create_task`, service lập tức tạo một pending confirmation và `return`; các function call còn lại (nếu Gemini tạo ra) không được xử lý.

Vì vậy, danh sách không thể được tạo đủ, kể cả khi AI đã nhận biết nhiều mục.

### 2. Dashboard

- Dashboard thực tế đã có đường dẫn `/api/access?token=...`, trang web `/reports`, nút URL trong menu `/start`/`/help`, và callback cũ `action:view_reports`.
- Không có command `dashboard` và system prompt không có quy tắc nhận diện yêu cầu xem Dashboard.
- Khi người dùng nhắn tự do “Dashboard”, câu trả lời hoàn toàn do Gemini sinh ra và có thể sai thực tế. Bằng chứng là nó trả lời “sắp ra mắt”, trái với mã hiện có.
- Trong đoạn chat, `/task` cũng không phải command được khai báo (mã chỉ khai báo `/tasks`), cho thấy nhiều lệnh đang rơi vào luồng AI tự do thay vì handler cố định.

## Phạm vi bị ảnh hưởng

- `apps/api/src/gemini/gemini.service.ts`
- `apps/api/src/gemini/tools/create-task.tool.ts`
- `apps/api/src/gemini/helpers/gemini-prompt.helper.ts`
- `apps/api/src/zalo/zalo.update.ts`

## Hướng sửa an toàn

1. Thêm công cụ batch tạo Google Tasks nhận mảng mục; xác nhận phải hiển thị toàn bộ danh sách và khi duyệt thì tạo tất cả, có kết quả từng mục.
2. Hỗ trợ `dashboard` bằng command rõ ràng và/hoặc nhận diện văn bản để trả về nút URL dashboard thật; không đưa câu hỏi này vào LLM tự do.
3. Thêm aliases chuẩn như `/task` -> `/tasks` nếu đây là cú pháp người dùng đã dùng.
4. Bổ sung kiểm thử: danh sách hai mục tạo hai Task sau xác nhận; `Dashboard`, `/dashboard`, `/task`, `/tasks` đi đúng luồng.

## Hạn chế xác minh

Không có log production hoặc bản ghi request Gemini cho câu “cà phê và cam”, nên không thể xác nhận payload chính xác mà model đã phát. Tuy nhiên, mã hiện tại đã đủ để chứng minh kiến trúc chỉ cho phép một pending `create_task` cho mỗi tin nhắn.
