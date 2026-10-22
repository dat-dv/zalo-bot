# Nghiên cứu: Dashboard web nên có thêm trang nào?

Ngày: 2026-10-23 · Route: research · Authority: research-only · Phạm vi: chỉ đọc mã nguồn (không tra cứu bên ngoài)

## 1. Hiện trạng

Các trang đang có (`apps/web/app/(private)/`, menu ở `apps/web/src/shared/ui/app-navigation.tsx`):

| Nhóm menu | Trang |
| --- | --- |
| Tổng quan | `/` (`/dashboard`) |
| Tài chính | `/transactions` (`/expenses`, `/income` chuyển hướng về đây), `/debts`, `/analytics` |
| Kế hoạch | `/calendar`, `/tasks`, `/reminders` |
| Dữ liệu | `/contacts` (+ `/contacts/profile`), `/places` |
| Hệ thống | `/zca` (+ `/zca/thread`) và `/google-storage` (chỉ admin), `/settings` (danh mục thu chi + tuỳ chọn) |

Hầu hết API của backend đã có giao diện tương ứng. Khoảng trống nằm ở **dữ liệu backend đã ghi nhưng web chưa cho xem**.

## 2. Đề xuất (xếp theo mức đáng làm)

### 2.1. Nhật ký hoạt động / kiểm toán — nên làm trước

- **Bằng chứng**:
  - `AuditLogSubscriber` (`apps/api/src/database/audit-log.subscriber.ts`) đã ghi mọi lần thêm/sửa/xoá vào bảng `audit_logs`, kèm dữ liệu trước/sau.
  - `CONTEXT.md` đã định nghĩa thuật ngữ "Nhật ký kiểm toán".
  - Web chỉ hiển thị **10 dòng** ở trang Tổng quan, lọc theo `actorId = người đang đăng nhập` (`reports.controller.ts`, `this.audit.listRecent(userId, 10)`). Không có trang riêng, không lọc, không xem được nội dung trước/sau.
- **Vì sao cần**: dữ liệu tài chính là **sổ chung**, ai cũng sửa/xoá được giao dịch của người khác. Khi số liệu bị lệch, chưa có cách nào trên web để trả lời câu hỏi "ai đã sửa hoặc xoá khoản này, lúc nào, sửa từ gì thành gì".
- **Hình dung**: trang chỉ cho admin, bảng có lọc theo loại dữ liệu, hành động, người, khoảng ngày; bấm một dòng để xem trước/sau. Có thể thêm mục "Lịch sử" trong khung chi tiết giao dịch.
- **⚠️ Phải sửa trước (suy ra từ code)**: `actorId` hiện lấy từ trường `userId` / `createdByUserId` **của chính dòng dữ liệu**, không phải người thực hiện thao tác. Nếu B sửa giao dịch do A tạo, nhật ký vẫn ghi người thực hiện là A. Nếu làm trang này mà chưa sửa chỗ đó, trang sẽ chỉ sai người. Cần đưa người thực hiện thật (người dùng dashboard hoặc người gửi tin Zalo) xuống tầng ghi nhật ký.
- **Khối lượng**: trung bình (endpoint phân trang có lọc + trang mới + sửa cách ghi người thực hiện).

### 2.2. Xem lại tin nhắn đã lưu của kênh — nên làm, đặt ở trang cấu hình kênh

- **Bằng chứng**: bảng `zca_messages` đã lưu tin của các kênh bật trí nhớ dài hạn. Tài liệu `.agents/knowledge/modules/zca/chat-memory.md` (mục "Not in Step 1") đã liệt kê sẵn *"dashboard view of stored messages"* và *"purge of a thread's stored messages"* là việc chưa làm.
- **Vì sao cần**: admin bật trí nhớ nhưng không biết bot đang nhớ những gì, cũng không xoá được dữ liệu đã lưu. Tắt trí nhớ thì các dòng cũ vẫn được giữ.
- **Hình dung**: không tạo trang mới trong menu. Thêm một tab hoặc trang con của `/zca/thread?id=…`: tìm kiếm tin (dùng lại `search_vector`), lọc theo ngày hoặc người gửi, và nút xoá toàn bộ tin đã lưu của kênh.
- **Lưu ý**: đây là dữ liệu riêng tư của nhóm chat nên chỉ admin được xem.

### 2.3. Ngân sách theo danh mục — tính năng mới, cần anh quyết định nghiệp vụ

- **Bằng chứng**: i18n đã có khoá `table.entity.budgets` nhưng backend chưa có bảng hay API nào cho ngân sách. Trang Phân tích đã có phân bổ chi tiêu theo danh mục, có thể dùng lại.
- **Vì sao cần**: các app quản lý thu chi thường có hạn mức theo tháng, và bot có thể cảnh báo trên Zalo khi sắp vượt.
- **Cần chốt trước**: vì là sổ chung nên ngân sách cũng dùng chung cho cả hệ thống? Theo tháng hay theo kỳ tuỳ chọn? Có cảnh báo qua Zalo không, gửi tới kênh nào?
- **Khối lượng**: lớn (bảng mới, API, trang, có thể thêm tool cho LLM).

### 2.4. Thao tác đang chờ duyệt — giá trị thấp, chỉ nên làm nếu có nhu cầu

- **Bằng chứng**: các thao tác chờ duyệt nằm trong Redis (`pending:tx:code:<code>`) và bộ nhớ của `TransactionConfirmationService`, hết hạn sau 5 phút. Web chưa có chỗ xem.
- **Nhận định**: thời hạn chỉ 5 phút nên một trang riêng ít khi có gì để xem. Nếu cần, nên làm thành một thẻ nhỏ "Đang chờ duyệt" trên trang Tổng quan thay vì một trang mới.

## 3. Không nên thêm trang

- **Trang Chi tiêu / Thu nhập riêng**: đã gộp vào `/transactions` một cách có chủ đích.
- **Trang Danh mục riêng**: đã nằm trong tab của `/settings`. Nếu muốn dễ tìm hơn thì chỉ cần thêm lối tắt.
- **`/analytics/spending|cashflow|debts`**: `APP_ROUTES` có khai báo nhưng không chỗ nào dùng, và trang Phân tích đã có các tab tương ứng. Nên xoá các hằng này thay vì tạo trang mới (dọn code, rủi ro thấp).
- **Thư viện ảnh hoá đơn**: bảng giao dịch đã có bộ lọc "Có ảnh" và nút hiện/ẩn ảnh hoá đơn, đủ dùng.

## 4. Chưa kiểm chứng

- Chưa tra cứu bên ngoài (so sánh với các app thu chi khác). Theo quy trình research, việc này cần anh đồng ý trước.
- Chưa mở bản production để xem dữ liệu `audit_logs` thực tế nhiều hay ít.

## 5. Bước tiếp theo đề xuất

1. Nếu anh chọn **2.1**: chuyển sang route `implement`, viết `implementation_plan.md` gồm sửa cách ghi người thực hiện, endpoint `GET /api/audit-logs` (admin), trang nhật ký và cập nhật knowledge/docs.
2. Nếu anh chọn **2.2**: viết kế hoạch cho tab "Tin đã lưu" và chức năng xoá trong trang cấu hình kênh.
3. Nếu anh chọn **2.3**: trước hết chốt các câu hỏi nghiệp vụ ở mục 2.3, rồi mới lập kế hoạch.
