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
      - apps/api/src/database/migrations/1724970000000-AddAuditLogActorName.ts
      - apps/api/src/users/users.service.ts
      - apps/web/src/modules/audit/presentation/components/audit-filters.tsx
      - apps/web/src/modules/audit/presentation/components/audit-table.tsx
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

**Tên người thực hiện** được lấy theo thứ tự:

1. **Danh bạ ZCA** (`UsersService.resolveZaloNames`): tên giống thẻ phiên và trang Zalo & Người dùng (biệt danh → tên → tên hiển thị). Đọc từ cache, không gọi Zalo; cache trống hoặc lỗi thì bỏ qua bước này.
2. **Tên đã lưu lúc ghi nhật ký** (cột `actor_name`): tên Zalo của người gửi tại thời điểm thay đổi. Cần bước này vì thành viên nhóm không kết bạn với bot không có trong danh bạ.
3. **`users.first_name`**.
4. Không có tên nào thì giao diện hiện "Chưa rõ tên (…4 số cuối)".

Danh sách người trong bộ lọc dùng cùng thứ tự này.

Thao tác chờ duyệt không lưu tên người yêu cầu. Vì vậy khi duyệt, tên chỉ được lưu nếu **chính người yêu cầu** tự gõ `yes <mã>`. Người khác duyệt thì không lưu tên, để không ghi nhầm tên người duyệt thành người yêu cầu; dòng đó sẽ dựa vào danh bạ hoặc `first_name`.

**Dữ liệu cũ:**

- Các dòng ghi trước migration `1724970000000-AddAuditLogActorName` không có tên đã lưu. Nếu người đó không có trong danh bạ và không có `first_name`, dòng cũ vẫn hiện "Chưa rõ tên".
- Các dòng ghi trước migration `1724950000000-AddAuditLogActorSource` có nguồn rỗng. Người hiển thị trên các dòng này là người *tạo* bản ghi, có thể không phải người sửa. Không có cách suy ngược nên không backfill; giao diện gắn nhãn vàng "Dữ liệu cũ".

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
- **Hết phiên đăng nhập** (API trả 401): hiện màn đăng nhập bằng mã giống các trang khác, đăng nhập xong thì tải lại. Lỗi khác (mạng, 500) hiện thông báo kèm nút Thử lại.
- **Bộ lọc**: dữ liệu (gom theo Tài chính / Kế hoạch / Hệ thống), hành động, nguồn, người thực hiện, từ ngày – đến ngày, công tắc "Hiện bản ghi kỹ thuật", chip mã bản ghi (✕ để bỏ) và nút "Xoá bộ lọc".
  - Bộ lọc nằm trên URL, nên copy link là chia sẻ được đúng màn hình đang xem.
  - **Desktop**: tất cả nằm trên một hàng.
  - **Điện thoại**: 7 ô lọc trên một hàng cuộn ngang thì dài gấp 4 màn hình, nên thanh công cụ chỉ còn chip **Bộ lọc** (có số bộ lọc đang bật, ví dụ "Bộ lọc · 2"), chip mã bản ghi và "Xoá bộ lọc".
  - Chạm chip **Bộ lọc** mở sheet "Lọc nhật ký": các ô xếp dọc, có nhãn, cao 40px. Đổi giá trị là áp dụng ngay, giống desktop; nút **Xong** chỉ đóng sheet.
  - Số trên chip không tính mã bản ghi, vì mã bản ghi đã có chip riêng.
- **Bảng**: thời điểm; người thực hiện (kèm nguồn và kênh); hành động · loại dữ liệu · mã bản ghi rút gọn; các trường đã đổi; nút **Xem**.
  - Bấm vào **hành động · loại dữ liệu** (chữ xanh) cũng mở chi tiết. Đây là lối vào chính: cột ID bắt buộc của mọi bảng rộng ~287px, nên ở màn 1280px nút **Xem** ở cuối có thể bị đẩy ra ngoài và phải cuộn ngang. Từ khoảng 1360px thì thấy đủ.
  - Trên điện thoại mỗi dòng là một mục hai dòng; chạm vào để mở sheet chi tiết.
- **Hộp thoại chi tiết**: bảng so sánh Trường | Trước | Sau, trường đã đổi đưa lên đầu và tô nền. Thêm mới chỉ hiện giá trị sau, xoá chỉ hiện giá trị trước. Nút **Lịch sử bản ghi này** lọc nhật ký theo đúng bản ghi đó.
- **Lối vào khác**:
  - Trong chi tiết giao dịch có link **Xem lịch sử thay đổi**.
  - Khối Hoạt động ở trang Tổng quan có link **Xem tất cả**. Khối này dùng cùng nhãn tiếng Việt với trang nhật ký ("Thêm · Lời nhắc") và không hiện các bảng kỹ thuật.
  - Cả hai chỉ hiện với admin.

## 5. Chạy & kiểm thử

```bash
npm run test --workspace @zalobot/api
npm run test --workspace @zalobot/web
```

Các test chính:

- `audit-context.spec.ts`, `audit-log.subscriber.spec.ts`: lấy người và tên người gửi từ ngữ cảnh, không lấy từ dòng dữ liệu, mặc định là hệ thống.
- `audit-log-query.spec.ts`, `audit.service.spec.ts`: bộ lọc, ẩn bảng kỹ thuật (cả ở trang chủ), dữ liệu cũ, thứ tự ưu tiên tên, danh bạ lỗi, 403.
- `transaction-confirmation.service.spec.ts`: thao tác được duyệt ghi cho người yêu cầu; chỉ giữ tên khi người yêu cầu tự duyệt.
- `users-session-profile.spec.ts`: `resolveZaloNames` chỉ đọc mục người dùng trong danh bạ, lỗi thì trả rỗng.
- Web: `audit-url-state.spec.ts` (đếm bộ lọc cho chip), `audit-labels.spec.ts` (nhãn "Thêm · Lời nhắc").

## 6. Xử lý sự cố

- **Người thực hiện hiện "Chưa rõ tên"**: người đó không có trong danh bạ ZCA (chưa kết bạn với bot, hoặc ZCA chưa đăng nhập nên cache trống), dòng nhật ký không có tên đã lưu (ghi trước v1.0.178, hoặc thao tác do người khác duyệt), và `first_name` trống.
- **Nhật ký ghi "Không xác định" cho thao tác trên dashboard**: endpoint đó không gọi `getDashboardUserId`/`requireDashboardAdmin` trước khi ghi, ví dụ các endpoint đăng nhập. Mọi endpoint ghi dữ liệu mới phải xác thực qua các hàm này.
- **Việc chạy ngầm bị ghi tên người của request**: việc bắn đi rồi quên (`void …`) thừa hưởng ngữ cảnh của request. Nếu đó là việc của hệ thống, bọc bằng `AuditContext.runAsSystem(...)`.
- **Trang trống dù chắc chắn có thay đổi**: kiểm tra công tắc "Hiện bản ghi kỹ thuật", vì token và các lần nhắc mặc định bị ẩn. Cũng kiểm tra khoảng ngày (tính theo giờ máy người xem).
- **Bảng `audit_logs` phình to**: hiện chưa có job dọn dữ liệu. Index `created_at DESC` giữ cho phân trang vẫn nhanh.
