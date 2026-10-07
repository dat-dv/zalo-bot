# Kế hoạch triển khai: response zalo gọn và nút xếp cùng hàng

RequestFeedback: false

## Mục tiêu

Giảm chiều cao các phản hồi zalo thường dùng mà vẫn giữ thông tin nghiệp vụ cần đọc; xếp các nút liên quan cùng một hàng khi tổng độ dài nhãn còn phù hợp màn hình điện thoại. Không thay đổi JSON payload hiện tại trong các hộp xác nhận kỹ thuật.

## Phạm vi và rủi ro

- **Rủi ro: trung bình.** Thay đổi nội dung hiển thị của bot và bố cục nút, không đổi dữ liệu, schema, công cụ Gemini hay Google API.
- Giữ nguyên callback data và hành vi từng nút để không làm hỏng các message đã gửi.
- Không ép các nhãn dài vào cùng hàng: zalo có thể tự xuống hàng khó đọc, nên chỉ gom các action ngắn có liên quan.

## Thiết kế

1. Chuẩn hoá response text thành cấu trúc nén: tiêu đề ngắn một dòng; số liệu/chính yếu trên cùng dòng khi dễ quét; mỗi item tối đa hai dòng; bỏ khoảng trắng, dòng phân cách và câu hướng dẫn lặp lại.
2. Gom các nút hành động ngắn vào cùng hàng:
   - menu chính giữ mỗi action một hàng vì nhãn dài và khác mục đích;
   - xác nhận/hủy giữ chung một hàng như hiện tại;
   - nhóm thông báo `Đã hiểu`/`Đóng`, action Calendar, Reminder và task checklist sẽ được xếp lại theo chiều rộng nhãn thực tế;
   - các nút dài hoặc nhiều hơn hai action tiếp tục tách hàng để không tràn giao diện mobile.
3. Rút gọn các response nhiều dòng trong `zaloUpdate`: thu–chi hôm nay, `/tasks`, kết quả thao tác xác nhận/hủy, và nhóm văn bản hỗ trợ sau thao tác.
4. Không đổi `formatConfirmationBox` JSON fallback. Các xác nhận có formatter riêng (thu–chi/task) tiếp tục hiển thị dữ liệu nghiệp vụ đầy đủ trước khi người dùng bấm xác nhận.

## Thay đổi dự kiến

| Vị trí                                                | Thay đổi                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/api/src/zalo/services/zalo-ui.service.ts`       | Điều chỉnh formatter gọn cho status/result; gom các button row ngắn theo quy tắc mobile-safe.           |
| `apps/api/src/zalo/zalo.update.ts`                    | Dùng formatter gọn cho `/tasks`, thu–chi và phản hồi thao tác; bỏ text hướng dẫn dư thừa khi đã có nút. |
| `apps/api/src/zalo/services/zalo-ui.service.spec.ts`  | Test nội dung không mất trường quan trọng và ma trận hàng nút/callback data.                            |
| `.agents/knowledge/global/` và `.agents/docs/global/` | Cập nhật hợp đồng response zalo gọn và quy tắc nút mobile.                                              |

## Tiêu chí chấp nhận

- Danh sách task vẫn có tên, hạn (nếu có), số lượng và nút hoàn tất đúng task; nhưng không có các câu/dòng thừa.
- Thu–chi vẫn có thu, chi, còn lại và các giao dịch gần nhất; nội dung ngắn hơn và dễ quét trên điện thoại.
- Nút ngắn liên quan hiển thị chung hàng; nhãn dài vẫn không bị nhồi/tràn.
- JSON fallback và payload xác nhận không thay đổi.
- Callback hiện hữu (`confirm:*`, `cancel:*`, `complete_task:*`, Calendar/Reminder) vẫn hoạt động không đổi.

## Kiểm chứng sau triển khai

1. Chạy test zalo UI mục tiêu để kiểm tra text, số dòng logic và callback data.
2. Chạy `npm run typecheck`, `npm run lint` và `git diff --check`.
3. Kiểm tra trực quan message qua fixture màn hình hẹp (không gửi zalo thật).

## Rollback

Hoàn tác các formatter và mảng button về bố cục cũ; không có dữ liệu hay migration cần khôi phục.

## Kết quả triển khai

- `/tasks` và thu–chi hôm nay đã bỏ các dòng hướng dẫn/dãn cách thừa, giữ số liệu và mục quan trọng.
- Nút hoàn tất task dùng nhãn ngắn `✅ #n` và được xếp hai nút mỗi hàng; callback data không đổi.
- Kết quả sau xác nhận được trình bày theo kết quả nghiệp vụ (tạo/hoàn thành task, lịch, reminder), không còn hiển thị JSON kỹ thuật.
- Các nút thông báo ngắn được gom cùng hàng; Calendar/Reminder dùng nhãn ngắn hơn và không nhồi nhãn dài vào một hàng.
- Đã chạy thành công test mục tiêu (10/10), `npm run typecheck`, `npm run lint` và `git diff --check`.
