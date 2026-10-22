# ⚡ Cẩm Nang Triển Khai Trong 3 Phút (3-Minute Setup Runbook)

> **Mục tiêu**: Đây là tài liệu tóm tắt dạng **Checklist "Cầm tay chỉ việc"** từ con số 0. Sau này khi cần cài lại bot trên bất kỳ VPS/Server mới nào, bạn chỉ cần làm theo đúng 5 bước dưới đây là bot chạy ngay mà không cần phải nhớ hay mò mẫm!

---

## 📋 BẢNG CHECKLIST 4 BƯỚC TRIỂN KHAI

```
[ ] Bước 1: Chuẩn bị tài khoản Zalo làm bot & mã đăng nhập dashboard (30 giây)
[ ] Bước 2: Lấy Google Client ID & Client Secret (1 phút)
[ ] Bước 3: Deploy lên Coolify (1 phút)
[ ] Bước 4: Thêm Redirect URL vào Google Cloud (30 giây)
```

---

## 🛠️ CHI TIẾT TỪNG BƯỚC THỰC HIỆN

### Bước 1: Chuẩn Bị Tài Khoản Zalo & Mã Đăng Nhập Dashboard (30 giây)

1. Chuẩn bị một tài khoản Zalo cá nhân để làm bot (bot chạy qua ZCA, không cần token Zalo Bot Platform).
2. Chọn một mã `DASHBOARD_LOGIN_CODE`: 8 ký tự từ `0-9` và `A-Z` trừ `I L O U`, dấu gạch tuỳ ý (ví dụ `HRYJ-ZP2T`). Giữ bí mật mã này — nó không hết hạn.

---

### Bước 2: Lấy Google Client ID & Client Secret (1 phút)

1. Truy cập [**Google Cloud Console Credentials**](https://console.cloud.google.com/apis/credentials).
2. Bấm **+ CREATE CREDENTIALS** ➔ Chọn **OAuth client ID**.
   - **Application type**: Chọn **Web application** (hoặc Desktop app).
   - **Name**: Đặt tên bất kỳ (Ví dụ: `zalobot Assistant`).
3. Bấm **CREATE** ➔ Copy **Client ID** và **Client Secret**.
4. Vào menu **OAuth consent screen** bên trái ➔ Mục **Publishing status** ➔ Bấm nút **`PUBLISH APP`** (để bất kỳ Gmail nào cũng đăng nhập được mà không cần add email thủ công).

---

### Bước 3: Deploy Lên Coolify (1 phút)

1. Vào Dashboard Coolify ➔ Bấm **+ New** ➔ **Application** ➔ Chọn **GitHub Repository** của bạn.
2. **Build Pack**: Chọn **Dockerfile**.
3. **Tab Environment Variables**: Dán các dòng này vào:

   ```env
   DASHBOARD_LOGIN_CODE=XXXX-XXXX
   GOOGLE_CLIENT_ID=242273656915-...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```

   Khi có domain public, đặt `APP_URL=https://bot-cua-ban.com`; chỉ đặt `WEB_ORIGIN` nếu Dashboard dùng domain khác. Không dùng tên biến bắt đầu bằng `SERVICE_URL_` trên Coolify.

4. **Tab Storages (Persistent Storage)**:
   - Thêm 1 volume duy nhất:
     - **Destination Path / Mount Path**: `/app/data`
5. Bấm **Deploy**!

---

### Bước 5: Thêm Redirect URL Vào Google Cloud (30 giây)

1. Copy đường link Domain của bot trên Coolify (Ví dụ: `https://zalobot.xxx.sslip.io` hoặc domain riêng).
2. Quay lại trang [**Google Cloud Console Credentials**](https://console.cloud.google.com/apis/credentials).
3. Bấm vào tên OAuth Client ID vừa tạo ở Bước 2.
4. Trong mục **Authorized redirect URIs**, bấm **+ ADD URI** và dán link có đuôi `/oauth2callback`:
   ```
   https://zalobot.xxx.sslip.io/oauth2callback
   ```
5. Bấm **SAVE** (Lưu).

---

## 🎉 HOÀN TẤT & HƯỚNG DẪN SỬ DỤNG

### 1. Kết nối Zalo & kích hoạt tài khoản Admin:

- Mở dashboard, nhập `DASHBOARD_LOGIN_CODE` vào form mã đăng nhập ➔ vào với quyền admin "Chủ hệ thống".
- Mở trang `/zca` ➔ quét mã QR bằng app Zalo của tài khoản làm bot ➔ bật listen cho các chat/nhóm bot cần nghe.
- Nhắn bot trên Zalo, gõ: `/login`.
- Đăng nhập Gmail ➔ Bấm **Nâng cao** ➔ **Tiếp tục** ➔ **Cho phép**.
- Trình duyệt sẽ tự hiện trang **"✅ Kết nối thành công!"** và Bot Zalo tự gửi tin nhắn xác nhận kích hoạt!

### 2. Mời bạn bè / người thân cùng dùng:

- Gõ lệnh `/invite` (hoặc nhắn _"Tạo link mời bạn"_ cho AI).
- Bot sinh ra mã mời dạng: `/start invite_xxx` (có hạn 24 giờ).
- Bạn gửi mã cho bạn bè ➔ Bạn bè gửi lệnh này vào bot là có ngay trợ lý Google Calendar & Tasks riêng biệt!
