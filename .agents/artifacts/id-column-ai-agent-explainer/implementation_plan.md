# Kế hoạch triển khai: Tương tác Click Cột ID & Popup Giải thích Thực thể + Câu lệnh mẫu cho AI Agent

## 1. Tổng quan & Mục tiêu

Hiện tại, cột `ID` trong thành phần `DataTable` dùng chung (`apps/web/src/shared/ui/data-table.tsx`) chỉ hiển thị chuỗi text đơn thuần (`<code>{row.id}</code>`).

Theo yêu cầu của bạn:

- Khi click vào bất kỳ ô `ID` nào trên bảng dữ liệu, hệ thống sẽ mở một hộp thoại / popup giải thích chi tiết:
  1. Đây là ID của bảng / thực thể cơ sở dữ liệu nào (ví dụ: `finance_transactions` - Giao dịch thu–chi, `debts` - Khoản vay nợ, `tasks` - Việc cần làm, `reminders` - Lời nhắc, `calendar_events` - Sự kiện lịch, `debt_contacts` - Danh bạ / Người liên quan, `finance_places` - Địa điểm, `categories` - Danh mục, v.v.).
  2. Hiển thị đầy đủ mã ID với nút **Sao chép ID (1-Click Copy)**.
  3. Cung cấp **Bộ câu lệnh mẫu (AI Agent Prompt Templates)** để người dùng sao chép nhanh và gửi cho zalo Bot / AI Agent (ví dụ: _"Sửa bản ghi [thực thể] có ID: [id] thành..."_, _"Xóa bản ghi [thực thể] có ID: [id]"_, _"Xem chi tiết bản ghi [thực thể] có ID: [id]"_).

---

## 2. Các điểm cần người dùng xác nhận (User Review Required)

> [!NOTE]
> **Thiết kế UI / UX**:
>
> - Ô ID trên bảng sẽ được đổi thành nút bấm tương tác (clickable badge) với font mono, hiệu ứng hover nhẹ và icon sao chép / thông tin nhỏ.
> - Khi click, mở một Modal / Dialog (`IdExplainerDialog`) hiển thị thông tin bảng CSDL, giải thích ý nghĩa ID và 3 mẫu prompt thông dụng nhất cho AI Agent (Sửa, Xóa, Tra cứu) kèm nút 1-click copy cho từng prompt.
> - Hỗ trợ đầy đủ phím tắt (`Escape` để đóng), click backdrop để đóng, và dark mode 100%.

---

## 3. Chi tiết các thay đổi dự kiến (Proposed Changes)

### Package: `@zalobot/contracts`

#### [MODIFY] [`packages/contracts/src/index.ts`](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Bổ sung translation keys cho cả `vi` (Tiếng Việt) và `en` (English):
  - `table.idClickToInspect`: Gợi ý tooltip khi hover ô ID.
  - `table.idModal.title`: Tiêu đề modal định danh bản ghi.
  - `table.idModal.subtitle`: Phụ đề mô tả.
  - `table.idModal.tableName`: Nhãn tên bảng CSDL.
  - `table.idModal.entityName`: Nhãn tên thực thể nghiệp vụ.
  - `table.idModal.fullId`: Nhãn ID đầy đủ.
  - `table.idModal.copyId`: Nút sao chép ID.
  - `table.idModal.copied`: Phản hồi trạng thái đã sao chép.
  - `table.idModal.agentPromptTitle`: Tiêu đề nhóm câu lệnh cho AI Agent.
  - `table.idModal.agentPromptDesc`: Hướng dẫn sử dụng câu lệnh cho AI Agent.
  - `table.idModal.promptUpdate`: Tiêu đề lệnh cập nhật.
  - `table.idModal.promptUpdateTemplate`: Mẫu câu lệnh cập nhật bản ghi.
  - `table.idModal.promptDelete`: Tiêu đề lệnh xóa.
  - `table.idModal.promptDeleteTemplate`: Mẫu câu lệnh xóa bản ghi.
  - `table.idModal.promptDetail`: Tiêu đề lệnh xem chi tiết.
  - `table.idModal.promptDetailTemplate`: Mẫu câu lệnh kiểm tra chi tiết.
  - `table.idModal.copyPrompt`: Nút sao chép câu lệnh.
  - `table.idModal.explanation`: Đoạn giải thích vai trò của ID trong CSDL.
  - `table.entity.*`: Tên các thực thể nghiệp vụ chuẩn hóa (`transactions`, `debts`, `tasks`, `reminders`, `calendar`, `contacts`, `places`, `categories`, `budgets`, `cashflow`, `general`).

---

### Package: `@zalobot/web`

#### [MODIFY] [`apps/web/src/shared/ui/data-table.tsx`](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/data-table.tsx)

- Mở rộng `DataTableProps<T>`:
  - Thêm thuộc tính tùy chọn `tableName?: string`, `entityName?: string`, `entityLabel?: string`.
  - Tự động nhận diện mapping từ `id` của bảng sang tên bảng CSDL & thực thể mặc định (ví dụ: `transactions-table` -> `finance_transactions`).
- Cập nhật định nghĩa cột `id` trong `systemColumns`:
  - Render nút bấm `button` có aria-label, tooltip và icon sao chép.
  - Xử lý sự kiện `onClick`: Mở modal `IdExplainerDialog` với dữ liệu dòng được chọn.
- Xây dựng Component `IdExplainerDialog`:
  - Trình bày thông tin bảng CSDL (`<code>{tableName}</code>`) và tên thực thể.
  - Hộp chứa mã ID đầy đủ với nút Sao chép ID (tự động đổi text thành "✓ Đã sao chép" trong 2s).
  - Danh sách 3 khối câu lệnh mẫu cho AI Agent (Cập nhật, Xóa, Xem chi tiết) với nút sao chép riêng biệt cho từng lệnh.
  - Đoạn giải thích vì sao cần ID này khi giao tiếp với AI Agent.
  - Nút đóng (`✕` và nút Đóng), phím tắt `Escape` và click outside.

#### [MODIFY] Các màn hình / bảng gọi `DataTable` (nếu cần truyền custom `tableName`/`entityName`):

- `apps/web/src/modules/dashboard/view/transactions-table.tsx`
- `apps/web/src/modules/debts/view/debts-table.tsx`
- `apps/web/src/modules/dashboard/view/tasks-table.tsx`
- `apps/web/src/modules/dashboard/view/reminders-table.tsx`
- `apps/web/src/modules/dashboard/view/calendar-table.tsx`
- `apps/web/src/modules/contacts/view/contacts-screen.tsx`
- `apps/web/src/modules/dashboard/view/places-screen.tsx`
- `apps/web/src/modules/expenses/view/expenses-screen.tsx`
- `apps/web/src/modules/settings/view/settings-screen.tsx`
- `apps/web/src/modules/dashboard/view/analytics-screen.tsx`

---

## 4. Kế hoạch kiểm thử & Đảm bảo chất lượng (Verification Plan)

### Automated Verification

- `npm run typecheck`: Kiểm tra tính toàn vẹn kiểu TypeScript trên toàn monorepo (`@zalobot/contracts`, `@zalobot/web`, `@zalobot/api`).
- `npm run lint`: Chạy ESLint để đảm bảo không vi phạm linter rules.
- `npm run agent-system:validate`: Đảm bảo quy chuẩn Agent System & tính toàn vẹn hệ thống.

### Manual Verification

- Mở Web Dashboard trên trình duyệt.
- Click vào ô ID của từng bảng dữ liệu (Thu chi, Công nợ, Công việc, Lời nhắc, Sự kiện lịch, Danh bạ, Nơi chốn, Danh mục).
- Kiểm tra:
  1. Tên bảng CSDL hiển thị chính xác (ví dụ: `finance_transactions`, `debts`, `tasks`, ...).
  2. Nút Sao chép ID hoạt động mượt mà và hiển thị phản hồi sao chép.
  3. Các câu lệnh mẫu cho AI Agent chứa đúng tên thực thể và ID, nút sao chép lệnh hoạt động chính xác.
  4. Đóng modal bằng phím `Escape`, nút `✕` hoặc click ngoài backdrop.
  5. Kiểm tra hiển thị chuẩn xác ở cả chế độ sáng (Light) và tối (Dark mode).
