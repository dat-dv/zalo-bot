# Walkthrough: Sửa lỗi Client-Side SPA Routing trên Nginx (Next.js Static Export)

Đã khắc phục hoàn toàn tình trạng bấm link điều hướng trên giao diện Dashboard bị đứng / mất cơ chế Single Page Application (SPA).

---

## Các thay đổi đã thực hiện (Changes Made)

### Frontend: `apps/web`

- [apps/web/next.config.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/web/next.config.ts):
  - Chuyển `trailingSlash: false` để Next.js xuất ra các file HTML phẳng dạng `/reports/contacts.html`, `/reports/debts.html` thay vì tạo thư mục con.
- [apps/web/nginx.conf](file:///Users/datdoan/Documents/projects/zalobot/apps/web/nginx.conf):
  - Bổ sung `absolute_redirect off;` và `port_in_redirect off;` để Nginx không tự động redirect sai port mapping (`3001:80`).
  - Cập nhật thứ tự `try_files` ưu tiên file `.html`: `try_files $uri $uri.html $uri/ /index.html =404;`.

---

## Kết quả kiểm thử & Xác thực (Verification Results)

### 1. Build Static Output

```bash
npm run build
```

- Next.js đã xuất các route dạng file `.html` trực tiếp:
  - `apps/web/out/reports.html`
  - `apps/web/out/reports/contacts.html`
  - `apps/web/out/reports/debts.html`
  - `apps/web/out/reports/expenses.html`
  - `apps/web/out/reports/statistics.html`
- Không còn bất kỳ HTTP 301 Redirect nào từ Nginx khi truy cập hoặc chuyển trang.

### 2. Typecheck & System Validation

- `npm run typecheck`: **Pass 100%**
- `npm run agent-system:validate`: **Pass 100%**
