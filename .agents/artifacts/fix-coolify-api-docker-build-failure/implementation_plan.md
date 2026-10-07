# Kế hoạch tối ưu Dockerfile API khắc phục lỗi mạng khi deploy Coolify

## Mô tả bài toán

Trong quá trình triển khai API trên Coolify/Docker, build container bị dừng tại stage `runner` của [apps/api/Dockerfile](file:///Users/datdoan/Documents/projects/zalobot/apps/api/Dockerfile) do lệnh `RUN npm ci --omit=dev --workspace @zalobot/api` gặp sự cố gián đoạn kết nối mạng (`ECONNRESET / network aborted`).
Stage `builder` trước đó đã chạy `npm ci` và biên dịch toàn bộ mã nguồn (`@zalobot/contracts` và `@zalobot/api`) thành công. Việc chạy thêm một lượt `npm ci` ở stage `runner` không chỉ tạo điểm nghẽn phụ thuộc vào mạng mà còn thiếu các artifacts nội bộ monorepo (`packages/contracts/dist`).

## Thay đổi đề xuất

### Backend Docker Configuration

#### [MODIFY] [Dockerfile](file:///Users/datdoan/Documents/projects/zalobot/apps/api/Dockerfile)

- **Loại bỏ lượt `npm ci` thứ hai**: Xóa hoàn toàn lệnh `RUN npm ci --omit=dev --workspace @zalobot/api` trong stage `runner`.
- **Tái sử dụng `node_modules` từ `builder`**: Thêm `COPY --from=builder /app/node_modules ./node_modules`.
- **Sao chép đầy đủ dist nội bộ monorepo**: Thêm `COPY --from=builder /app/packages/contracts/dist packages/contracts/dist`.
- **Tối ưu gói hệ thống runner**: Loại bỏ `python3 make g++` khỏi danh sách cài đặt của `apk add` ở runner (do các native binary như `better-sqlite3` đã được biên dịch sẵn ở stage builder), chỉ giữ lại các thư viện runtime cần thiết (`curl ffmpeg libgomp libstdc++`).

---

## Chi tiết thay đổi cụ thể tại `apps/api/Dockerfile`

```dockerfile
FROM node:22-alpine AS runner

WORKDIR /app
RUN apk add --no-cache curl ffmpeg libgomp libstdc++ && \
    mkdir -p /app/assets/tessdata && \
    curl -fsSL https://tessdata.projectnaptha.com/4.0.0_fast/vie.traineddata.gz -o /app/assets/tessdata/vie.traineddata.gz && \
    curl -fsSL https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz -o /app/assets/tessdata/eng.traineddata.gz
ENV NODE_ENV=production
EXPOSE 3000

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=whisper-builder /opt/whisper.cpp/build/bin/whisper-server /usr/local/bin/whisper-server
COPY --from=whisper-builder /opt/whisper.cpp/models/ggml-base.bin /opt/whisper/models/ggml-base.bin
COPY apps/api/scripts/start-with-whisper.sh /usr/local/bin/start-with-whisper.sh
RUN chmod +x /usr/local/bin/start-with-whisper.sh
CMD ["/usr/local/bin/start-with-whisper.sh"]
```

---

## Kế hoạch kiểm thử & xác thực (Verification Plan)

### Automated Verification

- Kiểm tra tính hợp lệ cú pháp của Dockerfile.
- Chạy validation hệ thống: `npm run agent-system:validate`.

### Manual Verification

- Deploy lại ứng dụng trên Coolify để xác nhận stage `runner` hoàn tất tức thì mà không cần tải thêm bất kỳ package nào từ npm registry.
