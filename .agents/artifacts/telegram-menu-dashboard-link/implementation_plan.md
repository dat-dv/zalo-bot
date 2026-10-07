---
RequestFeedback: true
---

# Kế hoạch sửa menu zalo và liên kết Dashboard

## Mục tiêu

Đồng nhất menu xuất hiện dưới `/start` và `/help`, đồng thời để nút **📊 Xem báo cáo** mở Dashboard trực tiếp trong một lần bấm.

## Phạm vi thay đổi

| Khu vực                                         | Thay đổi dự kiến                                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/zalo/services/zalo-ui.service.ts` | Dùng nút URL cho Dashboard khi đã có `reportsUrl`; cung cấp cùng một cấu hình inline menu cho `/start` và `/help`.                                               |
| `apps/api/src/zalo/zalo.update.ts`              | Giữ callback cũ chỉ nếu cần hỗ trợ các tin nhắn đã gửi; nếu không cần, xoá handler không còn đường gọi. Bảo đảm các lệnh gửi cùng quy ước xoá reply keyboard cũ. |
| Kiểm thử zalo (mới hoặc theo cấu trúc sẵn có)   | Kiểm tra menu cùng trạng thái có cùng cấu trúc ở `/start` và `/help`; kiểm tra Dashboard có `url` và không có `callback_data`.                                   |
| `.agents/knowledge` và `.agents/docs`           | Cập nhật hợp đồng hiển thị menu/link Dashboard vì đây là thay đổi hành vi người dùng.                                                                            |

## Các bước thực hiện

1. Sửa menu dùng chung để nút Dashboard là URL trực tiếp, giữ token đổi phiên được tạo tại thời điểm trả lời `/start` hoặc `/help`.
2. Chuẩn hoá cách gửi inline menu: xoá reply keyboard cũ trước/đồng thời khi phát menu để zalo không giữ giao diện menu cũ.
3. Xử lý callback Dashboard của các tin nhắn cũ theo hướng tương thích an toàn, tránh làm hỏng các tin đã gửi trước khi triển khai.
4. Thêm kiểm thử ở tầng `zaloUiService` để khóa cấu trúc các nút, đặc biệt trường `url` của Dashboard.
5. Cập nhật tri thức canonical tiếng Anh và tài liệu phát triển tiếng Việt, rồi chạy kiểm tra định dạng, kiểu, build và kiểm thử phù hợp.

## Rủi ro và giảm thiểu

- Link exchange chỉ dùng một lần: menu có thể nằm lâu trong lịch sử chat. Cách xử lý là vẫn tạo link mới khi người dùng gọi `/start` hoặc `/help`; các nút callback cũ tiếp tục tạo một link mới ở handler tương thích.
- zalo không cho sửa reply keyboard của tin nhắn cũ: áp dụng quy tắc xoá keyboard khi gửi menu mới; người dùng chỉ cần gọi lại `/start` hoặc `/help` để nhận giao diện mới.
- Không thay đổi API, cơ sở dữ liệu hay cơ chế xác thực Dashboard.

## Tiêu chí nghiệm thu

1. Bấm **📊 Xem báo cáo** trên menu mới mở URL Dashboard ngay, không phát thêm một tin nhắn trung gian.
2. `/start` và `/help` có cùng dãy nút theo cùng trạng thái đăng nhập/quyền admin.
3. Sau khi gọi một trong hai lệnh, reply keyboard cũ không còn chiếm vùng nhập liệu.
4. Kiểm thử, typecheck, lint và build liên quan đều đạt.
