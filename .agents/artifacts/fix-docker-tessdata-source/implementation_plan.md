# Kế hoạch Khắc Phục Lỗi Build Dockerfile (Tessdata 503 Error)

## 1. Nguyên nhân lỗi

Trong quá trình Coolify build Docker image cho service `api`, bước tải ngôn ngữ OCR bị lỗi:

```text
curl: (22) The requested URL returned error: 503
target api: failed to solve: process "curl -fsSL https://tessdata.projectnaptha.com/4.0.0_fast/vie.traineddata.gz ..." did not complete successfully: exit code: 22
```

Máy chủ `tessdata.projectnaptha.com` (bên thứ ba) đang bị sập / quá tải (HTTP 503 Service Unavailable).

---

## 2. Giải pháp khắc phục

Chuyển đổi nguồn tải sang kho lưu trữ chính thức và ổn định của **Tesseract OCR trên GitHub (`tesseract-ocr/tessdata_fast`)**:

- URL Tiếng Việt: `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/vie.traineddata`
- URL Tiếng Anh: `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata`

---

## 3. Các thay đổi dự kiến

### Component: Dockerfile Build (`apps/api/Dockerfile`)

#### [MODIFY] [Dockerfile](file:///Users/datdoan/Documents/projects/zalobot/apps/api/Dockerfile)

Cập nhật layer runner tải file `.traineddata` trực tiếp từ GitHub official:

```dockerfile
RUN apk add --no-cache curl ffmpeg libgomp libstdc++ && \
    mkdir -p /app/assets/tessdata && \
    curl -fsSL https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/vie.traineddata -o /app/assets/tessdata/vie.traineddata && \
    curl -fsSL https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata -o /app/assets/tessdata/eng.traineddata
```

---

### Component: Tesseract Worker Config (`apps/api/src/zalo/services/receipt-image-analysis.service.ts`)

#### [MODIFY] [receipt-image-analysis.service.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/services/receipt-image-analysis.service.ts)

Cập nhật `gzip: false` để worker đọc trực tiếp file `.traineddata` không nén, tăng tốc độ khởi tạo OCR và tương thích hoàn toàn với file tải từ GitHub.

---

## 4. Kế hoạch Kiểm tra (Verification Plan)

### Automated Verification

- Kiểm tra typecheck và build API:
  ```bash
  npm run typecheck
  npm run lint
  npm run build:api
  npm run agent-system:validate
  ```

### Manual Verification

- Sau khi commit và push code, kích hoạt lại Re-deploy trên Coolify để xác nhận Docker image build thành công 100%.
