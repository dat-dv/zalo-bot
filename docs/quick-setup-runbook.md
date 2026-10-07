# ⚡ Cẩm Nang Triển Khai Trong 3 Phút (3-Minute Setup Runbook)

> **Mục tiêu**: Đây là tài liệu tóm tắt dạng **Checklist "Cầm tay chỉ việc"** từ con số 0. Sau này khi cần cài lại bot trên bất kỳ VPS/Server mới nào, bạn chỉ cần làm theo đúng 5 bước dưới đây là bot chạy ngay mà không cần phải nhớ hay mò mẫm!

---

## 📋 BẢNG CHECKLIST 5 BƯỚC TRIỂN KHAI

```
[ ] Bước 1: Tạo Bot zalo & Lấy zalo Admin ID (30 giây)
[ ] Bước 2: Lấy Gemini API Key Miễn Phí (30 giây)
[ ] Bước 3: Lấy Google Client ID & Client Secret (1 phút)
[ ] Bước 4: Deploy lên Coolify (1 phút)
[ ] Bước 5: Thêm Redirect URL vào Google Cloud (30 giây)
```

---

## 🛠️ CHI TIẾT TỪNG BƯỚC THỰC HIỆN

### Bước 1: Lấy Token Bot & ID zalo Cá Nhân (30 giây)

1. Mở zalo, tìm bot [**@BotFather**](https://t.me/BotFather) ➔ Gõ `/newbot` ➔ Đặt tên ➔ Copy đoạn **HTTP API Token** (Ví dụ: `8896966650:AA...`).
2. Mở bot [**@userinfobot**](https://t.me/userinfobot) ➔ Copy dãy số **Id** của bạn (Ví dụ: `1975126817`).

---

### Bước 2: Lấy Gemini API Key Miễn Phí (30 giây)

1. Truy cập [**Google AI Studio API Keys**](https://aistudio.google.com/apikey).
2. Bấm **Create API key** ➔ Copy đoạn key vừa tạo (Bắt đầu bằng `AIzaSy...` hoặc `AQ...`).

---

### Bước 3: Lấy Google Client ID & Client Secret (1 phút)

1. Truy cập [**Google Cloud Console Credentials**](https://console.cloud.google.com/apis/credentials).
2. Bấm **+ CREATE CREDENTIALS** ➔ Chọn **OAuth client ID**.
   - **Application type**: Chọn **Web application** (hoặc Desktop app).
   - **Name**: Đặt tên bất kỳ (Ví dụ: `zalobot Assistant`).
3. Bấm **CREATE** ➔ Copy **Client ID** và **Client Secret**.
4. Vào menu **OAuth consent screen** bên trái ➔ Mục **Publishing status** ➔ Bấm nút **`PUBLISH APP`** (để bất kỳ Gmail nào cũng đăng nhập được mà không cần add email thủ công).

---

### Bước 4: Deploy Lên Coolify (1 phút)

1. Vào Dashboard Coolify ➔ Bấm **+ New** ➔ **Application** ➔ Chọn **GitHub Repository** của bạn.
2. **Build Pack**: Chọn **Dockerfile**.
3. **Tab Environment Variables**: Dán 5 dòng này vào:

   ```env
   zalo_BOT_TOKEN=8896966650:AAGOYm_...
   zalo_ADMIN_ID=1975126817
   GEMINI_API_KEY=AQ.Ab8RN6...
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
3. Bấm vào tên OAuth Client ID vừa tạo ở Bước 3.
4. Trong mục **Authorized redirect URIs**, bấm **+ ADD URI** và dán link có đuôi `/oauth2callback`:
   ```
   https://zalobot.xxx.sslip.io/oauth2callback
   ```
5. Bấm **SAVE** (Lưu).

---

## 🎉 HOÀN TẤT & HƯỚNG DẪN SỬ DỤNG

### 1. Kích hoạt tài khoản Admin:

- Mở bot zalo lên, gõ: `/login` (hoặc bấm nút **"🔗 Đăng nhập Google"**).
- Đăng nhập Gmail ➔ Bấm **Nâng cao** ➔ **Tiếp tục** ➔ **Cho phép**.
- Trình duyệt sẽ tự hiện trang **"✅ Kết nối thành công!"** và Bot zalo tự gửi tin nhắn kích hoạt!

### 2. Mời bạn bè / người thân cùng dùng:

- Gõ lệnh `/invite` (hoặc nhắn _"Tạo link mời bạn"_ cho AI).
- Bot sinh ra link `https://t.me/TenBot?start=invite_xxx`.
- Bạn gửi link cho bạn bè ➔ Bạn bè bấm link là có ngay trợ lý Google Calendar & Tasks riêng biệt!
