---
metadata:
  agent-artifact:
    id: docs-module-audit
    type: documentation
    depends_on:
      - .agents/knowledge/modules/audit/README.md
      - apps/api/src/audit/audit-context.ts
      - apps/api/src/audit/audit.service.ts
      - apps/api/src/audit/audit.controller.ts
      - apps/api/src/database/audit-log.subscriber.ts
      - apps/api/src/database/migrations/1724950000000-AddAuditLogActorSource.ts
      - apps/web/src/modules/audit/view/activity-screen.tsx
      - apps/web/src/modules/audit/presentation/components/audit-detail-dialog.tsx
---

# Module Nhật Ký Hoạt Động (Audit)

Tài liệu này ánh xạ trực tiếp với tri thức canonical [`README.md`](../../../knowledge/modules/audit/README.md).

## 1. Vì sao cần

Thu chi, lịch và việc cần làm là **dữ liệu dùng chung**: ai cũng thêm, sửa, xoá được bản ghi của người khác. Khi số liệu bị lệch, admin cần trả lời được: *ai đã đổi khoản này, lúc nào, từ đâu (dashboard hay nhóm Zalo nào), và trước đó nó là gì*. Trang **Nhật ký hoạt động** (`/activity`, chỉ admin) dùng để trả lời các câu hỏi đó.

## 2. Ghi đúng "người thực hiện"

**Lỗi cũ:** subscriber lấy người thực hiện từ trường `userId`/`createdByUserId` của chính dòng dữ liệu. Hậu quả:

- B sửa giao dịch do A tạo → nhật ký ghi A.
- Job gửi nhắc cập nhật lời nhắc → nhật ký ghi người tạo lời nhắc.

**Cách làm mới:** mỗi luồng công việc mang theo một **ngữ cảnh kiểm toán** (`AuditContext`, dựa trên AsyncLocalStorage của Node). Mọi lệnh ghi DB trong luồng đó tự biết ai đang thao tác.

| Luồng | Người thực hiện | Nguồn |
| --- | --- | --- |
| Request dashboard | Người dùng của access token (gắn **sau khi** token được xác thực trong `getDashboardUserId`) | `dashboard` |
| Tin nhắn / reaction Zalo | Người gửi, kèm kênh chat | `zalo` |
| Thao tác chờ duyệt được duyệt | **Người yêu cầu**, không phải người gõ `yes <mã>` hay thả tim cuối | `zalo` |
| Job nhắc việc, lời nhắc; nhập lịch từ Google | Không ai | `system` |
| Không có ngữ cảnh | Không ai | `system` |

Không bao giờ đoán người thực hiện theo người tạo bản ghi nữa. Không xác định được thì để trống.

**Dữ liệu cũ:** các dòng ghi trước migration `1724950000000-AddAuditLogActorSource` có nguồn rỗng. Người hiển thị trên các dòng này là người *tạo* bản ghi, có thể không phải người sửa. Không có cách suy ngược nên không backfill; giao diện gắn nhãn vàng "Dữ liệu cũ".

**Giới hạn độ chính xác:**

- `save`/`remove` ghi đủ dữ liệu trước/sau.
- `update()` hàng loạt chỉ có giá trị mới, thường không có mã bản ghi; giao diện gắn nhãn tím "Hàng loạt".
- `delete()` theo điều kiện chỉ để lại một dòng trống.
- Nhập lịch Google ghi với `callListeners(false)` nên không sinh dòng nào.

## 3. API (chỉ admin)

- `GET /api/audit-logs`:
  - Lọc theo bảng, hành động, nguồn (`legacy` = dữ liệu cũ), người thực hiện, mã bản ghi, khoảng thời gian.
  - 50 dòng mỗi trang (tối đa 200), mới nhất trước.
  - Mặc định ẩn 4 bảng kỹ thuật: token Google, phiên đăng nhập dashboard, dấu đã gửi của từng lần nhắc việc/lời nhắc. Chọn đích danh một bảng thì vẫn xem được.
  - Danh sách không trả dữ liệu trước/sau, để payload nhẹ.
- `GET /api/audit-logs/:id`: một dòng kèm dữ liệu trước/sau.
- Controller nằm trong `AuditAdminModule` riêng. Nếu đặt chung với `AuditModule` sẽ tạo vòng import: `UsersModule → ZcaModule → AuditModule → UsersModule`.

## 4. Giao diện `/activity`

- **Menu**: nhóm HỆ THỐNG, chỉ hiện với admin. Người không phải admin mở thẳng URL sẽ thấy thông báo "Trang này chỉ dành cho admin".
- **Bộ lọc**: dữ liệu (gom theo Tài chính / Kế hoạch / Hệ thống), hành động, nguồn, người thực hiện, từ ngày – đến ngày, công tắc "Hiện bản ghi kỹ thuật", chip mã bản ghi (✕ để bỏ) và nút "Xoá bộ lọc".
  - Bộ lọc nằm trên URL, nên copy link là chia sẻ được đúng màn hình đang xem.
  - Trên điện thoại, bộ lọc gom thành một hàng cuộn ngang, cao 32px.
- **Bảng**: thời điểm; người thực hiện (kèm nguồn và kênh); hành động · loại dữ liệu · mã bản ghi rút gọn; các trường đã đổi; nút **Xem**. Trên điện thoại mỗi dòng là một mục hai dòng; chạm vào để mở sheet chi tiết.
- **Hộp thoại chi tiết**: bảng so sánh Trường | Trước | Sau, trường đã đổi đưa lên đầu và tô nền. Thêm mới chỉ hiện giá trị sau, xoá chỉ hiện giá trị trước. Nút **Lịch sử bản ghi này** lọc nhật ký theo đúng bản ghi đó.
- **Lối vào khác**:
  - Trong chi tiết giao dịch có link **Xem lịch sử thay đổi**.
  - Khối Hoạt động ở trang Tổng quan có link **Xem tất cả**.
  - Cả hai chỉ hiện với admin.

## 5. Chạy & kiểm thử

```bash
npm run test --workspace @zalobot/api
npm run test --workspace @zalobot/web
```

Các test chính:

- `audit-context.spec.ts`, `audit-log.subscriber.spec.ts`: lấy người từ ngữ cảnh, không lấy từ dòng dữ liệu, mặc định là hệ thống.
- `audit-log-query.spec.ts`, `audit.service.spec.ts`: bộ lọc, ẩn bảng kỹ thuật, dữ liệu cũ, 403.
- `transaction-confirmation.service.spec.ts`: thao tác được duyệt ghi cho người yêu cầu.
- Web: `audit-url-state.spec.ts`, `audit-labels.spec.ts`.

## 6. Xử lý sự cố

- **Nhật ký ghi "Không xác định" cho thao tác trên dashboard**: endpoint đó không gọi `getDashboardUserId`/`requireDashboardAdmin` trước khi ghi, ví dụ các endpoint đăng nhập. Mọi endpoint ghi dữ liệu mới phải xác thực qua các hàm này.
- **Việc chạy ngầm bị ghi tên người của request**: việc bắn đi rồi quên (`void …`) thừa hưởng ngữ cảnh của request. Nếu đó là việc của hệ thống, bọc bằng `AuditContext.runAsSystem(...)`.
- **Trang trống dù chắc chắn có thay đổi**: kiểm tra công tắc "Hiện bản ghi kỹ thuật", vì token và các lần nhắc mặc định bị ẩn. Cũng kiểm tra khoảng ngày (tính theo giờ máy người xem).
- **Bảng `audit_logs` phình to**: hiện chưa có job dọn dữ liệu. Index `created_at DESC` giữ cho phân trang vẫn nhanh.
