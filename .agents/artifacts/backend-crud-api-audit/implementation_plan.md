---
RequestFeedback: true
route: implement
authority: inspect-and-plan
risk: high
title: Bổ sung REST CRUD cho các tài nguyên nghiệp vụ backend
---

# Kế hoạch: Hoàn thiện REST CRUD Backend

## Kết luận rà soát

API HTTP hiện chỉ có OAuth và dashboard/báo cáo (`/api/dashboard`, `/api/contacts`, `/api/debts`, `/api/expenses`). Các thao tác tạo/sửa/xóa đang nằm trong zalo/Gemini service, vì vậy web hoặc khách hàng REST không thể quản trị dữ liệu trực tiếp.

| Tài nguyên              | Hiện có qua HTTP     | Còn thiếu                                                                               |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------- |
| Giao dịch tài chính     | Chỉ đọc chi phí      | Danh sách giao dịch, chi tiết, tạo, sửa, xóa                                            |
| Danh bạ công nợ         | Chỉ danh sách        | Chi tiết, tạo, sửa, xóa                                                                 |
| Công nợ                 | Chỉ danh sách active | Chi tiết, tạo, sửa, xóa; ghi nhận thanh toán giữ là thao tác nghiệp vụ riêng            |
| Nhắc việc               | Không có             | CRUD đầy đủ                                                                             |
| Người dùng / lời mời    | Không có             | API quản trị: danh sách/chi tiết/cấp quyền-sửa vai trò/xóa và tạo-danh sách-hủy lời mời |
| Google Calendar / Tasks | Không có HTTP        | CRUD qua API Google, giới hạn trong tài khoản Google đã liên kết của người gọi          |

`reports`, `audit`, `zalo`, `gemini`, `database`, `reports-token` không nhận CRUD công khai: báo cáo là dữ liệu tổng hợp chỉ đọc; audit log phải bất biến; zalo/Gemini là kênh điều phối; token là thông tin bảo mật; database là hạ tầng.

## Phạm vi thực hiện được đề xuất

1. Tạo lớp xác thực HTTP dùng access token dashboard hiện tại, gắn `userId` đáng tin cậy vào request; bổ sung guard phân quyền quản trị cho user/invite endpoints. Chuẩn hóa lỗi 401/403/404/400, không dùng `userId` từ body/query để tránh truy cập chéo dữ liệu.
2. Bổ sung DTO có validation, kiểu hợp đồng dùng chung và hằng đường dẫn API trong `packages/contracts`; mở rộng HTTP client/frontend contract ở mức cần thiết để không làm lệch kiểu giữa hai ứng dụng.
3. Bổ sung controller REST bảo vệ cho finance:
   - `/api/transactions`: list, get, create, update, delete;
   - `/api/contacts`: list, get, create, update, delete;
   - `/api/debts`: list (lọc active/settled), get, create, update, delete và `POST /:id/payments` cho chuyển trạng thái thanh toán có kiểm tra số dư.
     Các service hiện có sẽ được mở rộng theo user ownership; mọi cập nhật công nợ phải giữ bất biến `remainingAmount <= originalAmount` và không cho xóa/sửa sai chủ sở hữu.
4. Bổ sung controller REST cho `/api/reminders`: list, get, create, update, delete; tái sử dụng scheduling hiện tại và không cho HTTP sửa trạng thái nội bộ `isTriggered` trái vòng đời scheduler.
5. Bổ sung `/api/users` và `/api/invites` chỉ cho admin. API user không được cho phép tự nâng quyền hoặc xóa tài khoản admin; lời mời có thể được tạo, liệt kê và hủy khi chưa dùng.
6. Bổ sung `/api/calendar/events` và `/api/tasks` cho CRUD của dữ liệu trên Google. Với Google Tasks, thao tác “hoàn thành” là cập nhật trạng thái; bổ sung phương thức update/get còn thiếu vào service. Các endpoint trả lỗi rõ ràng khi tài khoản chưa kết nối Google và tuyệt đối không trả OAuth token.
7. Giữ các endpoint báo cáo hiện có tương thích ngược; refactor chúng chỉ khi cần dùng chung auth/mapper, không đổi payload dashboard hiện hành.
8. Viết unit test cho ownership, validation, quyền admin, quy tắc công nợ, reminder update và lỗi Google chưa liên kết; cập nhật tài liệu chuẩn `.agents/knowledge/` (English), hướng dẫn `.agents/docs/` (Vietnamese), chỉ mục docs và artifact giao hàng.

## Các quyết định kỹ thuật

- Dùng cấu trúc NestJS/TypeORM hiện tại thay vì áp đặt Prisma/Clean Architecture mẫu của plugin, vì dự án đang dùng TypeORM service-module phẳng. DTO/controller/guard mới sẽ tuân thủ conventions hiện hữu và được tách nhỏ để dễ kiểm thử.
- API trả `data` tương thích chuẩn hiện tại. Danh sách có `limit` và cursor/offset an toàn khi phù hợp; trang dashboard vẫn giữ giới hạn hiển thị riêng.
- Không đưa token Google, refresh token, audit before/after data, hoặc exchange token vào response CRUD.

## Rủi ro và kiểm chứng

- Đây là thay đổi public API, auth, phân quyền và dữ liệu nên rủi ro cao; cần duyệt trước khi sửa mã.
- Kiểm chứng: test module liên quan, `npm run typecheck`, `npm run lint`, và `npm run build`; đồng thời kiểm tra không có route nào cho phép đọc/ghi bản ghi của người dùng khác.

## Ngoài phạm vi

- Không thay đổi schema database trừ khi cần thêm trường tối thiểu để hỗ trợ update/list an toàn.
- Không thay UI dashboard trong đợt này; API mới sẵn sàng cho UI/khách hàng REST dùng sau.

## Kết quả triển khai

- Đã thêm module xác thực dashboard dùng chung và áp ownership theo access token cho finance, reminders và Google resources.
- Đã triển khai CRUD REST cho transactions, contacts, debts, reminders, users/invites (admin-only), Google Calendar events và Google Tasks; thêm update cho Calendar/Tasks service.
- Đã bổ sung các hằng route/kiểu request dùng chung, cùng knowledge và hướng dẫn vận hành cho finance, reminders, users, google.
- Đã chạy thành công `npm run typecheck`, `npm run build` và `git diff --check`.
- `npm run lint` còn lỗi Prettier/unused ở các thay đổi có sẵn trong `config/configuration.ts`, `config/env.validator.ts`, `main.ts`, `reports/reports.controller.ts`; các tệp CRUD mới/sửa trong phạm vi đã sạch lint.
