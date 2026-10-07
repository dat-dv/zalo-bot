# Kế hoạch triển khai: cảnh báo Google Tasks có khả năng trùng

RequestFeedback: false

## Mục tiêu

Giảm việc vô tình tạo lại một Google Task chưa hoàn thành, nhưng không chặn người dùng tạo hai việc giống nhau khi đó là chủ ý. Áp dụng cho cả `create_task` và `create_tasks` trước khi người dùng bấm xác nhận.

## Phạm vi và rủi ro

- **Rủi ro: trung bình.** Thay đổi luồng xác nhận trước khi ghi dữ liệu Google cho hai công cụ; không đổi schema, OAuth hay API công khai.
- Không tự xoá/gộp/chỉnh sửa các task đã tồn tại.
- Một cảnh báo không từ chối thao tác: người dùng vẫn cần và vẫn có thể bấm **Xác nhận** để tạo task.

## Thiết kế đã chọn

1. Thêm một phép chuẩn hoá tiêu đề nội bộ trong phần Google Tasks: bỏ dấu tiếng Việt, chuyển thường, bỏ dấu câu/ngoặc, và gộp khoảng trắng.
2. Khi Gemini chuẩn bị payload `create_task` hoặc `create_tasks`, truy vấn tối đa 50 task chưa hoàn thành của đúng người dùng, sau đó tìm ứng viên trùng theo tiêu đề:
   - khớp hoàn toàn sau chuẩn hoá; hoặc
   - một tiêu đề là cụm từ đầy đủ nằm trong tiêu đề còn lại, với phần ngắn có tối thiểu hai token.
3. Lưu danh sách ứng viên cảnh báo kèm payload chờ xác nhận. Không đưa chúng vào request gửi Google khi người dùng bấm xác nhận.
4. Hiển thị hộp xác nhận Google Tasks theo dạng dễ đọc trên zalo: tên việc, ghi chú/hạn nếu có, và cảnh báo `Có thể trùng với...` cùng các task đang tồn tại. Nếu không có ứng viên, giữ nguyên trải nghiệm xác nhận hiện tại.
5. Khi xác nhận, chỉ tạo đúng payload task ban đầu, một lần; không tự tạo lại, không dedupe sau ghi.

## Thay đổi dự kiến

| Vị trí                                                            | Thay đổi                                                                                                                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/google/google-tasks.service.ts`                     | Bổ sung hàm đọc-only tìm task chưa hoàn thành có tiêu đề khả năng trùng và helper chuẩn hoá nội bộ.                                                                                           |
| `apps/api/src/gemini/gemini.service.ts`                           | Trước khi xếp `create_task`/`create_tasks` vào hàng chờ xác nhận, lấy cảnh báo theo người dùng và gắn metadata chỉ phục vụ UI; đảm bảo metadata không được truyền sang tool ghi Google.       |
| `apps/api/src/zalo/services/zalo-ui.service.ts`                   | Trình bày xác nhận task rõ ràng, bao gồm cảnh báo trùng và danh sách ứng viên; giữ escape HTML.                                                                                               |
| Kiểm thử TypeScript cạnh các module trên                          | Bao phủ chuẩn hoá, trùng hoàn toàn, trùng kiểu tiêu đề chứa nhau, không cảnh báo với tiêu đề không liên quan, batch có cả task trùng/không trùng và payload cuối cùng không chứa metadata UI. |
| `.agents/knowledge/global/google-tasks.md`                        | Mô tả hợp đồng cảnh báo: không chặn và không tự gộp task.                                                                                                                                     |
| `.agents/docs/global/google-tasks.md` và `.agents/docs/README.md` | Hướng dẫn vận hành/kiểm thử tiếng Việt cho cảnh báo trùng.                                                                                                                                    |

## Xác nhận hành vi

- Tạo `Học C# (ánh xạ bằng TS)` khi còn `Học C#`: zalo cảnh báo khả năng trùng, nhưng nút **Xác nhận** vẫn tạo đúng một task mới.
- Tạo `Học Java` khi chưa có task tương tự: không có cảnh báo trùng.
- Một batch có nhiều mục: cảnh báo theo từng mục, và sau xác nhận vẫn giữ semantics thành công một phần hiện có.
- `/tasks` và `/week` vẫn hiển thị nguyên các task Google còn chưa hoàn thành; không có lọc ẩn dữ liệu.

## Kiểm chứng sau triển khai

1. Chạy các test mục tiêu cho Google Tasks, Gemini và zalo UI.
2. Chạy `npm run typecheck`, `npm run lint` và kiểm tra format.
3. Soát diff để bảo đảm không chạm các thay đổi tài liệu/receipt đang có sẵn của người dùng.

## Rollback

Có thể gỡ phần metadata cảnh báo và formatter mới; không có migration hay thay đổi dữ liệu Google cần hoàn tác.

## Kết quả triển khai

- Đã thêm cảnh báo cho `create_task` và `create_tasks` khi tiêu đề trùng sau chuẩn hoá hoặc là bản mở rộng của một task chưa hoàn thành.
- Metadata cảnh báo chỉ dùng để hiển thị zalo và được loại bỏ trước khi gọi tool tạo task, nên một lần xác nhận chỉ tạo đúng payload ban đầu.
- Đã thêm test cho chuẩn hoá/so khớp tiêu đề và UI cảnh báo không chặn xác nhận.
- Đã chạy thành công: test mục tiêu (8/8), `npm run typecheck`, `npm run lint` và `git diff --check`.
