# Kế hoạch loại bỏ nhãn zalobot dư thừa trong WorkspaceHeader

## Mô tả bài toán

Hiện tại trong component tiêu đề dùng chung `WorkspaceHeader` (`apps/web/src/shared/ui/workspace-header.tsx`), phần tiêu đề bên trái đang hiển thị 3 dòng:

1. Eyebrow label `zalobot` (chữ in hoa nhỏ xám nhạt).
2. Tiêu đề chính trang `title` (ví dụ: `Xin chào`, `Thu & Chi`, `Vay & Cho vay`...).
3. Phụ đề mô tả `subtitle` (ví dụ: `Tài chính, công việc và lịch trình của bạn`...).

Do thanh Sidebar bên trái (`AppNavigation`) đã có sẵn logo và nhãn thương hiệu `zalobot • Không gian cá nhân`, việc lặp lại chữ `zalobot` ở đầu mỗi header tạo cảm giác phân mảnh dòng và dư thừa. Kế hoạch này sẽ loại bỏ dòng `zalobot` này để header chỉ còn 2 thành phần chính: Tiêu đề lớn + Phụ đề nhỏ liền kề.

## Đánh giá rủi ro

- **Mức độ rủi ro**: THẤP (LOW RISK) - Chỉ điều chỉnh markup JSX của một UI component chung, không ảnh hưởng logic hay data contracts.

---

## Thay đổi đề xuất

### Frontend Shared UI

#### [MODIFY] [workspace-header.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/workspace-header.tsx)

- Xóa thẻ `<p className="text-[10px] font-bold tracking-[.08em] text-slate-400 uppercase dark:text-slate-500">zalobot</p>`.
- Giữ nguyên `title` (`<h1>`) và `subtitle` (`<p>`) với cấu trúc gọn gàng, kế thừa đầy đủ các thuộc tính responsive và dark mode.

---

## Kế hoạch kiểm thử & xác minh

### Automated Verification

1. Chạy typecheck và lint cho frontend:
   ```bash
   npm run typecheck
   npm run lint
   ```
2. Chạy kiểm tra tính toàn vẹn hệ thống agent:
   ```bash
   npm run agent-system:validate
   ```

### Manual Verification

- Kiểm tra giao diện các trang `/`, `/transactions`, `/debts`, `/analytics`, `/calendar`, `/tasks`, `/reminders`, `/contacts`, `/settings` trên cả Desktop và Mobile để đảm bảo tiêu đề hiển thị liền mạch, không còn dòng `zalobot` nhỏ ở trên cùng.
