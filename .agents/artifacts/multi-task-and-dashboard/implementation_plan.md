# Kế hoạch: tạo nhiều Task và mở Dashboard đúng

RequestFeedback: true

## Mục tiêu

1. Một yêu cầu chứa nhiều việc, ví dụ “thêm mua cà phê và cam”, phải tạo đủ hai Google Tasks sau một lần xác nhận.
2. `Dashboard`, “cho anh xem dashboard” và `/dashboard` phải trả về link Dashboard thật, không dùng câu trả lời suy đoán của AI.
3. `/task` là alias của `/tasks`.

## Thay đổi dự kiến

1. Thêm tool batch `create_tasks` trong Gemini.
   - Payload gồm `tasks: [{ title, notes?, due? }]`.
   - Xác thực tối thiểu một mục và giới hạn số mục theo một yêu cầu để tránh thao tác quá lớn.
   - Khi người dùng xác nhận, gọi Google Tasks lần lượt cho từng mục.
   - Trả kết quả theo từng mục để phân biệt mục thành công và lỗi; không che giấu lỗi một phần.
2. Đăng ký tool batch vào `GeminiModule` và `GeminiService`.
   - Đưa `create_tasks` vào danh sách thao tác cần xác nhận.
   - Giữ `create_task` hiện tại cho yêu cầu một việc, tránh thay đổi hành vi cũ.
3. Cập nhật system prompt.
   - Phân biệt rõ một việc với danh sách/checklist nhiều việc.
   - Yêu cầu Gemini dùng `create_tasks` khi người dùng nêu từ hai việc độc lập trở lên.
4. Cập nhật `zaloUpdate`.
   - Thêm `/dashboard`, tạo link báo cáo an toàn rồi gửi nút URL thật.
   - Nhận diện văn bản ngắn “dashboard”, “cho anh xem dashboard”, “mở dashboard” trước khi chuyển sang Gemini để không còn câu trả lời bịa.
   - Thêm decorator `/task` vào handler `/tasks`.
5. Thêm kiểm thử hồi quy.
   - Batch tool gọi tạo Task đúng số lần và báo kết quả từng mục.
   - Xác nhận batch thao tác trước khi chạy, tương tự thao tác đơn.
   - `/task` và `/tasks` cùng gọi luồng liệt kê.
   - Dashboard gửi URL thật; khi không tạo được URL thì báo lỗi rõ ràng, không gọi Gemini.
6. Đồng bộ tài liệu.
   - Cập nhật canonical knowledge tiếng Anh và hướng dẫn vận hành tiếng Việt cho batch task, lệnh Dashboard, aliases và tình huống lỗi.

## Quyết định thiết kế

- Dùng tool batch riêng thay vì cố gọi nhiều `create_task`: cơ chế hiện tại chỉ giữ một pending confirmation, nên tool riêng đảm bảo người dùng chỉ cần xác nhận một lần cho toàn bộ danh sách.
- Batch thực hiện tuần tự. Google Tasks không có transaction đa mục; vì vậy nếu có lỗi giữa chừng, bot sẽ báo chính xác mục nào thành công/mục nào thất bại, không tự xóa các mục đã tạo.
- Dashboard được xử lý cố định trong zalo handler, không qua Gemini, vì đây là khả năng đã có và phải có câu trả lời xác định.

## Rủi ro và giảm thiểu

- Một batch có thể thành công một phần nếu Google API lỗi: hiển thị kết quả từng mục và giữ các mục đã tạo.
- Nhận diện “dashboard” chỉ áp dụng cho câu ngắn/rõ nghĩa để không chặn các câu hỏi phức tạp về nội dung dashboard.
- Không thay đổi database schema, quyền truy cập hay hợp đồng API Dashboard.

## Xác minh sau khi triển khai

1. Build API.
2. Chạy kiểm thử mới cho batch và command routing.
3. Chạy `npm run typecheck`, `npm run lint` và `npm run agent-system:validate`.
4. Rà diff để bảo đảm không có thay đổi ngoài phạm vi.

## Kết quả triển khai

- Đã thêm `create_tasks`: nhận 1–20 task, tạo tuần tự sau một xác nhận, và trả kết quả thành công/thất bại theo từng mục.
- Đã đăng ký tool batch và cập nhật prompt để tách danh sách nhiều việc khỏi một việc đơn.
- Đã thêm `/task`, `/dashboard` và nhận diện các yêu cầu Dashboard ngắn để không chuyển sang Gemini.
- Đã thêm kiểm thử batch Google Tasks và regression check cho routing Dashboard.
- Đã cập nhật canonical knowledge cùng hướng dẫn vận hành cho Task batch và Dashboard.
- Đã xác minh build API, test batch, regression check Dashboard, typecheck, lint và agent-system validation đều đạt.
