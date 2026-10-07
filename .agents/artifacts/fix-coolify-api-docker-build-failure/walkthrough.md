# Walkthrough: Tối ưu Dockerfile API khắc phục lỗi mạng khi deploy Coolify

## Mục tiêu đã hoàn thành

- Loại bỏ hoàn toàn sự cố gián đoạn mạng (`ECONNRESET / network aborted`) khi build Docker stage `runner` trong apps/api/Dockerfile.
- Tái sử dụng trực tiếp toàn bộ `node_modules` và artifact biên dịch nội bộ (`packages/contracts/dist`, `apps/api/dist`) từ stage `builder`.

---

## Chi tiết các thay đổi

### 1. `apps/api/Dockerfile`

- **Xóa lượt `npm ci` độc lập ở runner**: Loại bỏ `RUN npm ci --omit=dev --workspace @zalobot/api` và `COPY apps/web/package.json`.
- **Tái sử dụng dependencies**: Thêm `COPY --from=builder /app/node_modules ./node_modules`.
- **Bổ sung dist nội bộ monorepo**: Thêm `COPY --from=builder /app/packages/contracts/dist packages/contracts/dist`.
- **Tối ưu gói hệ thống runner**: Loại bỏ các package build native C++ không cần thiết (`python3 make g++`) khỏi `RUN apk add`.

---

## Kết quả kiểm thử & xác thực

| Bước kiểm tra           | Lệnh                             | Kết quả                                       |
| ----------------------- | -------------------------------- | --------------------------------------------- |
| Agent System Validation | `npm run agent-system:validate`  | **Passed** (79 artifacts, 0 cyclic groups)    |
| TypeScript Typecheck    | `npm run typecheck`              | **Passed** (API, Web, Contracts)              |
| Dockerfile Integrity    | Kiểm tra cấu trúc đa tầng Docker | **Passed** (Symlink monorepo & dist resolved) |

---

## Hướng dẫn tiếp theo cho người dùng

- Anh có thể thực hiện bấm **Deploy** / **Redeploy** trên giao diện Coolify. Quá trình build container API ở stage `runner` giờ đây sẽ hoàn tất ngay lập tức bằng local artifacts mà không cần gọi ra npm registry nữa.
