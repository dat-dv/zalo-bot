# Chẩn đoán lỗi deploy Coolify

## Quan sát

Deploy commit `0e079053484b4e6b5cb12f51318d2f5a243e9725` dừng tại Docker build API:

```text
RUN npm ci --omit=dev --workspace @zalobot/api
npm error code ECONNRESET
npm error network aborted
```

Dockerfile xác nhận lệnh lỗi nằm trong stage `runner` tại `apps/api/Dockerfile`.

## Kết luận

Đây là lỗi kết nối từ container build tới npm registry, không phải lỗi TypeScript, dependency lockfile, Docker syntax, hay code ứng dụng. Cùng log cho thấy `npm ci` của web đã hoàn thành thành công trước đó; lỗi xảy ra khi API runner thực hiện một lượt tải dependency độc lập.

## Phạm vi ảnh hưởng

- `apps/api/Dockerfile`: stage `runner` có lượt `npm ci` thứ hai, phụ thuộc vào mạng trong mỗi lần deploy.
- Hạ tầng deploy/Coolify và đường mạng tới npm registry.

## Khuyến nghị tối thiểu

1. Thử deploy lại một lần để loại trừ `ECONNRESET` thoáng qua.
2. Nếu tái diễn, điều chỉnh Dockerfile để không tải package lần thứ hai trong runner (copy production dependencies từ builder hoặc dùng cache BuildKit), kèm retry/timeouts npm phù hợp.
3. Sau khi sửa, chạy Docker build lặp lại để xác nhận stage runner không cần kết nối npm registry ngoài ý muốn.

## Mức độ tin cậy

Cao: log gốc chỉ rõ mã lỗi `ECONNRESET`, lệnh gây lỗi và số dòng Dockerfile tương ứng.
