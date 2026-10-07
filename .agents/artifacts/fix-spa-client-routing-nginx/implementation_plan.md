# Kế hoạch khắc phục lỗi Client-Side SPA Navigation trên Nginx (Next.js Static Export)

Khắc phục tình trạng người dùng bấm vào các liên kết (`<Link>`) trên Web Dashboard nhưng giao diện không chuyển trang do xung đột Trailing Slash và Nginx 301 Redirect sai cổng.

## Nguyên nhân

1. `apps/web/next.config.ts` đang cấu hình `trailingSlash: true` khiến Next.js tạo cấu trúc thư mục dạng `/reports/debts/index.html`.
2. Mã nguồn sử dụng `APP_ROUTES` không có trailing slash (ví dụ `/reports/debts`).
3. Khi Next.js Client Router thực hiện fetch ngầm tới `/reports/debts`, Nginx phát hiện đây là thư mục và tự động gửi mã HTTP `301 Moved Permanently` về port `80` (thay vì port `3001` đang map ngoài host), khiến trình duyệt huỷ quá trình chuyển trang.

---

## Thay đổi dự kiến (Proposed Changes)

### Frontend: `apps/web`

#### [MODIFY] [apps/web/next.config.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/web/next.config.ts)

- Đổi `trailingSlash: false` để Next.js xuất file tĩnh dạng `/reports/debts.html` (thay vì thư mục).

#### [MODIFY] [apps/web/nginx.conf](file:///Users/datdoan/Documents/projects/zalobot/apps/web/nginx.conf)

- Thêm `absolute_redirect off;` và `port_in_redirect off;` để Nginx không tự ý sinh redirect sai port.
- Cập nhật thứ tự `try_files` ưu tiên file `.html` trước thư mục:
  ```nginx
  absolute_redirect off;
  port_in_redirect off;

  location / {
    try_files $uri $uri.html $uri/ /index.html =404;
  }
  ```

---

## Kế hoạch kiểm thử & Xác thực (Verification Plan)

### Automated Verification

1. **Kiểm tra build web static export:**
   ```bash
   npm run build --workspace @zalobot/web
   ```
   _(Xác nhận Next.js xuất ra các file `reports.html`, `contacts.html`, `debts.html`... trong `apps/web/out`)_
2. **Kiểm tra typecheck & validate:**
   ```bash
   npm run typecheck
   npm run agent-system:validate
   ```

### Manual Verification

- Deploy lên máy chủ, mở trình duyệt vào `http://<ip_server>:3001/reports` và click chuyển đổi giữa các tab: Thống kê, Danh bạ, Công nợ, Khoản chi.
- Xác nhận URL thay đổi tức thì và nội dung chuyển mượt mà dạng SPA (không reload lại trang).
